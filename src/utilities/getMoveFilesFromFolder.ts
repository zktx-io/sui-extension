import * as vscode from 'vscode';

export const getMoveFilesFromFolder = async (folderUri: string) => {
  try {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage('No workspace folder found');
      return [];
    }
    const pattern = new vscode.RelativePattern(
      vscode.Uri.joinPath(workspaceFolder.uri, `${folderUri}/sources`),
      '**/*.move',
    );
    const files = await vscode.workspace.findFiles(pattern);
    return files;
  } catch (error) {
    vscode.window.showErrorMessage(`Error getting .move files: ${error}`);
    return [];
  }
};
