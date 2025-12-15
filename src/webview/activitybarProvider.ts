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
} from '../utilities/account';
import { printOutputChannel } from '../utilities/printOutputChannel';
import { exchangeToken } from '../utilities/authCode';
import type { IAccount } from './activitybar/src/recoil';
import {
  COMPILER,
  COMPILER_URL,
  MoveToml,
} from './activitybar/src/utilities/cli';

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
      enableCommandUris: true,
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      async ({ command, data }: { command: COMMANDS; data: unknown }) => {
        switch (command) {
          case COMMANDS.Env:
            {
              this._view?.webview.postMessage({
                command,
                data: {
                  hasTerminal: hasTerminal(),
                  account: accountLoad(this._context),
                },
              });
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
            vscode.commands.executeCommand(AccountStateUpdate);
            break;
          case COMMANDS.CLI:
            if (!hasTerminal()) {
              vscode.window.showErrorMessage(
                'This environment does not support terminal operations.',
              );
            } else {
              this.runTerminal(data as string);
            }
            break;
          case COMMANDS.Deploy:
            {
              const dumpByte = await this._fileWatcher?.getByteCodeDump(
                data as string,
              );
              this._view?.webview.postMessage({
                command: COMMANDS.Deploy,
                data: dumpByte || '',
              });
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
