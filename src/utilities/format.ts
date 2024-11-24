import * as vscode from 'vscode';
import * as prettier from 'prettier';
import * as Parser from 'web-tree-sitter';
import * as tree from '@mysten/prettier-plugin-move/out/tree.js';
import * as printer from '@mysten/prettier-plugin-move/out/printer.js';

let parser: Parser | undefined = undefined;

const Default = {
  tabWidth: 4,
  printWidth: 100,
  useModuleLabel: true,
  autoGroupImports: 'module',
  enableErrorDebug: false,
  wrapComments: false,
};

const initParser = async (extensionUri: vscode.Uri): Promise<Parser> => {
  if (parser) {
    return parser;
  }

  await Parser.init();
  const wasmPath = vscode.Uri.joinPath(
    extensionUri,
    'out/tree-sitter-move.wasm',
  ).path;
  const Lang = await Parser.Language.load(wasmPath);
  parser = new Parser();
  parser.setLanguage(Lang);

  return parser;
};

const loadPrettierConfig = async (
  folderUri: string,
): Promise<Record<string, any>> => {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return Default;
    }
    const prettierConfigPath = vscode.Uri.joinPath(
      workspaceFolder.uri,
      folderUri,
      '.prettierrc.json',
    ).fsPath;
    const document =
      await vscode.workspace.openTextDocument(prettierConfigPath);
    const config = JSON.parse(document.getText());
    return config ? { ...Default, ...config } : Default;
  } catch (error) {
    vscode.window.showErrorMessage(`Error loading .prettierrc: ${error}`);
    return Default;
  }
};

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

const tryFormat = async (
  plugin: prettier.Plugin<any>,
  workspaceFolder: vscode.WorkspaceFolder,
  file: vscode.Uri,
  config: any,
  channel?: vscode.OutputChannel,
) => {
  try {
    const document = await vscode.workspace.openTextDocument(file);
    const originalText = document.getText();
    const formatted = await prettier.format(originalText, {
      parser: 'move-parse',
      plugins: [plugin],
      ...config,
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
  } catch (error) {
    vscode.window.showErrorMessage(`Error formatting file: ${file.fsPath}`);
    channel &&
      channel.appendLine(`Error formatting file: ${file.fsPath} - ${error}`);
  }
};

const formatAndSaveMoveFiles = async (
  folderUri: string,
  files: vscode.Uri[],
  parser: Parser,
  channel?: vscode.OutputChannel,
) => {
  try {
    const config = await loadPrettierConfig(folderUri);
    const plugin = {
      parsers: {
        'move-parse': {
          parse: (text: string) => {
            return (async () => {
              return new tree.Tree(parser.parse(text).rootNode);
            })();
          },
          astFormat: 'move-format',
          locStart: () => -1,
          locEnd: () => -1,
        },
      },
      printers: {
        'move-format': {
          print: (path: any, options: any, print: any) => {
            return printer.print(path, { ...options, ...config }, print);
          },
        },
      },
    };

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    for (const file of files) {
      workspaceFolder &&
        (await tryFormat(plugin, workspaceFolder, file, config, channel));
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Unexpected error: ${error}`);
  }
};

export const format = async (
  folderUri: string,
  context: vscode.ExtensionContext,
  channel?: vscode.OutputChannel,
): Promise<undefined> => {
  try {
    const parser = await initParser(context.extensionUri);
    const files = await getMoveFilesFromFolder(folderUri);
    await formatAndSaveMoveFiles(folderUri, files, parser, channel);
  } catch (error) {
    vscode.window.showErrorMessage(`Error getting .move files: ${error}`);
  }
};
