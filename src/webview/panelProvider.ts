import * as vscode from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { getMoveFilesFromFolder } from '../utilities/getMoveFilesFromFolder';
import { printOutputChannel } from '../utilities/printOutputChannel';
import { COMMANDS } from './panel/src/utilities/commands';
import { suiAI, getHistory } from '../utilities/suiAI';

const AuditPrompt =
  'Audit the provided Sui Move smart contract files one by one with file name\nSecurity\nCode Quality and Optimization\nLogical Error Detection\nRecommendations for Improvements\n';

class PanelProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'panelProviderSui';
  private _view?: vscode.WebviewView;

  private readonly _context;
  private readonly _extensionUri: vscode.Uri;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._extensionUri = context.extensionUri;
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

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
      async ({ command, data }: { command: COMMANDS; data: unknown }) => {
        switch (command) {
          case COMMANDS.Env:
            this._view?.webview.postMessage({
              command: COMMANDS.AiHistory,
              data: getHistory(),
            });
            break;
          case COMMANDS.AiQuestion:
            suiAI(
              { code: false, content: data as string },
              (stream) => {
                this._view?.webview.postMessage({
                  command: COMMANDS.AiStream,
                  data: stream,
                });
              },
              () => {
                this._view?.webview.postMessage({
                  command: COMMANDS.AiStreamEnd,
                });
              },
            );
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
          default:
            vscode.window.showErrorMessage(
              `Unknown command received : ${command}`,
            );
            break;
        }
      },
    );
  }

  public sendMessage(message: { command: string; data: string }) {
    switch (message.command) {
      case 'sui-extension.ask-sui.file':
      case 'sui-extension.ask-sui.folder':
        this._view?.webview.postMessage({
          command: message.command,
          data: { code: true, content: '' },
        });
        suiAI(
          { code: true, content: message.data },
          (stream) => {
            this._view?.webview.postMessage({
              command: COMMANDS.AiStream,
              data: stream,
            });
          },
          () => {
            this._view?.webview.postMessage({
              command: COMMANDS.AiStreamEnd,
            });
          },
        );
        break;
      default:
        break;
    }
  }

  private _getHtmlForWebview(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
  ) {
    const stylesUri = getUri(webview, extensionUri, [
      'src',
      'webview',
      'panel',
      'dist',
      'assets',
      'index.css',
    ]);
    const scriptUri = getUri(webview, extensionUri, [
      'src',
      'webview',
      'panel',
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
                <script nonce="${nonce}" src="${scriptUri}"></script>
              </body>
            </html>
          `;
  }
}

export function initPanel(context: vscode.ExtensionContext) {
  const provider = new PanelProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(PanelProvider.viewType, provider),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'sui-extension.ask-sui.file',
      async (uri: vscode.Uri) => {
        let code = '';
        const document = await vscode.workspace.openTextDocument(uri);
        code += `// ${vscode.workspace.asRelativePath(uri, false)}\n${document.getText()}`;
        provider.sendMessage({
          command: 'sui-extension.ask-sui.file',
          data: `${AuditPrompt}\n${code}`,
        });
      },
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      'sui-extension.ask-sui.folder',
      async (uri: vscode.Uri) => {
        const files = await getMoveFilesFromFolder(uri);
        if (files.length > 0) {
          let code = '';
          for (const file of files) {
            const document = await vscode.workspace.openTextDocument(file);
            code += `// ${vscode.workspace.asRelativePath(file, false)}\n${document.getText()}\n\n`;
          }
          provider.sendMessage({
            command: 'sui-extension.ask-sui.folder',
            data: `${AuditPrompt}\n${code}`,
          });
        } else {
          vscode.window.showErrorMessage('No move file found!');
        }
      },
    ),
  );
}
