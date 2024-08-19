import * as vscode from 'vscode';

export const stateUpdate = (
  context: vscode.ExtensionContext,
  state: { [key: string]: any },
): { [key: string]: any } => {
  try {
    const data = stateLoad(context);
    state.path && (data.path = state.path);
    state.packages && (data.packages = { ...data.packages, ...state.packages });
    state.packageDelete && delete data.packages[state.packageDelete];
    context.workspaceState.update('state', data);
    return data;
  } catch (error) {
    return {};
  }
};

export const stateLoad = (
  context: vscode.ExtensionContext,
): { [key: string]: any } => {
  return context.workspaceState.get<{ [key: string]: any }>('state') || {};
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
