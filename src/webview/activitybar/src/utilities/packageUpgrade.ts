import { SuiClient, SuiObjectChangePublished } from '@mysten/sui/client';
import { Transaction, UpgradePolicy } from '@mysten/sui/transactions';
import { parse } from 'smol-toml';
import { vscode } from './vscode';
import { COMMANDS } from './commands';
import { signAndExcute } from './signAndExcute';
import { IAccount } from '../recoil';

const parseUpgradePolicy = (value: unknown): UpgradePolicy => {
  if (value === undefined || value === null || value === '') {
    return UpgradePolicy.COMPATIBLE;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0 || value > 255) {
      throw new Error(`Invalid upgrade policy number: ${value}`);
    }
    return value as UpgradePolicy;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'compatible') {
      return UpgradePolicy.COMPATIBLE;
    }
    if (normalized === 'additive') {
      return UpgradePolicy.ADDITIVE;
    }
    if (
      normalized === 'dep_only' ||
      normalized === 'dep-only' ||
      normalized === 'dep' ||
      normalized === 'deps' ||
      normalized === 'dependencies'
    ) {
      return UpgradePolicy.DEP_ONLY;
    }
  }
  throw new Error(
    `Invalid upgrade policy (expected compatible|additive|dep_only or 0-255): ${String(
      value,
    )}`,
  );
};

export const packageUpgrade = async (
  account: IAccount,
  client: SuiClient,
  dumpByte: string,
  upgradeToml: string,
): Promise<{
  digest: string;
  packageId: string;
  fromPackageId: string;
  upgradeCap: string;
}> => {
  if (account.zkAddress?.address) {
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
      if (!Array.isArray(modules) || !Array.isArray(dependencies)) {
        throw new Error('Invalid bytecode dump format (modules/dependencies)');
      }
      if (!Array.isArray(hash)) {
        throw new Error('Invalid bytecode dump format (digest)');
      }

      const parsed = parse(upgradeToml) as {
        upgrade?: {
          upgrade_cap?: string;
          package_id?: string;
          policy?: unknown;
        };
      };
      const upgrade = parsed.upgrade;
      if (!upgrade?.upgrade_cap || !upgrade?.package_id) {
        throw new Error(
          'Invalid Upgrade.toml: expected [upgrade] with package_id and upgrade_cap',
        );
      }
      const policy = parseUpgradePolicy(upgrade.policy);

      const address = account.zkAddress.address;
      const transaction = new Transaction();
      transaction.setSender(address);
      const cap = transaction.object(upgrade.upgrade_cap);
      const ticket = transaction.moveCall({
        target: '0x2::package::authorize_upgrade',
        arguments: [
          cap,
          transaction.pure.u8(policy),
          transaction.pure.vector('u8', hash),
        ],
      });
      const receipt = transaction.upgrade({
        modules,
        dependencies,
        package: upgrade.package_id,
        ticket,
      });
      transaction.moveCall({
        target: '0x2::package::commit_upgrade',
        arguments: [cap, receipt],
      });
      const { input } = await client.dryRunTransactionBlock({
        transactionBlock: await transaction.build({ client }),
      });
      const budget = Number(input.gasData.budget);
      if (Number.isFinite(budget) && budget > 0) {
        transaction.setGasBudget(Math.ceil(budget * 1.2));
      }
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
        fromPackageId: upgrade.package_id,
        upgradeCap: upgrade.upgrade_cap,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Errors can happen before signAndExcute() (e.g. dryRun failures), so surface them to the user here.
      if (message !== 'upgrade error') {
        vscode.postMessage({
          command: COMMANDS.MsgError,
          data: `Upgrade failed: ${message}`,
        });
        vscode.postMessage({
          command: COMMANDS.OutputError,
          data: `Upgrade failed: ${message}`,
        });
      }
      throw new Error(message);
    }
  } else {
    throw new Error('account empty');
  }
};
