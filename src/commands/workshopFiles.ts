// src/commands/workshopFiles.ts
// All comments in English
import * as vscode from 'vscode';
import { unzip } from 'fflate';
import { WorkshopTemplate } from './workshop';

import { validateProjectName } from '../utilities/validator';

/** Detect if running in VS Code Web (sandbox) */
const isWeb = () => vscode.env.uiKind === vscode.UIKind.Web;

/** Normalize to POSIX separators */
const toPosix = (p: string) => p.replace(/\\/g, '/');

/** Return POSIX dirname */
const posixDirname = (p: string) => {
  const norm = toPosix(p);
  const i = norm.lastIndexOf('/');
  return i <= 0 ? '' : norm.slice(0, i);
};

/** Check existence safely */
async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

/** Read stat safely */
async function statSafe(uri: vscode.Uri): Promise<vscode.FileStat | undefined> {
  try {
    return await vscode.workspace.fs.stat(uri);
  } catch {
    return undefined;
  }
}

/** Ensure a directory exists */
async function ensureDir(uri: vscode.Uri) {
  await vscode.workspace.fs.createDirectory(uri);
}

/** Load the ZIP asset as bytes (works in both Node and Web) */
async function loadZipAsset(
  context: vscode.ExtensionContext,
  relZipPath: string,
): Promise<Uint8Array> {
  // We copy assets to out/node/... and out/web/...
  const base = isWeb() ? 'out/web/assets/workshop' : 'out/node/assets/workshop';
  const zipUri = vscode.Uri.joinPath(context.extensionUri, base, relZipPath);
  return vscode.workspace.fs.readFile(zipUri);
}

/**
 * Decide whether the ZIP has a single top-level directory (e.g., "project-root/**")
 * If yes, return that root segment so we can strip it; otherwise return ''.
 */
function detectSingleRootDir(entryNames: string[]): string {
  // Normalize and split by '/' then take the first segment for each path that isn't empty
  const firstSegs = new Set<string>();
  for (const name of entryNames) {
    const norm = toPosix(name).replace(/^\/+/, '');
    if (!norm) {
      continue;
    }
    const seg = norm.split('/')[0];
    if (seg) {
      firstSegs.add(seg);
    }
    // If more than one first segment, early exit
    if (firstSegs.size > 1) {
      return '';
    }
  }
  // If no entries or exactly one first segment → treat as single root
  if (firstSegs.size === 1) {
    return [...firstSegs][0];
  }
  return '';
}

/**
 * Extract a ZIP (Uint8Array) into targetDir using fflate + VS Code FS API.
 * - Strips a single top-level directory only when ALL entries share the same first segment.
 * - Creates parent directories proactively.
 * - Resolves file-vs-dir conflicts by replacing files with directories when needed.
 */
async function extractZipWithFflate(
  zipData: Uint8Array,
  targetDir: vscode.Uri,
) {
  // 1) Unzip to a map of { path -> Uint8Array }
  const files = await new Promise<Record<string, Uint8Array>>(
    (resolve, reject) =>
      unzip(zipData, (err, out) => (err ? reject(err) : resolve(out))),
  );

  const names = Object.keys(files);
  if (!names.length) {
    return;
  }

  // 2) Detect a single root folder (strip only if every entry is under the same first segment)
  const root = detectSingleRootDir(names);
  const rootPrefix = root ? `${root}/` : '';

  // 3) Collect directory candidates and file entries
  const dirSet = new Set<string>();
  const fileEntries: Array<{ rel: string; content: Uint8Array }> = [];

  for (const [entryName, content] of Object.entries(files)) {
    // Normalize & optionally strip the root folder
    let norm = toPosix(entryName).replace(/^\/+/, '');
    if (root && norm.startsWith(rootPrefix)) {
      norm = norm.slice(rootPrefix.length);
    }
    if (!norm) {
      continue;
    }

    // Skip explicit root dir entry itself after stripping
    if (norm.endsWith('/')) {
      const d = norm.slice(0, -1);
      if (d) {
        dirSet.add(d);
      }
      continue;
    }

    // Add parent chains to dirSet
    let cur = posixDirname(norm);
    while (cur) {
      dirSet.add(cur);
      const next = posixDirname(cur);
      if (next === cur) {
        break;
      }
      cur = next;
    }
    fileEntries.push({ rel: norm, content });
  }

  // 4) Create directories (shallow → deep), resolve file/dir conflicts
  const dirs = Array.from(dirSet).sort(
    (a, b) => a.split('/').length - b.split('/').length,
  );
  for (const d of dirs) {
    const dirUri = vscode.Uri.joinPath(targetDir, d);
    const st = await statSafe(dirUri);
    if (st && st.type !== vscode.FileType.Directory) {
      // If a file exists where a directory should be, delete it first
      await vscode.workspace.fs.delete(dirUri);
    }
    await ensureDir(dirUri);
  }

  // 5) Write files (ensure parent; resolve conflicts)
  for (const { rel, content } of fileEntries) {
    const parent = posixDirname(rel);
    if (parent) {
      const parentUri = vscode.Uri.joinPath(targetDir, parent);
      const st = await statSafe(parentUri);
      if (!st) {
        await ensureDir(parentUri);
      } else if (st.type !== vscode.FileType.Directory) {
        await vscode.workspace.fs.delete(parentUri);
        await ensureDir(parentUri);
      }
    }

    const outUri = vscode.Uri.joinPath(targetDir, rel);
    try {
      await vscode.workspace.fs.writeFile(outUri, content);
    } catch (e) {
      const msg = String(e || '');
      if (
        isWeb() &&
        (msg.includes('read-only') ||
          msg.includes('EROFS') ||
          msg.includes('Operation not permitted'))
      ) {
        vscode.window.showWarningMessage(
          'This environment appears to be read-only (web sandbox). Please open in Codespaces or local VS Code to scaffold files.',
        );
        throw e;
      }
      throw e;
    }
  }
}

