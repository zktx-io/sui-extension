import * as vscode from 'vscode';
import { initActivityBar } from './webview/activitybarProvider';

export function activate(context: vscode.ExtensionContext) {
  initActivityBar(context);
  context.subscriptions.push(
    vscode.commands.registerCommand('sui-extension.openDocs', () => {
      vscode.env.openExternal(vscode.Uri.parse('https://docs.zktx.io'));
    }),
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
