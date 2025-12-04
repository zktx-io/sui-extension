import { SuiClient, SuiObjectChangePublished } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { vscode } from './vscode';
import { COMMANDS } from './commands';
import { signAndExcute } from './signAndExcute';
import { IAccount } from '../recoil';

export const packagePublish = async (
  account: IAccount,
  client: SuiClient,
  dumpByte: string,
): Promise<{ digest: string; packageId: string }> => {
  if (account.nonce.privateKey && account.zkAddress) {
    try {
      const { modules, dependencies } = JSON.parse(dumpByte) as {
        modules: string[];
        dependencies: string[];
        digest: number[];
      };
      const address = account.zkAddress.address;
      const transaction = new Transaction();
      transaction.setSender(address);
      transaction.transferObjects(
        [
          transaction.publish({
            modules,
            dependencies,
          }),
        ],
        address,
      );
      const res = await signAndExcute(account, client, transaction);
      const published = (res.objectChanges || []).filter(
        (item): item is SuiObjectChangePublished => item.type === 'published',
      );
      if (!published[0]) {
        vscode.postMessage({
          command: COMMANDS.MsgError,
          data: JSON.stringify(res, null, 2),
        });
        throw new Error('publish error');
      }
      return {
        digest: res.digest,
        packageId: published[0].packageId,
      };
    } catch (error) {
      throw new Error(`${error}`);
    }
  } else {
    throw new Error('account empty');
  }
};
