import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { toBase64 } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import { IAccount } from '../recoil';
import { vscode } from './vscode';
import { COMMANDS } from './commands';

export const signAndExcute = async (
  account: IAccount,
  client: SuiClient,
  transaction: Transaction,
): Promise<SuiTransactionBlockResponse> => {
  if (account.nonce && account.zkAddress) {
    try {
      const bytes = await transaction.build({ client });

      const signature = await new Promise<string>((resolve, reject) => {
        const handler = (event: MessageEvent) => {
          const msg = event.data;
          if (msg.command === COMMANDS.SignTransaction) {
            window.removeEventListener('message', handler);
            if (msg.data.error) {
              reject(new Error(msg.data.error));
            } else if (msg.data.signature) {
              resolve(msg.data.signature);
            } else {
              reject(new Error('No signature returned'));
            }
          }
        };
        window.addEventListener('message', handler);
        vscode.postMessage({
          command: COMMANDS.SignTransaction,
          data: { transactionBytes: toBase64(bytes) },
        });
        setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('Signing timeout'));
        }, 30000);
      });

      const { digest, errors } = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature: signature,
      });
      if (errors && errors.length > 0) {
        throw new Error(`${JSON.stringify(errors)}`);
      }
      const res = await client.waitForTransaction({
        digest,
        options: { showObjectChanges: true },
      });
      if (res.errors) {
        vscode.postMessage({
          command: COMMANDS.MsgError,
          data: `error: ${res.errors.toString()}`,
        });
        vscode.postMessage({
          command: COMMANDS.OutputError,
          data: JSON.stringify(res, null, 4),
        });
        throw new Error(`${res.errors.toString()}`);
      }
      vscode.postMessage({
        command: COMMANDS.MsgInfo,
        data: `success: ${account.nonce.network}:${res.digest}`,
      });
      vscode.postMessage({
        command: COMMANDS.OutputInfo,
        data: JSON.stringify(res, null, 4),
      });
      return res;
    } catch (error) {
      vscode.postMessage({
        command: COMMANDS.MsgError,
        data: `${error}`,
      });
      throw new Error(`${error}`);
    }
  } else {
    throw new Error('account empty');
  }
};
