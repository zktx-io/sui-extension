import * as vscode from 'vscode';
import * as prettier from 'prettier';
import * as Parser from 'web-tree-sitter';
import * as tree from '@mysten/prettier-plugin-move/out/tree.js';
import * as printer from '@mysten/prettier-plugin-move/out/printer.js';
import { getMoveFilesFromFolder } from './getMoveFilesFromFolder';

let parser: Parser | undefined = undefined;
const EXTENSION_NAME = 'prettierMove';

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

const loadVSCodePrettierMoveConfig = (): Record<string, any> => {
  const config = vscode.workspace.getConfiguration(EXTENSION_NAME);
  return {
    tabWidth: config.get('tabWidth', Default.tabWidth),
    printWidth: config.get('printWidth', Default.printWidth),
    useModuleLabel: config.get('useModuleLabel', Default.useModuleLabel),
    autoGroupImports: config.get('autoGroupImports', Default.autoGroupImports),
    enableErrorDebug: config.get('enableErrorDebug', Default.enableErrorDebug),
    wrapComments: config.get('wrapComments', Default.wrapComments),
  };
};

const loadProjectPrettierConfig = async (
  folderUri: string,
): Promise<Record<string, any>> => {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return {};
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
    return {};
  }
};

const getEffectivePrettierConfig = async (
  folderUri: string,
): Promise<Record<string, any>> => {
  const vscodeConfig = loadVSCodePrettierMoveConfig();
  const projectConfig = await loadProjectPrettierConfig(folderUri);
  return { ...vscodeConfig, ...projectConfig };
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
    const config = await getEffectivePrettierConfig(folderUri);
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
