import * as vscode from 'vscode';
import { PTBTemplateItem } from './templates/types';

/** Open PTB file with the custom editor */
async function openWithPTBEditor(fileUri: vscode.Uri) {
  await vscode.commands.executeCommand(
    'vscode.openWith',
    fileUri,
    'sui-extension.ptb-builder',
  );
}

/** Resolve target directory (explorer or workspace root) */
function getTargetDirectory(uri?: vscode.Uri): vscode.Uri | undefined {
  return uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
}

/** Create and write a PTB file */
async function createPTBFile(
  uri: vscode.Uri | undefined,
  fileName: string,
  content: string,
) {
  const complete = fileName.endsWith('.ptb') ? fileName : `${fileName}.ptb`;
  const dir = getTargetDirectory(uri);
  if (!dir) {
    vscode.window.showErrorMessage(
      'No directory selected and no workspace is open.',
    );
    return;
  }
  const fileUri = vscode.Uri.joinPath(dir, complete);

  // Prevent overwrite
  try {
    await vscode.workspace.fs.stat(fileUri);
    vscode.window.showErrorMessage(`A file named ${complete} already exists.`);
    return;
  } catch {
    // OK if not found
  }

  const encoder = new TextEncoder();
  await vscode.workspace.fs.writeFile(fileUri, encoder.encode(content));
  await openWithPTBEditor(fileUri);
}

/** Optional: open an existing PTB file via file picker */
export async function openPTB() {
  const uris = await vscode.window.showOpenDialog({
    canSelectMany: false,
    filters: { 'PTB Builder Files': ['ptb'] },
  });
  if (uris?.length) {
    await openWithPTBEditor(uris[0]);
  }
}

/** Register QuickPick → InputBox → Create PTB */
export function registerPTBTemplatePicker(
  context: vscode.ExtensionContext,
  commandId: string,
  templates: PTBTemplateItem[],
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(commandId, async (uri?: vscode.Uri) => {
      if (!templates.length) {
        vscode.window.showWarningMessage('No PTB templates registered.');
        return;
      }

      // 1) Select template
      const picked = await vscode.window.showQuickPick(
        templates.map((t) => ({
          label: t.label,
          description: t.description,
          detail: t.detail,
          template: t,
        })),
        {
          title: 'Create PTB from template',
          placeHolder: 'Select a PTB template',
          matchOnDescription: true,
          matchOnDetail: true,
          ignoreFocusOut: true,
        },
      );
      if (!picked) {
        return;
      }

      const tpl = picked.template as PTBTemplateItem;

      // 2) Enter file name
      const name = await vscode.window.showInputBox({
        title: 'PTB file name',
        prompt: `File name for "${tpl.label}"`,
        value: tpl.defaultName,
        validateInput: (text) => {
          if (!text?.trim()) {
            return 'File name cannot be empty';
          }
          if (text.includes('/') || text.includes('\\')) {
            return 'No directory separators allowed';
          }
          return null;
        },
        ignoreFocusOut: true,
      });
      if (!name) {
        return;
      }

      // 3) Write file
      await createPTBFile(uri, name, tpl.file());
    }),
  );
}
