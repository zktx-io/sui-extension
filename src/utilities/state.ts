import * as vscode from 'vscode';

export const stateUpdate = async (
  context: vscode.ExtensionContext,
  state: { [key: string]: any },
) => {
  try {
    const old = stateLoad(context) || '{}';
    const parsed = { ...JSON.parse(old), ...state };
    context.workspaceState.update('state', JSON.stringify(parsed));
  } catch (error) {
    vscode.window.showErrorMessage('Failed to store state.');
  }
};

export const stateLoad = (
  context: vscode.ExtensionContext,
): string | undefined => {
  return context.workspaceState.get<string>('state');
};

export const cleanObject = (obj: {
  [key: string]: any;
}): { [key: string]: any } => {
  for (const key in obj) {
    if (obj[key] === undefined) {
      delete obj[key];
    }
  }
  return obj;
};
