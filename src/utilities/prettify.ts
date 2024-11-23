import * as vscode from 'vscode';
import * as prettier from 'prettier';
import * as Parser from 'web-tree-sitter';
import * as tree from '@mysten/prettier-plugin-move/out/tree.js';
import * as printer from '@mysten/prettier-plugin-move/out/printer.js';

let isWasmInitialized = false;
let parser: Parser | undefined = undefined;

const getMoveFilesFromFolder = async (folderUri: string) => {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return [];
    }
    const pattern = new vscode.RelativePattern(
      vscode.Uri.joinPath(workspaceFolder.uri, `${folderUri}/sources`),
      '**/*.move',
    );
    const files = await vscode.workspace.findFiles(pattern);
    return files;
  } catch (error) {
    vscode.window.showErrorMessage(`Error getting .move files: ${error}`);
    return [];
  }
};

const initParser = async (context: vscode.ExtensionContext) => {
  if (!isWasmInitialized) {
    await Parser.init();
    const wasmPath = vscode.Uri.joinPath(
      context.extensionUri,
      'out/tree-sitter-move.wasm',
    ).path;
    const Lang = await Parser.Language.load(wasmPath);
    parser = new Parser();
    parser.setLanguage(Lang);
    isWasmInitialized = true;
  }
};

const formatAndSaveMoveFiles = async (
  files: vscode.Uri[],
  channel?: vscode.OutputChannel,
) => {
  try {
    const plugin = {
      parsers: {
        'move-parse': {
          parse: (text: string) => {
            return (async () => {
              return new tree.Tree(parser!.parse(text).rootNode);
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
    };

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    for (const file of files) {
      const document = await vscode.workspace.openTextDocument(file);
      const originalText = document.getText(); // 원본 텍스트 가져오기
      const formatted = await prettier.format(originalText, {
        parser: 'move-parse',
        plugins: [plugin],
      });

      if (originalText !== formatted) {
        const edit = new vscode.WorkspaceEdit();
        const fullRange = new vscode.Range(
          document.positionAt(0),
          document.positionAt(originalText.length),
        );
        edit.replace(document.uri, fullRange, formatted);
        await vscode.workspace.applyEdit(edit);
        await document.save();

        channel &&
          workspaceFolder &&
          channel.appendLine(
            `${file.fsPath.replace(new RegExp(`^${workspaceFolder.uri.path}`), '')}`,
          );
      } else {
        channel &&
          workspaceFolder &&
          channel.appendLine(
            `${file.fsPath.replace(new RegExp(`^${workspaceFolder.uri.path}`), '')} (unchanged)`,
          );
      }
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Error formatting files: ${error}`);
  }
};

export const prettify = async (
  folderUri: string,
  context: vscode.ExtensionContext,
  channel?: vscode.OutputChannel,
): Promise<undefined> => {
  try {
    await initParser(context);
    const files = await getMoveFilesFromFolder(folderUri);
    await formatAndSaveMoveFiles(files, channel);
  } catch (error) {
    vscode.window.showErrorMessage(`Error getting .move files: ${error}`);
  }
};
