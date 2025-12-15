import * as vscode from 'vscode';

interface ProcessEnv {
  GITPOD_WORKSPACE_ID?: string;
  CLOUD_ENV?: string;
}

export const hasTerminal = (): boolean => {
  const isDesktop = vscode.env.uiKind === vscode.UIKind.Desktop;
  const isCodespaces = vscode.env.remoteName === 'codespaces';
  const hasCloudEnv =
    typeof process !== 'undefined' &&
    !!(process as NodeJS.Process & { env: ProcessEnv }).env &&
    (!!(process as NodeJS.Process & { env: ProcessEnv }).env
      .GITPOD_WORKSPACE_ID ||
      !!(process as NodeJS.Process & { env: ProcessEnv }).env.CLOUD_ENV);

  return isDesktop || isCodespaces || hasCloudEnv;
};
