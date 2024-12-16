import * as vscode from 'vscode';

export const getMoveFilesFromFolder = async (uri: vscode.Uri) => {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return [];
    }
    const pattern = new vscode.RelativePattern(uri, '**/*.move');
    const files = await vscode.workspace.findFiles(pattern);
    return files;
  } catch (error) {
    vscode.window.showErrorMessage(`Error getting .move files: ${error}`);
    return [];
  }
};
