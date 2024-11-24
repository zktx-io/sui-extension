import * as vscode from 'vscode';
import * as Parser from 'web-tree-sitter';

let parser: Parser | undefined = undefined;

export const initParser = async (extensionUri: vscode.Uri): Promise<Parser> => {
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
