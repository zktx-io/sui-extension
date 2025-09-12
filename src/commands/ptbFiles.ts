import * as vscode from 'vscode';
import { splitTemplateJson, mergeTemplateJson } from './templates/ptbTemplates';

/** Helper: open the file in PTB custom editor */
export async function openWithPTBEditor(fileUri: vscode.Uri) {
  // NOTE: Use the string literal to avoid circular import
  await vscode.commands.executeCommand(
    'vscode.openWith',
    fileUri,
    'sui-extension.ptb-builder',
  );
}

/** Helper: ensure target directory from explorer or workspace root */
function getTargetDirectory(uri?: vscode.Uri): vscode.Uri | undefined {
  return uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
}

/** Create empty PTB file */
export async function createEmptyPTB(uri?: vscode.Uri) {
  const fileName = await vscode.window.showInputBox({
    prompt: 'Enter the name of the new PTB file',
    value: 'new-file',
    validateInput: (text) => {
      if (!text?.trim()) {
        return 'File name cannot be empty';
      }
      if (text.includes('/') || text.includes('\\')) {
        return 'No directory separators allowed';
      }
      return null;
    },
  });
  if (!fileName) {
    return;
  }

  const complete = fileName.endsWith('.ptb') ? fileName : `${fileName}.ptb`;
  const dir = getTargetDirectory(uri);
  if (!dir) {
    vscode.window.showErrorMessage(
      'No directory selected and no workspace is open.',
    );
    return;
  }
  const fileUri = vscode.Uri.joinPath(dir, complete);

  try {
    await vscode.workspace.fs.stat(fileUri);
    vscode.window.showErrorMessage(`A file named ${complete} already exists.`);
    return;
  } catch {
    // not exists → OK
  }

  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(fileUri, encoder.encode(''));
  await openWithPTBEditor(fileUri);
}

/** Create PTB from a JSON template object */
async function createPTBFromTemplate(
  uri: vscode.Uri | undefined,
  defaultName: string,
  template: object,
) {
  const fileName = await vscode.window.showInputBox({
    prompt: 'Enter the name of the new PTB file',
    value: defaultName,
  });
  if (!fileName) {
    return;
  }

  const complete = fileName.endsWith('.ptb') ? fileName : `${fileName}.ptb`;
  const dir = getTargetDirectory(uri);
  if (!dir) {
    vscode.window.showErrorMessage(
      'No directory selected and no workspace is open.',
    );
    return;
  }
  const fileUri = vscode.Uri.joinPath(dir, complete);

  // NEW: prevent overwrite
  try {
    await vscode.workspace.fs.stat(fileUri);
    vscode.window.showErrorMessage(`A file named ${complete} already exists.`);
    return;
  } catch {
    // not exists → OK
  }

  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(
    fileUri,
    encoder.encode(JSON.stringify(template, null, 2)),
  );
  await openWithPTBEditor(fileUri);
}

/** Open existing PTB file via file picker */
async function openPTB() {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { 'PTB Builder Files': ['ptb'] },
  });
  if (uris?.length) {
    await openWithPTBEditor(uris[0]);
  }
}

/** Convenience wrappers for split/merge templates */
async function createSplitPTB(uri?: vscode.Uri) {
  await createPTBFromTemplate(uri, 'split.ptb', splitTemplateJson);
}
async function createMergePTB(uri?: vscode.Uri) {
  await createPTBFromTemplate(uri, 'merge.ptb', mergeTemplateJson);
}

/** Picker item shape */
export interface PTBTemplateItem {
  id: string;
  label: string;
  description?: string;
  run: (uri?: vscode.Uri) => Promise<void>;
}

/** Our PTB templates */
export const ptbTemplates: PTBTemplateItem[] = [
  {
    id: 'empty',
    label: 'Empty PTB',
    description: 'Blank .ptb file',
    run: createEmptyPTB,
  },
  {
    id: 'split',
    label: 'Split Template',
    description: 'Sample split pipeline',
    run: createSplitPTB,
  },
  {
    id: 'merge',
    label: 'Merge Template',
    description: 'Sample merge pipeline',
    run: createMergePTB,
  },
];

/** Register a PTB template picker command */
export function registerPTBTemplatePicker(
  context: vscode.ExtensionContext,
  commandId: string,
  templates: PTBTemplateItem[],
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(commandId, async (uri?: vscode.Uri) => {
      const pick = await vscode.window.showQuickPick(
        templates.map((t) => ({
          label: t.label,
          description: t.description,
          _tpl: t,
        })),
        {
          title: 'Create PTB from template',
          placeHolder: 'Select a PTB template',
        },
      );
      if (!pick) {
        return;
      }
      await pick._tpl.run(uri);
    }),
  );
}
