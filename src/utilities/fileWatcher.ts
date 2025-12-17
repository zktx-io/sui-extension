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
  }

  public async initializePackageList() {
    try {
      const files = await vscode.workspace.findFiles(`**/${MoveToml}`);
      this._packages = [];
      for (const uri of files) {
        const relativePath = this.normalizeRelativePath(
          this.getRelativePath(uri),
        );
        const temp = this.getUriFromRelativePath(relativePath);
        if (temp) {
          const content = await this.readFileContent(temp);
          const filePath = relativePath;
          const dirPath = relativePath.replace(
            new RegExp(`(.*)(/\\b${MoveToml}\\b)(?!.*/\\b${MoveToml}\\b)`),
            `$1`,
          );
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

  public async getUpgradeToml(path: string): Promise<string> {
    try {
      const candidates = [
        `${path}/${UpgradeToml}`,
        `${path}/${UpgradeTomlLower}`,
      ];
      for (const relativePath of candidates) {
        const uri = this.getUriFromRelativePath(relativePath);
        if (uri) {
          const content = await this.readFileContent(uri, { silent: true });
          const decoded = new TextDecoder().decode(content);
          if (decoded.trim()) {
            return decoded;
          }
        }
      }
      return '';
    } catch (error) {
      return '';
    }
  }

  public async getByteCodeDump(path: string): Promise<string> {
    try {
      const uri = this.getUriFromRelativePath(`${path}/${ByteDump}`);
      if (uri) {
        const content = await this.readFileContent(uri, { silent: true });
        return new TextDecoder().decode(content);
      }
      return '';
    } catch (error) {
      return '';
    }
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

  private getUriFromRelativePath(relativePath: string): vscode.Uri | null {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return null;
    }
    return vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
  }

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
