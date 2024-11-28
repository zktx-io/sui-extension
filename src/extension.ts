import * as vscode from 'vscode';
import { ActivitybarProvider } from './webview/activitybarPovider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new ActivitybarProvider(context);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ActivitybarProvider.viewType,
      provider,
    ),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand('sui-extension.openDocs', () => {
      vscode.env.openExternal(vscode.Uri.parse('https://docs.zktx.io'));
    }),
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
