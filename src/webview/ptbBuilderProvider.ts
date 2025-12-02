import * as vscode from 'vscode';
import { getUri } from '../utilities/getUri';
import { getNonce } from '../utilities/getNonce';
import { COMMANDS } from './ptb-builder/src/utilities/commands';
import { accountLoad, AccountStateUpdate } from '../utilities/account';
import { printOutputChannel } from '../utilities/printOutputChannel';

// Minimal inbound message shape from the webview
type InboundMsg =
  | { command: COMMANDS.LoadData; data?: unknown }
  | { command: COMMANDS.SaveData; data?: unknown }
  | { command: COMMANDS.UpdateState; data?: unknown }
  | { command: COMMANDS.RequestUndo; data?: unknown }
  | { command: COMMANDS.RequestRedo; data?: unknown }
  | { command: COMMANDS.MsgInfo; data?: unknown }
  | { command: COMMANDS.MsgError; data?: unknown }
  | { command: COMMANDS.OutputInfo; data?: unknown }
  | { command: COMMANDS.OutputError; data?: unknown }
  | { command?: string; data?: unknown };

// Create a .ptb file from a template object and open it with our custom editor.
async function createPTBFileFromTemplate(
  uri: vscode.Uri | undefined,
  defaultName: string,
  templateContent: object,
) {
  // Ask file name
  const fileName = await vscode.window.showInputBox({
    prompt: 'Enter the name of the new PTB file',
    value: defaultName,
  });
  if (!fileName) {
    return;
  }

  // Build target path
  const completeFileName = fileName.endsWith('.ptb')
    ? fileName
    : `${fileName}.ptb`;
  const directoryUri = uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
  if (!directoryUri) {
    vscode.window.showErrorMessage(
      'No directory selected and no workspace is open.',
    );
    return;
  }
  const fileUri = vscode.Uri.joinPath(directoryUri, completeFileName);

  // Write initial JSON content
  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(
    fileUri,
    encoder.encode(JSON.stringify(templateContent, null, 2)),
  );

  // Open with our custom editor
  await vscode.commands.executeCommand(
    'vscode.openWith',
    fileUri,
    PTBBuilderProvider.viewType,
  );
}

// Simple CustomDocument that stores raw JSON text of the .ptb
class PTBDocument implements vscode.CustomDocument {
  private _content = '';

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

  // Always use TextEncoder to write (Uint8Array) for compatibility.
  public async save(): Promise<void> {
    const data = new TextEncoder().encode(this._content);
    await vscode.workspace.fs.writeFile(this.uri, data);
  }

  public async saveAs(targetResource: vscode.Uri): Promise<void> {
    const data = new TextEncoder().encode(this._content);
    await vscode.workspace.fs.writeFile(targetResource, data);
  }

