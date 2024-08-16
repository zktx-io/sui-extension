import * as vscode from 'vscode';
import * as path from 'path';
import { COMMENDS } from '../webview/src/utilities/commends';
import { ByteDump } from '../config';

const MoveToml = 'Move.toml';
const UpgradeToml = 'Upgrade.toml';

export class FileWathcer {
  private _view: vscode.WebviewView;
  private _packages: { uri: vscode.Uri; path: string; content: string }[] = [];

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
        const path = this.getRelativePath(uri).replace(
          'static/extensions/fs',
          '',
        );
        const temp = this.getUriFromRelativePath(path);
        if (temp) {
          const content = await this.readFileContent(temp);
          this._packages.push({
            uri,
            path: path.replace(
              new RegExp(`(.*)\\b${MoveToml}\\b(?!.*\\b${MoveToml}\\b)`),
              `$1`,
            ),
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
      const uri = this.getUriFromRelativePath(`${path}${UpgradeToml}`);
      if (uri) {
        const content = await this.readFileContent(uri);
        return new TextDecoder().decode(content);
      }
      return '';
    } catch (error) {
      return '';
    }
  }

  public async getByteCodeDump(path: string): Promise<string> {
    try {
      const uri = this.getUriFromRelativePath(`${path}${ByteDump}`);
      if (uri) {
        const content = await this.readFileContent(uri);
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
      this._packages = this._packages.map(({ uri, path, content }) =>
        path !== this.getRelativePath(uri)
          ? { uri, path, content }
          : { uri, path, content: new TextDecoder().decode(newContent) },
      );
      this.updateWebview();
    }
  }

  private handleFileDelete(uri: vscode.Uri) {
    if (uri.fsPath.endsWith(MoveToml)) {
      this._packages = this._packages.filter(
        ({ path }) => path !== this.getRelativePath(uri),
      );
      this.updateWebview();
    }
  }

  private getRelativePath(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      return path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
    }
    return uri.fsPath;
  }

  private getUriFromRelativePath(relativePath: string): vscode.Uri | null {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return null;
    }
    return vscode.Uri.joinPath(workspaceFolder.uri, relativePath);
  }

  private async readFileContent(uri: vscode.Uri): Promise<Uint8Array> {
    try {
      const fileContent = await vscode.workspace.fs.readFile(uri);
      return fileContent;
    } catch (error) {
      uri.path.split('/').pop() !== UpgradeToml &&
        vscode.window.showErrorMessage(`Error reading file: ${error}`);
      return new Uint8Array();
    }
  }

  private updateWebview() {
    this._view.webview.postMessage({
      command: COMMENDS.PackageList,
      data: this._packages.map(({ path, content }) => {
        return {
          path,
          content,
        };
      }),
    });
  }
}
