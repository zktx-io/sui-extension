import * as vscode from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { hasTerminal } from '../utilities/hasTerminal';
import { COMMANDS } from './activitybar/src/utilities/commands';
import { FileWatcher } from '../utilities/fileWatcher';
import {
  accountLoad,
  AccountStateUpdate,
  accountStore,
  canSignAccount,
  getSafeAccount,
} from '../utilities/account';
import { handleSignTransaction } from '../utilities/signing';
import { printOutputChannel } from '../utilities/printOutputChannel';
import { exchangeToken } from '../utilities/authCode';
import type { IAccount } from './activitybar/src/recoil';
import {
  COMPILER,
  COMPILER_URL,
  MoveToml,
  runBuild,
  runTest,
} from './activitybar/src/utilities/cli';

type CliRequest = { kind: 'build' | 'test'; path: string };

const isCliRequest = (value: unknown): value is CliRequest => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Partial<CliRequest>;
  return (
    (v.kind === 'build' || v.kind === 'test') && typeof v.path === 'string'
  );
};

const sanitizeRelativePath = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (
    trimmed.includes('\0') ||
    trimmed.includes('\n') ||
    trimmed.includes('\r')
  ) {
    return null;
  }
  if (trimmed.startsWith('/') || trimmed.startsWith('\\')) {
    return null;
  }
  if (/^[a-zA-Z]:/.test(trimmed)) {
    return null;
  }
  if (trimmed.includes('\\')) {
    return null;
  }

  // Normalize a POSIX-like relative path without relying on node's `path` module
  // (avoids bundler/polyfill issues).
  const segments = trimmed.split('/');
  const out: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') {
      continue;
    }
    if (segment === '..') {
      return null;
    }
    out.push(segment);
  }
  return out.length === 0 ? '.' : out.join('/');
};
// Imports removed

class ActivitybarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'activitybarProviderSui';
  private _view?: vscode.WebviewView;

  private readonly _context;
  private readonly _extensionUri: vscode.Uri;
  private _fileWatcher?: FileWatcher;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._extensionUri = context.extensionUri;
  }

  private async postEnv() {
    const account = await accountLoad(this._context);
    this._view?.webview.postMessage({
      command: COMMANDS.Env,
      data: {
        hasTerminal: hasTerminal(),
        account: account ? getSafeAccount(account) : undefined,
        canSign: canSignAccount(account),
      },
    });
  }

  /** Launch compiler command in a terminal (cross-platform) */
  private runTerminal(runCommand: string) {
    const isWin = process.platform === 'win32';

    let terminal = vscode.window.terminals.find(
      (t) => t.name === `${COMPILER} compiler`,
    );
    if (!terminal) {
      terminal = vscode.window.createTerminal(`${COMPILER} compiler`);
    }
    terminal.show();

    if (isWin) {
      // PowerShell-safe branch (works for most default Windows shells)
      const ps = `
if (Get-Command ${COMPILER} -ErrorAction SilentlyContinue) {
  ${runCommand}
} else {
  Write-Host "The program '${COMPILER}' is not installed. Please install it first. (${COMPILER_URL})"
}`;
      terminal.sendText(ps.trim());
    } else {
      // POSIX shells (bash/zsh)
      const sh = `
if which ${COMPILER} >/dev/null 2>&1; then
  ${runCommand}
else
  printf "\\033[31mThe program '${COMPILER}' is not installed.\\nPlease install it first. (${COMPILER_URL})\\033[0m\\n"
fi`;
      terminal.sendText(sh.trim());
    }
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    this._fileWatcher = new FileWatcher(webviewView, this._context, MoveToml);

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
      enableCommandUris: false,
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      async ({ command, data }: { command: COMMANDS; data: unknown }) => {
        switch (command) {
          case COMMANDS.Env:
            {
              await this.postEnv();
              await this._fileWatcher?.initializePackageList();
            }
            break;
          case COMMANDS.Login:
            {
              const { url, state, codeVerifier } = data as {
                url: string;
                state: string;
                codeVerifier: string;
              };
              const result = await vscode.env.openExternal(
                vscode.Uri.parse(url),
              );
              if (result) {
                exchangeToken(
                  state,
                  codeVerifier,
                  (data) => {
                    this._view?.webview.postMessage({
                      command: COMMANDS.LoginJwt,
                      data,
                    });
                  },
                  () => {
                    this._view?.webview.postMessage({
                      command: COMMANDS.LoginJwt,
                      data: '',
                    });
                  },
                );
              } else {
                this._view?.webview.postMessage({
                  command: COMMANDS.LoginJwt,
                  data: '',
                });
              }
            }
            break;
          case COMMANDS.StoreAccount:
            await accountStore(this._context, data as IAccount | undefined);
            await this.postEnv();
            vscode.commands.executeCommand(AccountStateUpdate);
            break;
          case COMMANDS.SignTransaction:
            await handleSignTransaction(
              this._context,
              data as { transactionBytes: string },
              (msg) => this._view?.webview.postMessage(msg),
              COMMANDS.SignTransaction,
            );
            break;
          case COMMANDS.CLI:
            if (!hasTerminal()) {
              vscode.window.showErrorMessage(
                'This environment does not support terminal operations.',
              );
            } else {
              if (!isCliRequest(data)) {
                vscode.window.showErrorMessage('Invalid CLI request.');
                break;
              }
              const safePath = sanitizeRelativePath(data.path);
              if (!safePath) {
                vscode.window.showErrorMessage('Invalid package path.');
                break;
              }
              if (!this._fileWatcher?.hasPackagePath(safePath)) {
                vscode.window.showErrorMessage(
                  'Unknown package path. Select a valid Move package from the Workspace list.',
                );
                break;
              }
              const cmd =
                data.kind === 'build' ? runBuild(safePath) : runTest(safePath);
              this.runTerminal(cmd);
            }
            break;
          case COMMANDS.Deploy:
            {
              const path = data as string;
              const [dumpByte, upgradeToml] = await Promise.all([
                this._fileWatcher?.getByteCodeDump(path),
                this._fileWatcher?.getUpgradeToml(path),
              ]);
              this._view?.webview.postMessage({
                command: COMMANDS.Deploy,
                data: {
                  dumpByte: dumpByte || '',
                  upgradeToml: upgradeToml || '',
                },
              });
            }
            break;
          case COMMANDS.Upgrade:
            {
              const path = data as string;
              const upgradeToml = await this._fileWatcher?.getUpgradeToml(path);
              this._view?.webview.postMessage({
                command: COMMANDS.Upgrade,
                data: { path, content: upgradeToml || '' },
              });
            }
            break;
          case COMMANDS.OpenExternal:
            await vscode.env.openExternal(vscode.Uri.parse(data as string));
            break;
          case COMMANDS.ClipboardWrite:
            try {
              await vscode.env.clipboard.writeText(data as string);
              vscode.window.showInformationMessage(
                'Upgrade.toml has been copied to the clipboard.',
              );
            } catch (error) {
              vscode.window.showErrorMessage(
                `Failed to copy to clipboard: ${String(error)}`,
              );
            }
            break;
          case COMMANDS.UpgradeSave:
            try {
              const { path, content, overwrite, notify } = data as {
                path: string;
                content: string;
                overwrite?: boolean;
                notify?: boolean;
              };
              const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
              if (!workspaceFolder) {
                throw new Error('No workspace folder found.');
              }
              const fileUri = vscode.Uri.joinPath(
                workspaceFolder.uri,
                path,
                'Upgrade.toml',
              );

              let exists = false;
              try {
                await vscode.workspace.fs.stat(fileUri);
                exists = true;
              } catch {
                exists = false;
              }

              if (exists) {
                if (!overwrite) {
                  if (notify !== false) {
                    vscode.window.showInformationMessage(
                      `Upgrade.toml already exists at "${path}/Upgrade.toml".`,
                    );
                  }
                  break;
                }
                const choice = await vscode.window.showWarningMessage(
                  `Upgrade.toml already exists in "${path}". Overwrite it?`,
                  { modal: true },
                  'Overwrite',
                  'Cancel',
                );
                if (choice !== 'Overwrite') {
                  break;
                }
              }

              await vscode.workspace.fs.writeFile(
                fileUri,
                Buffer.from(content, 'utf8'),
              );
              if (notify !== false) {
                vscode.window.showInformationMessage(
                  `Upgrade.toml has been saved to "${path}/Upgrade.toml".`,
                );
              }
            } catch (error) {
              vscode.window.showErrorMessage(
                `Failed to save Upgrade.toml: ${String(error)}`,
              );
            }
            break;
          case COMMANDS.MsgInfo:
            vscode.window.showInformationMessage(data as string);
            break;
          case COMMANDS.MsgError:
            vscode.window.showErrorMessage(data as string);
            break;
          case COMMANDS.OutputInfo:
            printOutputChannel(data as string);
            break;
          case COMMANDS.OutputError:
            printOutputChannel(`[ERROR]\n${data as string}`);
            break;
          case COMMANDS.FMT:
          default:
            vscode.window.showErrorMessage(
              `Unknown command received : ${command}`,
            );
            break;
        }
      },
    );
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const extensionUri = this._extensionUri;
    const stylesUri = getUri(webview, extensionUri, [
      'src',
      'webview',
      'activitybar',
      'dist',
      'assets',
      'index.css',
    ]);
    const scriptUri = getUri(webview, extensionUri, [
      'src',
      'webview',
      'activitybar',
      'dist',
      'main.js',
    ]);
    const nonce = getNonce();

    return /*html*/ `
            <!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width,initial-scale=1,shrink-to-fit=no">
                <meta name="theme-color" content="#000000">
                <meta http-equiv="Content-Security-Policy"
                      content="
                        default-src 'none';
                        img-src ${webview.cspSource} https: data:;
                        font-src ${webview.cspSource};
                        style-src ${webview.cspSource} 'unsafe-inline';
                        script-src ${webview.cspSource} 'nonce-${nonce}';
                        connect-src ${webview.cspSource} https:;
                      ">
                <link nonce="${nonce}" rel="stylesheet" type="text/css" href="${stylesUri}">
              </head>
              <body>
                <noscript>You need to enable JavaScript to run this app.</noscript>
                <div id="root"></div>
                <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
              </body>
            </html>
          `;
  }
}

export const initActivityBar = (context: vscode.ExtensionContext) => {
  const provider = new ActivitybarProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ActivitybarProvider.viewType,
      provider,
    ),
  );
};
