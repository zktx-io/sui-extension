import * as vscode from 'vscode';

export const hasTerminal = (): boolean => {
  const hasTerminal =
    vscode.env.uiKind === vscode.UIKind.Desktop ||
    vscode.env.remoteName === 'codespaces' ||
    !!process.env.GITPOD_WORKSPACE_ID ||
    !!process.env.CLOUD_ENV;

  return hasTerminal;
};
