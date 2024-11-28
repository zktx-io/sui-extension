import * as vscode from 'vscode';
import { IAccount } from '../webview/activitybar/src/recoil';

export const accountStore = async (
  context: vscode.ExtensionContext,
  account: IAccount | undefined,
) => {
  try {
    await context.globalState.update('account', account);
    if (account) {
      vscode.window.showInformationMessage('Data has been securely stored.');
    } else {
      vscode.window.showInformationMessage('Data has been securely removed.');
    }
  } catch (error) {
    vscode.window.showErrorMessage('Failed to store data securely.');
    console.error('Error storing data:', error);
  }
};

export const accountLoad = (
  context: vscode.ExtensionContext,
): IAccount | undefined => {
  return context.globalState.get<IAccount>('account');
};
