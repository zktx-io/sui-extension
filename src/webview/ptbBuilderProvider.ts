import * as vscode from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { COMMANDS } from './ptb-builder/src/utilities/commands';
import { accountLoad, AccountStateUpdate } from '../utilities/account';
import { printOutputChannel } from '../utilities/printOutputChannel';

class PTBDocument implements vscode.CustomDocument {
  private _content: string = '';

  private readonly _onDidDispose = new vscode.EventEmitter<void>();
  public readonly onDidDispose = this._onDidDispose.event;

  constructor(
    public readonly uri: vscode.Uri,
    initialContent: string,
  ) {
    this._content = initialContent;
  }

  public getText(): string {
    return this._content;
  }

  public setText(newContent: string) {
    this._content = newContent;
  }

  public async save(): Promise<void> {
    const data = Buffer.from(this._content, 'utf8');
    await vscode.workspace.fs.writeFile(this.uri, data);
  }

  public async saveAs(targetResource: vscode.Uri): Promise<void> {
    const data = Buffer.from(this._content, 'utf8');
    await vscode.workspace.fs.writeFile(targetResource, data);
  }

  public async revert(): Promise<void> {
    const data = await vscode.workspace.fs.readFile(this.uri);
    this.setText(Buffer.from(data).toString('utf8'));
  }

  public async backup(
    destination: vscode.Uri,
    _token: vscode.CancellationToken,
  ): Promise<vscode.CustomDocumentBackup> {
    await this.saveAs(destination);
    return {
      id: destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(destination);
        } catch {
          /* ignore */
        }
      },
    };
  }

  dispose(): void {
    this._onDidDispose.fire();
    this._onDidDispose.dispose();
  }
}