/** Resolve base directory (Explorer folder or workspace root) */
function getTargetDirectory(uri?: vscode.Uri): vscode.Uri | undefined {
  return uri ?? vscode.workspace.workspaceFolders?.[0]?.uri;
}

/**
 * Registers the Workshop template picker (same pattern as Move/PTB).
 * Includes: QuickPick → name prompt → ZIP load → extraction → README open.
 */
export function registerWorkshopTemplatePicker(
  context: vscode.ExtensionContext,
  commandId: string,
  templates: WorkshopTemplate[],
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(commandId, async (uri?: vscode.Uri) => {
      if (!templates.length) {
        vscode.window.showWarningMessage('No Workshop templates registered.');
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
          title: 'Select a Workshop template',
          placeHolder: 'Choose a workshop scaffold',
          matchOnDescription: true,
          matchOnDetail: true,
          ignoreFocusOut: true,
        },
      );
      if (!picked) {
        return;
      }
      const tpl = picked.template as WorkshopTemplate;

      // 2) Ask project name
      const projectName = await vscode.window.showInputBox({
        title: 'Project name',
        prompt: `Folder name for "${tpl.label}"`,
        value: tpl.defaultProjectName,
        validateInput: (v) => validateProjectName(v ?? ''),
        ignoreFocusOut: true,
      });
      if (!projectName) {
        return;
      }
      const safeProjectName = projectName.trim();

      // 3) Determine target dir
      const baseDir = getTargetDirectory(uri);
      if (!baseDir) {
        vscode.window.showErrorMessage(
          'No folder selected and no workspace is open.',
        );
        return;
      }
      const targetDir = vscode.Uri.joinPath(baseDir, safeProjectName);

      // 4) Overwrite policy
      if (await exists(targetDir)) {
        const choice = await vscode.window.showWarningMessage(
          `Folder "${safeProjectName}" already exists. Continue and overwrite files?`,
          { modal: true },
          'Continue',
          'Cancel',
        );
        if (choice !== 'Continue') {
          return;
        }
      } else {
        await ensureDir(targetDir);
      }

      // 5) Load & extract
      try {
        const zipData = await loadZipAsset(context, tpl.zipPath);
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Extracting workshop template...',
          },
          async () => {
            await extractZipWithFflate(zipData, targetDir);
          },
        );
      } catch (e) {
        vscode.window.showErrorMessage(`Failed to scaffold: ${String(e)}`);
        return;
      }

      // Write SOURCE.txt at the root (only if not present)
      if (tpl.sourceUrl) {
        const srcNote = `Source: ${tpl.sourceUrl}\n`;
        const srcUri = vscode.Uri.joinPath(targetDir, 'SOURCE.txt');

        try {
          await vscode.workspace.fs.stat(srcUri); // exists → skip
        } catch {
          await vscode.workspace.fs.writeFile(
            srcUri,
            new TextEncoder().encode(srcNote),
          );
        }
      }

      // 6) Open README if present; otherwise just notify
      const readmeUri = vscode.Uri.joinPath(targetDir, 'README.md');
      if (await exists(readmeUri)) {
        try {
          await vscode.window.showTextDocument(readmeUri);
        } catch {
          /* ignore */
        }
      }
      vscode.window.showInformationMessage(`Workshop created: "${tpl.label}"`);
    }),
  );
}
