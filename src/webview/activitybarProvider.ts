import * as vscode from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { hasTerminal } from '../utilities/hasTerminal';
import { COMMENDS } from './activitybar/src/utilities/commends';
import { FileWathcer } from '../utilities/fileWatcher';
import {
  accountLoad,
  AccountStateUpdate,
  accountStore,
} from '../utilities/account';
import { printOutputChannel } from '../utilities/printOutputChannel';
import { exchangeToken } from '../utilities/authCode';
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
  private _fileWatcher?: FileWathcer;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._extensionUri = context.extensionUri;
  }

  private runTerminal(runCommand: string) {
    const checkCommand =
      process.platform === 'win32' ? `where ${COMPILER}` : `which ${COMPILER}`;
    const helpMessage = `echo -e \"\\e[31mThe program '${COMPILER}' is not installed.\nPlease install it first. (${COMPILER_URL})\\e[0m\"`;

    let terminal = vscode.window.terminals.find(
      (t) => t.name === `${COMPILER} compiler`,
    );
    if (!terminal) {
      terminal = vscode.window.createTerminal(`${COMPILER} compiler`);
    }
    terminal.show();
    terminal.sendText(
      `if ${checkCommand}; then ${runCommand}; else ${helpMessage}; fi`,
    );
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;
    this._fileWatcher = new FileWathcer(webviewView, this._context, MoveToml);

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
      enableCommandUris: true,
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(
      async ({ command, data }: { command: COMMENDS; data: any }) => {
        switch (command) {
          case COMMENDS.Env:
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
          case COMMENDS.Login:
            {
              const {
                url,
                state,
                codeVerifier,
              }: {
                url: string;
                state: string;
                codeVerifier: string;
              } = data;
              const result = await vscode.env.openExternal(
                vscode.Uri.parse(url),
              );
              if (result) {
                exchangeToken(
                  state,
                  codeVerifier,
                  (data) => {
                    this._view?.webview.postMessage({
                      command: COMMENDS.LoginJwt,
                      data,
                    });
                  },
                  () => {
                    this._view?.webview.postMessage({
                      command: COMMENDS.LoginJwt,
                      data: '',
                    });
                  },
                );
              } else {
                this._view?.webview.postMessage({
                  command: COMMENDS.LoginJwt,
                  data: '',
                });
              }
            }
            break;
          case COMMENDS.StoreAccount:
            await accountStore(this._context, data);
            vscode.commands.executeCommand(AccountStateUpdate);
            break;
          case COMMENDS.CLI:
            if (!hasTerminal()) {
              vscode.window.showErrorMessage(
                'This environment does not support terminal operations.',
              );
            } else {
              this.runTerminal(data);
            }
            break;
          case COMMENDS.Deploy:
            {
              const dumpByte = await this._fileWatcher?.getByteCodeDump(data);
              this._view?.webview.postMessage({
                command: COMMENDS.Deploy,
                data: dumpByte || '',
              });
            }
            break;
          case COMMENDS.MsgInfo:
            vscode.window.showInformationMessage(data);
            break;
          case COMMENDS.MsgError:
            vscode.window.showErrorMessage(data);
            break;
          case COMMENDS.OutputInfo:
            printOutputChannel(data);
            break;
          case COMMENDS.OutputError:
            printOutputChannel(`[ERROR]\n${data}`);
            break;
          case COMMENDS.FMT:
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
                <script nonce="${nonce}" src="${scriptUri}"></script>
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