export class PTBBuilderProvider
  implements vscode.CustomEditorProvider<PTBDocument>
{
  public static readonly viewType = 'sui-extension.ptb-builder';

  private readonly _context: vscode.ExtensionContext;

  private _panelsByDoc = new Map<string, Set<vscode.WebviewPanel>>();

  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    vscode.CustomDocumentEditEvent<PTBDocument>
  >();
  public readonly onDidChangeCustomDocument =
    this._onDidChangeCustomDocument.event;

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  public async openCustomDocument(
    uri: vscode.Uri,
    openContext: { backupId?: string },
    _token: vscode.CancellationToken,
  ): Promise<PTBDocument> {
    const fileToRead = openContext.backupId
      ? vscode.Uri.parse(openContext.backupId)
      : uri;
    let content = '';
    try {
      const data = await vscode.workspace.fs.readFile(fileToRead);
      content = Buffer.from(data).toString('utf8');
    } catch {
      content = '';
    }

    return new PTBDocument(uri, content);
  }

  private _broadcastToAllPanels(message: any) {
    for (const set of this._panelsByDoc.values()) {
      for (const panel of set) {
        panel.webview.postMessage(message);
      }
    }
  }

  private _broadcastDoc(
    document: PTBDocument,
    message: any,
    except?: vscode.WebviewPanel,
  ) {
    const key = document.uri.toString();
    const set = this._panelsByDoc.get(key);
    if (!set) {
      return;
    }
    for (const panel of set) {
      if (except && panel === except) continue;
      panel.webview.postMessage(message);
    }
  }

  public async updateState() {
    const payload = {
      command: COMMANDS.UpdateState,
      data: {
        account: accountLoad(this._context),
      },
    };
    this._broadcastToAllPanels(payload);
  }

  public async resolveCustomEditor(
    document: PTBDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken,
  ): Promise<void> {
    const key = document.uri.toString();
    const set = this._panelsByDoc.get(key) ?? new Set<vscode.WebviewPanel>();
    set.add(webviewPanel);
    this._panelsByDoc.set(key, set);

    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._context.extensionUri],
    };
    webviewPanel.webview.html = this._getHtmlForWebview(webviewPanel.webview);

    webviewPanel.webview.onDidReceiveMessage(async (msg) => {
      const { command, data } = msg;
      console.log(1, msg);
      switch (command) {
        case COMMANDS.UpdateState: {
          this.updateState();
          break;
        }
        case COMMANDS.LoadData: {
          await this._updateWebview(document, webviewPanel);
          break;
        }
        case COMMANDS.SaveData: {
          const text = typeof data === 'string' ? data : JSON.stringify(data);
          this._updateTextDocument(document, text);

          this._broadcastDoc(
            document,
            {
              command: COMMANDS.LoadData,
              data: {
                account: accountLoad(this._context),
                ptb: document.getText(),
              },
            },
            webviewPanel,
          );
          break;
        }
        case COMMANDS.MsgInfo:
          vscode.window.showInformationMessage(data);
          break;
        case COMMANDS.MsgError:
          vscode.window.showErrorMessage(data);
          break;
        case COMMANDS.OutputInfo:
          printOutputChannel(data);
          break;
        case COMMANDS.OutputError:
          printOutputChannel(`[ERROR]\n${data}`);
          break;
        default:
          vscode.window.showErrorMessage(`Unknown command: ${command}`);
          break;
      }
    });

    webviewPanel.title = document.uri.fsPath.split('/').pop() || 'PTB Document';

    webviewPanel.onDidDispose(() => {
      const s = this._panelsByDoc.get(key);
      if (s) {
        s.delete(webviewPanel);
        if (s.size === 0) {
          this._panelsByDoc.delete(key);
        }
      }
    });
  }

  private async _updateWebview(
    document: PTBDocument,
    panel: vscode.WebviewPanel,
  ) {
    panel.webview.postMessage({
      command: COMMANDS.LoadData,
      data: {
        account: accountLoad(this._context),
        ptb: document.getText(),
      },
    });
  }

  // Apply text to document and broadcast to all panels for this document.
  private _applyAndBroadcast(document: PTBDocument, text: string) {
    document.setText(text);
    this._broadcastDoc(document, {
      command: COMMANDS.LoadData,
      data: {
        account: accountLoad(this._context),
        ptb: document.getText(),
      },
    });
  }

  private _updateTextDocument(document: PTBDocument, newContent: string) {
    const prev = document.getText();
    if (prev === newContent) {
      return; // No-op edit
    }

    // Detect initial bootstrap (empty file -> first valid doc from webview)
    const isInitialBootstrap = prev === '' && newContent.length > 0;

    if (isInitialBootstrap) {
      // Persist immediately to avoid a dirty badge on first load.
      // Do NOT add to undo stack.
      document.setText(newContent);
      document.save().catch(() => {
        /* ignore initial save errors */
      });
      // Optionally sync other panels (rare multi-open right after create)
      this._broadcastDoc(document, {
        command: COMMANDS.LoadData,
        data: { account: accountLoad(this._context), ptb: document.getText() },
      });
      return;
    }

    // Normal edit: apply now, and provide undo/redo closures to VS Code
    document.setText(newContent);

    const oldText = prev;
    const newText = newContent;

    this._onDidChangeCustomDocument.fire({
      document,
      label: 'PTB Edit',
      undo: async () => {
        this._applyAndBroadcast(document, oldText);
      },
      redo: async () => {
        this._applyAndBroadcast(document, newText);
      },
    });
  }

  public async saveCustomDocument(
    document: PTBDocument,
    _cancellation: vscode.CancellationToken,
  ): Promise<void> {
    await document.save();
  }

  public async saveCustomDocumentAs(
    document: PTBDocument,
    targetResource: vscode.Uri,
    _cancellation: vscode.CancellationToken,
  ): Promise<void> {
    await document.saveAs(targetResource);
  }

  public async revertCustomDocument(
    document: PTBDocument,
    _cancellation: vscode.CancellationToken,
  ): Promise<void> {
    await document.revert();
    // Broadcast reverted content to all panels for this document.
    this._broadcastDoc(document, {
      command: COMMANDS.LoadData,
      data: {
        account: accountLoad(this._context),
        ptb: document.getText(),
      },
    });
  }

  public async backupCustomDocument(
    document: PTBDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken,
  ): Promise<vscode.CustomDocumentBackup> {
    return document.backup(context.destination, cancellation);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const extensionUri = this._context.extensionUri;
    const stylesUri = getUri(webview, extensionUri, [
      'src',
      'webview',
      'ptb-builder',
      'dist',
      'assets',
      'index.css',
    ]);
    const scriptUri = getUri(webview, extensionUri, [
      'src',
      'webview',
      'ptb-builder',
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
        <link rel="stylesheet" href="${stylesUri}">
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
      {
        supportsMultipleEditorsPerDocument: true,
      },
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(AccountStateUpdate, () => {
      provider.updateState();
    }),
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
        } catch {
          const encoder = new TextEncoder();
          await vscode.workspace.fs.writeFile(fileUri, encoder.encode(''));
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
