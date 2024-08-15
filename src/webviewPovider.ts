import * as vscode from 'vscode';
import { getUri } from './utilities/getUri';
import { getNonce } from './utilities/getNonce';
import { hasTerminal } from './utilities/hasTerminal';
import { COMMENDS } from './webview/src/utilities/commends';
import { FileWathcer } from './utilities/fileWatcher';
import { proofLoad, proofStore } from './utilities/proof';
import { exchangeToken } from './utilities/authCode';
import { ByteDump, COMPILER, COMPILER_URL, MoveToml } from './config';

export class WebviewViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'webviewViewProvider';
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

  protected compile(path: string): void {
    this.runTerminal(
      `${COMPILER} move build --dump-bytecode-as-base64 --path ${path} > ${path}/${ByteDump}`,
    );
  }

  protected unitTest(path: string): void {
    this.runTerminal(`${COMPILER} move test --path ${path}`);
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

    webviewView.webview.html = this._getHtmlForWebview(
      webviewView.webview,
      this._extensionUri,
    );

    webviewView.webview.onDidReceiveMessage(
      async ({ command, data }: { command: COMMENDS; data: any }) => {
        switch (command) {
          case COMMENDS.Env:
            const proof = proofLoad(this._context);
            this._view?.webview.postMessage({
              command,
              data: !proof
                ? { hasTerminal: hasTerminal() }
                : { hasTerminal: hasTerminal(), proof },
            });
            break;
          case COMMENDS.Login:
            const {
              url,
              clientId,
              state,
              codeVerifier,
            }: {
              url: string;
              clientId: string;
              state: string;
              codeVerifier: string;
            } = data;
            const result = await vscode.env.openExternal(vscode.Uri.parse(url));
            result &&
              exchangeToken(clientId, state, codeVerifier, (accessToken) => {
                this._view?.webview.postMessage({
                  command: COMMENDS.LoginToken,
                  data: accessToken,
                });
              });
            break;
          case COMMENDS.StoreToken:
            await proofStore(this._context, data);
            break;
          case COMMENDS.PackageList:
            await this._fileWatcher?.initializePackageList();
            break;
          case COMMENDS.PackageSelect:
            {
              const upgradeToml = await this._fileWatcher?.getUpgradeToml(data);
              this._view?.webview.postMessage({
                command: COMMENDS.PackageSelect,
                data: { path: data, upgradeToml },
              });
            }
            break;
          case COMMENDS.Compile:
            if (!hasTerminal()) {
              vscode.window.showErrorMessage(
                'This environment does not support terminal operations.',
              );
            } else {
              this.compile(data);
            }
            break;
          case COMMENDS.UintTest:
            if (!hasTerminal()) {
              vscode.window.showErrorMessage(
                'This environment does not support terminal operations.',
              );
            } else {
              this.unitTest(data);
            }
            break;
          case COMMENDS.MsgError:
            vscode.window.showErrorMessage(data);
            break;
          default:
            vscode.window.showErrorMessage(
              `Unknown command received :, ${command}`,
            );
            break;
        }
      },
    );
  }

  private _getHtmlForWebview(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
  ) {
    const stylesUri = getUri(webview, extensionUri, [
      'src',
      'webview',
      'build',
      'static',
      'css',
      'main.css',
    ]);
    const scriptUri = getUri(webview, extensionUri, [
      'src',
      'webview',
      'build',
      'static',
      'js',
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
