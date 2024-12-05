import * as vscode from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { COMMENDS } from './ptb-builder/src/utilities/commends';
import { accountLoad } from '../utilities/account';
import { printOutputChannel } from '../utilities/printOutputChannel';

export class PTBBuilderProvider implements vscode.CustomTextEditorProvider {
  public static readonly viewType = 'sui-extension.ptb-builder';

  private readonly _context;
  private readonly _extensionUri: vscode.Uri;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._extensionUri = context.extensionUri;
  }

  public async resolveCustomTextEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
    };

    webviewPanel.webview.html = this._getHtmlForWebview(
      webviewPanel.webview,
      this._extensionUri,
    );

    const updateWebview = () => {
      if (!document.isDirty) {
        webviewPanel.webview.postMessage({
          command: COMMENDS.LoadData,
          data: {
            account: accountLoad(this._context),
            ptb: document.getText(),
          },
        });
      }
    };

    const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(
      (e) => {
        if (e.document.uri.toString() === document.uri.toString()) {
          if (document.isDirty) {
            updateWebview();
            webviewPanel.title = document.fileName;
          }
        }
      },
    );

    const saveDocumentSubscription = vscode.workspace.onDidSaveTextDocument(
      (savedDocument) => {
        if (savedDocument.uri.toString() === document.uri.toString()) {
          // Prevent updateWebview on save
        }
      },
    );

    webviewPanel.onDidDispose(() => {
      changeDocumentSubscription.dispose();
      saveDocumentSubscription.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage(
      async ({ command, data }: { command: COMMENDS; data: any }) => {
        switch (command) {
          case COMMENDS.LoadData:
            updateWebview();
            break;
          case COMMENDS.SaveData:
            this.updateTextDocument(document, data);
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
          default:
            vscode.window.showErrorMessage(
              `Unknown command received: ${command}, ${data}`,
            );
            break;
        }
      },
    );
  }

  private updateTextDocument(document: vscode.TextDocument, text: string) {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(
      document.uri,
      new vscode.Range(0, 0, document.lineCount, 0),
      text,
    );
    return vscode.workspace.applyEdit(edit);
  }

  private _getHtmlForWebview(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
  ) {
    const stylesUri = getUri(webview, extensionUri, [
      'src',
      'webview',
      'ptb-builder',
      'build',
      'static',
      'css',
      'main.css',
    ]);
    const scriptUri = getUri(webview, extensionUri, [
      'src',
      'webview',
      'ptb-builder',
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

export const initPTBBuilderProvider = (context: vscode.ExtensionContext) => {
  const provider = new PTBBuilderProvider(context);
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(
      PTBBuilderProvider.viewType,
      provider,
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'sui-extension.ptbBuilder.new',
      async (uri: vscode.Uri) => {
        const fileName = await vscode.window.showInputBox({
          prompt: 'Enter the name of the new PTB file',
          value: 'new-file',
          validateInput: (text) => {
            if (!text || text.trim() === '') {
              return 'File name cannot be empty';
            }
            if (text.includes('/') || text.includes('\\')) {
              return 'File name cannot contain directory separators';
            }
            return null;
          },
        });

        if (!fileName) {
          return;
        }

        const completeFileName = fileName.endsWith('.ptb')
          ? fileName
          : `${fileName}.ptb`;

        const directoryUri = uri
          ? uri
          : vscode.workspace.workspaceFolders?.[0].uri;
        if (!directoryUri) {
          vscode.window.showErrorMessage(
            'No directory selected and no workspace is open.',
          );
          return;
        }

        const fileUri = vscode.Uri.joinPath(directoryUri, completeFileName);

        try {
          await vscode.workspace.fs.stat(fileUri);
          vscode.window.showErrorMessage(
            `A file named ${completeFileName} already exists in the selected directory.`,
          );
        } catch (error) {
          const encoder = new TextEncoder();
          const initialContent = encoder.encode('');
          await vscode.workspace.fs.writeFile(fileUri, initialContent);
          await vscode.commands.executeCommand(
            'vscode.openWith',
            fileUri,
            PTBBuilderProvider.viewType,
          );
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      'sui-extension.ptbBuilder.open',
      async () => {
        const uris = await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { 'PTB Builder Files': ['ptb'] },
        });
        if (uris && uris.length > 0) {
          const uri = uris[0];
          await vscode.commands.executeCommand(
            'vscode.openWith',
            uri,
            PTBBuilderProvider.viewType,
          );
        }
      },
    ),
  );
};
