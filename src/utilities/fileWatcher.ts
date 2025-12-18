import * as vscode from 'vscode';
import { COMMANDS } from '../webview/activitybar/src/utilities/commands';
import { ByteDump } from '../webview/activitybar/src/utilities/cli';

const MoveToml = 'Move.toml';
const UpgradeToml = 'Upgrade.toml';
const UpgradeTomlLower = 'upgrade.toml';

type WatchedPackage = {
  uri: vscode.Uri;
  /** Directory that contains the Move.toml */
  path: string;
  /** Relative path to the Move.toml itself (used for diffing). */
  filePath: string;
  content: string;
};

export class FileWatcher {
  private _view: vscode.WebviewView;
  private _packages: WatchedPackage[] = [];

  constructor(
    view: vscode.WebviewView,
    context: vscode.ExtensionContext,
    fileName: string,
  ) {
    this._view = view;
    const watcher = vscode.workspace.createFileSystemWatcher(`**/${fileName}`);
    const upgradeWatcher = vscode.workspace.createFileSystemWatcher(
      `**/{${UpgradeToml},${UpgradeTomlLower}}`,
    );

    watcher.onDidChange(async (uri) => {
      await this.handleFileChange(uri);
    });

    watcher.onDidCreate(async (uri) => {
      await this.handleFileChange(uri);
    });

    watcher.onDidDelete((uri) => {
      this.handleFileDelete(uri);
    });

    context.subscriptions.push(watcher);

    upgradeWatcher.onDidChange(async (uri) => {
      await this.handleUpgradeTomlChange(uri);
    });
    upgradeWatcher.onDidCreate(async (uri) => {
      await this.handleUpgradeTomlChange(uri);
    });
    upgradeWatcher.onDidDelete((uri) => {
      this.handleUpgradeTomlDelete(uri);
    });
    context.subscriptions.push(upgradeWatcher);
  }

  public async initializePackageList() {
    try {
      const files = await vscode.workspace.findFiles(`**/${MoveToml}`);
      this._packages = [];
      for (const uri of files) {
        const relativePath = this.normalizeRelativePath(
          this.getRelativePath(uri),
        );
        // We already have the correct URI from findFiles, so we don't need to guess it.
        // But the original logic tried to 'reassemble' it from relative path to verify?
        // Let's just use the URI we found.

        const content = await this.readFileContent(uri);
        const filePath = relativePath;
        const dirPath = relativePath.replace(
          new RegExp(`(.*)(/\\b${MoveToml}\\b)(?!.*/\\b${MoveToml}\\b)`),
          `$1`,
        );

        // If file content is empty/error, readFileContent returns empty array.
        // We should double check.
        if (content.byteLength > 0) {
          this._packages.push({
            uri,
            path: dirPath,
            filePath,
            content: new TextDecoder().decode(content),
          });
        }
      }
      this.updateWebview();
    } catch (error) {
      vscode.window.showErrorMessage(`Error initializing file list: ${error}`);
    }
  }

  /**
   * Returns true if the given package directory path (relative to workspace)
   * matches a known Move package (directory that contains a Move.toml).
   */
  public hasPackagePath(packagePath: string): boolean {
    const normalized = this.normalizeRelativePath(packagePath);
    return this._packages.some(({ path }) => path === normalized);
  }

  private async handleFileChange(uri: vscode.Uri) {
    if (uri.fsPath.endsWith(MoveToml)) {
      const newContent = await this.readFileContent(uri);
      const changedPath = this.normalizeRelativePath(this.getRelativePath(uri));
      this._packages = this._packages.map(
        ({ uri: storedUri, path, filePath, content }) =>
          filePath !== changedPath
            ? { uri: storedUri, path, filePath, content }
            : {
                uri: storedUri,
                path,
                filePath,
                content: new TextDecoder().decode(newContent),
              },
      );
      this.updateWebview();
    }
  }

