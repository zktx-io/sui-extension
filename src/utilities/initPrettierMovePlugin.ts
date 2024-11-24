import * as vscode from 'vscode';
import * as prettier from 'prettier';
import * as tree from '@mysten/prettier-plugin-move/out/tree.js';
import * as printer from '@mysten/prettier-plugin-move/out/printer.js';
import { initParser } from './initParser';

export const initPrettierMovePlugin = (context: vscode.ExtensionContext) => {
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

        const parser = await initParser(context.extensionUri);
        const originalText = document.getText();
        const formatted = await prettier.format(originalText, {
          parser: 'move-parse',
          plugins: [
            {
              parsers: {
                'move-parse': {
                  parse: (text: string) =>
                    new tree.Tree(parser.parse(text).rootNode),
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

        if (originalText === formatted) {
          vscode.window.showInformationMessage(
            'Move file is already formatted.',
          );
          return;
        }

        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(originalText.length),
        );
        edit.replace(document.uri, fullRange, formatted);
        await vscode.workspace.applyEdit(edit);
        await document.save();
        vscode.window.showInformationMessage(
          'Move file formatted and saved successfully!',
        );
      } catch (error) {
        vscode.window.showErrorMessage(`${error}`);
      }
    },
  );
  context.subscriptions.push(disposable);
};
