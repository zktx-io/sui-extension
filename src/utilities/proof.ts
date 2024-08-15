import * as vscode from 'vscode';

export const tokenStore = async (
  context: vscode.ExtensionContext,
  token: string,
) => {
  try {
    await context.globalState.update('proof', token);
    vscode.window.showInformationMessage('Token has been securely stored.');
  } catch (error) {
    vscode.window.showErrorMessage('Failed to store token securely.');
    console.error('Error storing token:', error);
  }
};

export const tokenLoad = (
  context: vscode.ExtensionContext,
): string | undefined => {
  return context.globalState.get<string>('proof');
};