  private toPackageDirFromTomlPath(tomlPath: string): string {
    const normalized = this.normalizeRelativePath(tomlPath);
    const match = normalized.match(
      /^(.*?)(?:\/(?:Upgrade\.toml|upgrade\.toml|Move\.toml))$/,
    );
    const dir = match?.[1] ?? '';
    return dir === '' ? '.' : dir;
  }

  private async handleUpgradeTomlChange(uri: vscode.Uri) {
    const relativePath = this.getRelativePath(uri);
    const packageDir = this.toPackageDirFromTomlPath(relativePath);
    const content = await this.readFileContent(uri, { silent: true });
    this._view.webview.postMessage({
      command: COMMANDS.Upgrade,
      data: {
        path: packageDir,
        content: new TextDecoder().decode(content),
      },
    });
  }

  private handleUpgradeTomlDelete(uri: vscode.Uri) {
    const relativePath = this.getRelativePath(uri);
    const packageDir = this.toPackageDirFromTomlPath(relativePath);
    this._view.webview.postMessage({
      command: COMMANDS.Upgrade,
      data: { path: packageDir, content: '' },
    });
  }

  private handleFileDelete(uri: vscode.Uri) {
    if (uri.fsPath.endsWith(MoveToml)) {
      const deletedPath = this.normalizeRelativePath(this.getRelativePath(uri));
      this._packages = this._packages.filter(
        ({ filePath }) => filePath !== deletedPath,
      );
      this.updateWebview();
    }
  }

  private getRelativePath(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      const relativePath = uri.path
        .replace(workspaceFolder.uri.path, '')
        .replace(/^\//, '');
      return relativePath === MoveToml ? `./${MoveToml}` : relativePath;
    }
    return uri.path;
  }

  private async resolveFileConstraints(
    path: string,
    files: string[],
  ): Promise<string> {
    for (const file of files) {
      const key = `${path}/${file}`;
      // Try all workspace folders
      const uris = this.getAllPotentialUris(key);
      for (const uri of uris) {
        const content = await this.readFileContent(uri, { silent: true });
        const decoded = new TextDecoder().decode(content);
        if (decoded.trim()) {
          return decoded;
        }
      }
    }
    return '';
  }

  public async getUpgradeToml(path: string): Promise<string> {
    return this.resolveFileConstraints(path, [UpgradeToml, UpgradeTomlLower]);
  }

  public async getByteCodeDump(path: string): Promise<string> {
    const key = `${path}/${ByteDump}`;
    const uris = this.getAllPotentialUris(key);
    for (const uri of uris) {
      const content = await this.readFileContent(uri, { silent: true });
      if (content.length > 0) {
        return new TextDecoder().decode(content);
      }
    }
    return '';
  }

  // Helper to get all possible URIs for a relative path across all workspace folders
  private getAllPotentialUris(relativePath: string): vscode.Uri[] {
    if (!vscode.workspace.workspaceFolders) {
      return [];
    }
    return vscode.workspace.workspaceFolders.map((folder) =>
      vscode.Uri.joinPath(folder.uri, relativePath),
    );
  }

  // Replaced getUriFromRelativePath with logic inside callers or above helper
  // But initializePackageList needs to be updated too.

  private normalizeRelativePath(path: string) {
    return path.replace('static/extensions/fs', '');
  }

  private async readFileContent(
    uri: vscode.Uri,
    options?: { silent?: boolean },
  ): Promise<Uint8Array> {
    try {
      const fileContent = await vscode.workspace.fs.readFile(uri);
      return fileContent;
    } catch (error) {
      if (!options?.silent) {
        vscode.window.showErrorMessage(`Error reading file: ${error}`);
      }
      return new Uint8Array();
    }
  }

  private updateWebview() {
    this._view.webview.postMessage({
      command: COMMANDS.PackageList,
      data: this._packages.map(({ path, content }) => {
        return {
          path,
          content,
        };
      }),
    });
  }
}
