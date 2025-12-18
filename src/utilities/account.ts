import * as vscode from 'vscode';
import type { IAccount } from '../webview/activitybar/src/recoil';

export const AccountStateUpdate = 'sui-extension.accountStateUpdate';

export const accountStore = async (
  context: vscode.ExtensionContext,
  account: IAccount | undefined,
) => {
  try {
    if (account) {
      // Store in secure Secrets API
      await context.secrets.store('account', JSON.stringify(account));
      // Remove legacy plaintext storage
      await context.globalState.update('account', undefined);
      vscode.window.showInformationMessage('Account data has been stored.');
    } else {
      // Clear both secure and legacy storage
      await context.secrets.delete('account');
      await context.globalState.update('account', undefined);
      vscode.window.showInformationMessage('Account data has been removed.');
    }
  } catch (error) {
    vscode.window.showErrorMessage('Failed to store account data.');
    console.error('Error storing account data:', error);
  }
};

export const accountLoad = async (
  context: vscode.ExtensionContext,
): Promise<IAccount | undefined> => {
  try {
    // Try to load from Secrets API first
    const accountData = await context.secrets.get('account');

    if (accountData) {
      return JSON.parse(accountData) as IAccount;
    }

    // Check for legacy plaintext storage and delete it (force logout)
    const legacyAccount = context.globalState.get<IAccount>('account');
    if (legacyAccount) {
      // Found legacy data - delete it and force user to re-login
      await context.globalState.update('account', undefined);
      console.warn(
        'Removed legacy plaintext account data. Please login again.',
      );
    }

    return undefined;
  } catch (error) {
    console.error('Error loading account data:', error);
    return undefined;
  }
};

/**
 * Safe version of IAccount without private key or zkLogin secrets.
 * This is safe to send to Webviews.
 */
export interface ISafeAccount extends Omit<IAccount, 'nonce'> {
  nonce: Omit<IAccount['nonce'], 'privateKey'>;
  zkAddress?: { address: string };
}

/**
 * Strips secrets from account data (private key + zkLogin proof material).
 */
export const getSafeAccount = (account: IAccount): ISafeAccount => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { privateKey, ...safeNonce } = account.nonce;
  return {
    ...account,
    nonce: safeNonce,
    zkAddress: account.zkAddress?.address
      ? { address: account.zkAddress.address }
      : undefined,
  };
};
