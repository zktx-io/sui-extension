import * as vscode from 'vscode';

export const hasTerminal = (): boolean => {
  const isDesktop = vscode.env.uiKind === vscode.UIKind.Desktop;
  const isCodespaces = vscode.env.remoteName === 'codespaces';
  const hasCloudEnv =
    typeof process !== 'undefined' &&
    !!(process as any).env &&
    (!!(process as any).env.GITPOD_WORKSPACE_ID ||
      !!(process as any).env.CLOUD_ENV);

  return isDesktop || isCodespaces || hasCloudEnv;
};
