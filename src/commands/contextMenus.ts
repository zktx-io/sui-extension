// src/commands/contextMenus.ts
import * as vscode from 'vscode';
import { registerPTBTemplatePicker, ptbTemplates } from './ptbFiles';
import { registerMoveTemplatePicker, moveTemplates } from './moveFiles';

/** Register only commands. Keep view/editor code elsewhere. */
export function initContextMenus(context: vscode.ExtensionContext) {
  // PTB: single command with QuickPick of registered templates
  registerPTBTemplatePicker(
    context,
    'sui-extension.ptbBuilder.new.pick',
    ptbTemplates,
  );

  // Move: single command with QuickPick of registered templates
  registerMoveTemplatePicker(
    context,
    'sui-extension.move.new.pick',
    moveTemplates,
  );
}
