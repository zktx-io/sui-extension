import * as vscode from 'vscode';
import type { IAccount } from '../webview/activitybar/src/recoil';

export const AccountStateUpdate = 'sui-extension.accountStateUpdate';

const ACCOUNT_SCHEMA_VERSION = 2 as const;

type StoredAccountV2 = {
  schemaVersion: typeof ACCOUNT_SCHEMA_VERSION;
  account: IAccount;
};

const isStoredAccountV2 = (value: unknown): value is StoredAccountV2 => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const v = value as Partial<StoredAccountV2>;
  return v.schemaVersion === ACCOUNT_SCHEMA_VERSION && !!v.account;
};

export const accountStore = async (
  context: vscode.ExtensionContext,
  account: IAccount | undefined,
) => {
  try {
    if (account) {
      // Store in secure Secrets API
      const payload: StoredAccountV2 = {
        schemaVersion: ACCOUNT_SCHEMA_VERSION,
        account,
      };
      await context.secrets.store('account', JSON.stringify(payload));
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
      let parsed: unknown;
      try {
        parsed = JSON.parse(accountData) as unknown;
      } catch {
        parsed = undefined;
      }

      if (isStoredAccountV2(parsed)) {
        return parsed.account;
      }

      // No migration: clear old/unknown schema and force re-login once after update.
      await context.secrets.delete('account');
      const alreadyNotified = context.globalState.get<boolean>(
        'accountSchemaClearedNotified',
      );
      if (!alreadyNotified) {
        await context.globalState.update('accountSchemaClearedNotified', true);
        vscode.window.showInformationMessage(
          'Account data was cleared due to an update. Please login again.',
        );
      }
      return undefined;
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

export const canSignAccount = (account: IAccount | undefined): boolean => {
  return Boolean(
    account?.nonce.privateKey &&
      account.zkAddress?.address &&
      account.zkAddress.jwt &&
      account.zkAddress.salt &&
      account.zkAddress.proof,
  );
};
