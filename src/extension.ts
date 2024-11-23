import * as vscode from 'vscode';
import { WebviewViewProvider } from './webviewPovider';
import { initPrettierMovePlugin } from './utilities/initPrettierMovePlugin';

export function activate(context: vscode.ExtensionContext) {
  const provider = new WebviewViewProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      WebviewViewProvider.viewType,
      provider,
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('sui-extension.openDocs', () => {
      vscode.env.openExternal(vscode.Uri.parse('https://docs.zktx.io'));
    }),
  );

  initPrettierMovePlugin(context);
}

// This method is called when your extension is deactivated
export function deactivate() {}
