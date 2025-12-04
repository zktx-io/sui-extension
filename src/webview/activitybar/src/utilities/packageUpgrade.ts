import { SuiClient, SuiObjectChangePublished } from '@mysten/sui/client';
import { Transaction, UpgradePolicy } from '@mysten/sui/transactions';
import { parse } from 'smol-toml';
import { vscode } from './vscode';
import { COMMANDS } from './commands';
import { signAndExcute } from './signAndExcute';
import { IAccount } from '../recoil';

export const packageUpgrade = async (
  account: IAccount,
  client: SuiClient,
  dumpByte: string,
  upgradeToml: string,
): Promise<{ digest: string; packageId: string }> => {
  if (account.nonce.privateKey && account.zkAddress) {
    try {
      const {
        modules,
        dependencies,
        digest: hash,
      } = JSON.parse(dumpByte) as {
        modules: string[];
        dependencies: string[];
        digest: number[];
      };
      const parsed = parse(upgradeToml) as {
        upgrade: {
          upgrade_cap: string;
          package_id: string;
        };
      };
      const address = account.zkAddress.address;
      const transaction = new Transaction();
      transaction.setSender(address);
      const cap = transaction.object(parsed.upgrade.upgrade_cap);
      const ticket = transaction.moveCall({
        target: '0x2::package::authorize_upgrade',
        arguments: [
          cap,
          transaction.pure.u8(UpgradePolicy.COMPATIBLE),
          transaction.pure.vector('u8', hash),
        ],
      });
      const receipt = transaction.upgrade({
        modules,
        dependencies,
        package: parsed.upgrade.package_id,
        ticket,
      });
      transaction.moveCall({
        target: '0x2::package::commit_upgrade',
        arguments: [cap, receipt],
      });
      const { input } = await client.dryRunTransactionBlock({
        transactionBlock: await transaction.build({ client }),
      });
      transaction.setGasBudget(parseInt(input.gasData.budget));
      const res = await signAndExcute(account, client, transaction);
      const published = (res.objectChanges || []).filter(
        (item): item is SuiObjectChangePublished => item.type === 'published',
      );
      if (!published[0]) {
        vscode.postMessage({
          command: COMMANDS.MsgError,
          data: JSON.stringify(res, null, 2),
        });
        throw new Error('upgrade error');
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
