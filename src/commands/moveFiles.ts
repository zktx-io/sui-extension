import * as vscode from 'vscode';
export type SuiNetwork = 'testnet' | 'devnet' | 'mainnet';

export type FileMap = Record<string, string>;

export interface MoveTemplate {
  id: string;
  title: string;
  defaultName: string;
  description?: string;
  files: (pkgName: string, network: SuiNetwork) => FileMap;
}

// fs helpers (same as before)
async function exists(uri: vscode.Uri) {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
async function ensureDir(uri: vscode.Uri) {
  await vscode.workspace.fs.createDirectory(uri);
}
async function writeUtf8(uri: vscode.Uri, content: string) {
  const enc = new TextEncoder();
  await vscode.workspace.fs.writeFile(uri, enc.encode(content));
}
function getTargetDirectory(uri?: vscode.Uri) {
  return uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
}

// scaffold
export async function scaffoldMoveProject(
  uri: vscode.Uri | undefined,
  projectName: string,
  files: FileMap,
) {
  const base = getTargetDirectory(uri);
  if (!base) {
    vscode.window.showErrorMessage(
      'No directory selected and no workspace is open.',
    );
    return;
  }
  const root = vscode.Uri.joinPath(base, projectName);
  if (await exists(root)) {
    const pick = await vscode.window.showWarningMessage(
      `Folder "${projectName}" already exists. Continue and overwrite files?`,
      { modal: true },
      'Continue',
      'Cancel',
    );
    if (pick !== 'Continue') {
      return;
    }
  }

  const dirSet = new Set<string>();
  Object.keys(files).forEach((rel) => {
    const parts = rel.split('/').slice(0, -1);
    if (parts.length) {
      dirSet.add(parts.join('/'));
    }
  });

  await ensureDir(root);
  for (const d of dirSet) {
    await ensureDir(vscode.Uri.joinPath(root, d));
  }
  for (const [rel, content] of Object.entries(files)) {
    await writeUtf8(vscode.Uri.joinPath(root, rel), content);
  }

  const mt = vscode.Uri.joinPath(root, 'Move.toml');
  const first = (await exists(mt))
    ? mt
    : vscode.Uri.joinPath(root, Object.keys(files)[0]);
  await vscode.window.showTextDocument(first);
  vscode.window.showInformationMessage(`Created Move project: ${projectName}`);
}

// QuickPick launcher with network selection
export function registerMoveTemplatePicker(
  context: vscode.ExtensionContext,
  commandId: string,
  templates: MoveTemplate[],
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(commandId, async (uri?: vscode.Uri) => {
      if (!templates.length) {
        vscode.window.showWarningMessage('No Move templates registered.');
        return;
      }

      // 1) pick network
      const netPick = await vscode.window.showQuickPick(
        [{ label: 'testnet' }, { label: 'devnet' }, { label: 'mainnet' }],
        { title: 'Select Sui network for dependency revision' },
      );
      if (!netPick) {
        return;
      }
      const network = netPick.label as SuiNetwork;

      // 2) pick template
      const picked = await vscode.window.showQuickPick(
        templates.map((t) => ({
          label: t.title,
          description: t.description,
          template: t,
        })),
        {
          placeHolder: 'Select a Move project template',
          matchOnDescription: true,
          matchOnDetail: true,
        },
      );
      if (!picked) {
        return;
      }

      const t = picked.template as MoveTemplate;

      // 3) name
      const name = await vscode.window.showInputBox({
        prompt: `Project name for "${t.title}"`,
        value: t.defaultName,
        validateInput: (v) =>
          !v?.trim() ? 'Folder name cannot be empty' : null,
      });
      if (!name) {
        return;
      }

      await scaffoldMoveProject(uri, name, t.files(name, network));
    }),
  );
}

export { moveTemplates } from './templates';