  public async revert(): Promise<void> {
    const data = await vscode.workspace.fs.readFile(this.uri);
    this.setText(new TextDecoder('utf-8').decode(data));
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

  // Track all panels per document
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
      content = new TextDecoder('utf-8').decode(data);
    } catch {
      content = '';
    }
    return new PTBDocument(uri, content);
  }

  // Broadcast to all panels (all docs)
  private _broadcastToAllPanels(message: any) {
    for (const set of this._panelsByDoc.values()) {
      for (const panel of set) {
        panel.webview.postMessage(message);
      }
    }
  }

  // Broadcast to all panels of a specific document (optionally skip one)
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
      if (except && panel === except) {
        continue;
      }
      panel.webview.postMessage(message);
    }
  }

  // Build a unified payload for LoadData messages
  private _buildLoadPayload(
    document: PTBDocument,
    options?: { suppressSave?: boolean },
  ) {
    return {
      command: COMMANDS.LoadData,
      data: {
        account: accountLoad(this._context),
        ptb: document.getText(),
        suppressSave: options?.suppressSave || undefined,
      },
    };
  }

  // Send current doc state to a single panel
  private async _updateWebview(
    document: PTBDocument,
    panel: vscode.WebviewPanel,
  ) {
    panel.webview.postMessage(this._buildLoadPayload(document));
  }

  // Apply text and broadcast to all panels of the document
  private _applyAndBroadcast(
    document: PTBDocument,
    text: string,
    options?: { suppressSave?: boolean },
  ) {
    document.setText(text);
    this._broadcastDoc(
      document,
      this._buildLoadPayload(document, options),
    );
  }

  // Normalize PTB JSON strings so semantically identical docs compare equal.
  private _normalizeDocString(text: string) {
    try {
      // Stable stringify to avoid whitespace / key-order churn.
      return JSON.stringify(JSON.parse(text));
    } catch {
      return text;
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

    // Handle messages from webview
    webviewPanel.webview.onDidReceiveMessage(async (msg: InboundMsg) => {
      const { command, data } = msg;

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
          // Webview may send a stringified JSON (recommended) or an object; normalize to string.
          let text: string | undefined;
          try {
            text =
              typeof data === 'string'
                ? data
                : data !== undefined
                  ? JSON.stringify(data)
                  : undefined;
          } catch (error) {
            vscode.window.showErrorMessage(
              `Failed to serialize PTB document: ${String(error)}`,
            );
            break;
          }
          if (typeof text !== 'string') {
            vscode.window.showErrorMessage('Received empty PTB document.');
            break;
          }
          this._updateTextDocument(document, text);

          // Sync latest content to other panels for this doc (skip sender)
          this._broadcastDoc(
            document,
            this._buildLoadPayload(document),
            webviewPanel,
          );
          break;
        }
        case COMMANDS.RequestUndo: {
          await vscode.commands.executeCommand('undo');
          break;
        }
        case COMMANDS.RequestRedo: {
          await vscode.commands.executeCommand('redo');
          break;
        }
        case COMMANDS.MsgInfo:
          vscode.window.showInformationMessage(String(data ?? ''));
          break;
        case COMMANDS.MsgError:
          vscode.window.showErrorMessage(String(data ?? ''));
          break;
        case COMMANDS.OutputInfo:
          printOutputChannel(String(data ?? ''));
          break;
        case COMMANDS.OutputError:
          printOutputChannel(`[ERROR]\n${String(data ?? '')}`);
          break;
        default:
          vscode.window.showErrorMessage(`Unknown command: ${String(command)}`);
          break;
      }
    });

    // Title
    webviewPanel.title = document.uri.fsPath.split('/').pop() || 'PTB Document';

    // Cleanup on dispose
    webviewPanel.onDidDispose(() => {
      const s = this._panelsByDoc.get(key);
      if (s) {
        s.delete(webviewPanel);
        if (s.size === 0) {
          this._panelsByDoc.delete(key);
        }
      }
    });

    // Note: Initial content push can be initiated from the webview (it posts LoadData on mount).
    // If you want the extension to push immediately as well, uncomment below:
    // await this._updateWebview(document, webviewPanel);
  }

  // Update document content and wire undo/redo
  private _updateTextDocument(document: PTBDocument, newContent: string) {
    const prev = document.getText();
    // Avoid churn on semantically identical JSON (prevents redo stack clearing).
    if (prev === newContent) {
      return;
    }
    const normalizedPrev = this._normalizeDocString(prev);
    const normalizedNew = this._normalizeDocString(newContent);
    if (normalizedPrev === normalizedNew) {
      return;
    }

    // Normal edit: set text and provide undo/redo closures for VS Code command integration
    document.setText(newContent);

    const oldText = prev;
    const newText = newContent;

    this._onDidChangeCustomDocument.fire({
      document,
      label: 'PTB Edit',
      undo: async () =>
        this._applyAndBroadcast(document, oldText, { suppressSave: true }),
      redo: async () =>
        this._applyAndBroadcast(document, newText, { suppressSave: true }),
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
    // After revert, sync to all panels for this doc.
    this._broadcastDoc(
      document,
      this._buildLoadPayload(document, { suppressSave: true }),
    );
  }

  public async backupCustomDocument(
    document: PTBDocument,
    context: vscode.CustomDocumentBackupContext,
    _token: vscode.CancellationToken,
  ): Promise<vscode.CustomDocumentBackup> {
    // Delegate to the document's own backup implementation
    return document.backup(context.destination, _token);
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

    // CSP tuned for built assets + https RPC calls
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
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      </body>
    </html>
  `;
  }
}

// Register provider and commands
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
    vscode.commands.registerCommand(AccountStateUpdate, () =>
      provider.updateState(),
    ),
  );
};
