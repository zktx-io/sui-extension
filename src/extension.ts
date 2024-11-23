import * as vscode from 'vscode';
import * as prettier from 'prettier';
import * as Parser from 'web-tree-sitter';
import * as tree from '@mysten/prettier-plugin-move/out/tree.js';
import * as printer from '@mysten/prettier-plugin-move/out/printer.js';
import { WebviewViewProvider } from './webviewPovider';

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

  const disposable = vscode.commands.registerCommand(
    'sui-extension.formatMoveFile',
    async () => {
      try {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
          vscode.window.showErrorMessage(
            'No active editor. Please open a Move file.',
          );
          return;
        }

        const document = editor.document;
        if (document.languageId !== 'move') {
          vscode.window.showErrorMessage('This is not a Move file.');
          return;
        }

        const formatted = await prettier.format(document.getText(), {
          parser: 'move-parse',
          plugins: [
            {
              parsers: {
                'move-parse': {
                  parse: (text: string) => {
                    return (async () => {
                      await Parser.init();
                      const wasmPath = vscode.Uri.joinPath(
                        context.extensionUri,
                        'out/tree-sitter-move.wasm',
                      ).path;
                      const Lang = await Parser.Language.load(wasmPath);
                      const parser = new Parser();
                      parser.setLanguage(Lang);
                      return new tree.Tree(parser.parse(text).rootNode);
                    })();
                  },
                  astFormat: 'move-format',
                  locStart: () => -1,
                  locEnd: () => -1,
                },
              },
              printers: {
                'move-format': { print: printer.print },
              },
            },
          ],
        });

        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(document.getText().length),
        );
        edit.replace(document.uri, fullRange, formatted);
        await vscode.workspace.applyEdit(edit);
        vscode.window.showInformationMessage(
          'Move file formatted successfully!',
        );
      } catch (error) {
        vscode.window.showErrorMessage(`${error}`);
      }
    },
  );
  context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
