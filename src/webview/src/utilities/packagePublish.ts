import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { vscode } from './vscode';
import { COMMENDS } from './commends';
import { signAndExcute } from './signAndExcute';
import { IAccount } from '../recoil';

export const packagePublish = async (
  account: IAccount,
  dumpByte: string,
): Promise<{ digest: string; packageId: string }> => {
  if (account.nonce.privateKey && account.zkAddress) {
    try {
      const client = new SuiClient({
        url: getFullnodeUrl(account.nonce.network),
      });
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
        (item) => item.type === 'published',
      );
      if (!published[0]) {
        vscode.postMessage({
          command: COMMENDS.MsgError,
          data: JSON.stringify(res, null, 2),
        });
        throw new Error('publish error');
      }
      vscode.postMessage({
        command: COMMENDS.OutputInfo,
        data: JSON.stringify(res, null, 4),
      });
      return {
        digest: res.digest,
        packageId: (published[0] as any).packageId,
      };
    } catch (error) {
      throw new Error(`${error}`);
    }
  } else {
    throw new Error('account empty');
  }
};
