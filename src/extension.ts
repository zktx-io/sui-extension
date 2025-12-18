import * as vscode from 'vscode';
import { initActivityBar } from './webview/activitybarProvider';
import { initPTBBuilderProvider } from './webview/ptbBuilderProvider';
import { initContextMenus } from './commands/contextMenus';

export function activate(context: vscode.ExtensionContext) {
  initActivityBar(context);
  initPTBBuilderProvider(context);
  initContextMenus(context);

  context.subscriptions.push(
    vscode.commands.registerCommand('sui-extension.openDocs', () => {
      vscode.env.openExternal(vscode.Uri.parse('https://docs.zktx.io'));
    }),
  );
}

// This method is called when your extension is deactivated
export function deactivate() {}
