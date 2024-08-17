import {
  getFullnodeUrl,
  SuiClient,
  SuiTransactionBlockResponse,
} from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';
import {
  Transaction as TransactionBlock,
  UpgradePolicy,
} from '@mysten/sui/transactions';
import { genAddressSeed, getZkLoginSignature } from '@mysten/zklogin';
import { decodeJwt } from 'jose';
import { parse } from 'smol-toml';
import { IAccount } from '../recoil';

export const packageUpgrade = async (
  account: IAccount,
  dumpByte: string,
  upgradeToml: string,
): Promise<SuiTransactionBlockResponse> => {
  if (account.nonce.privateKey && account.zkAddress) {
    try {
      const client = new SuiClient({
        url: getFullnodeUrl(account.nonce.network),
      });
      const {
        modules,
        dependencies,
        digest: hash,
      } = JSON.parse(dumpByte) as {
        modules: string[];
        dependencies: string[];
        digest: number[];
      };
      const parsed = parse(upgradeToml);
      const address = account.zkAddress.address;
      const privateKey = account.nonce.privateKey;
      const transaction = new TransactionBlock();
      transaction.setSender(address);
      const cap = transaction.object((parsed.upgrade as any).upgrade_cap);
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
        package: (parsed.upgrade as any).package_id,
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
      const decodedJwt = decodeJwt(account.zkAddress.jwt);
      const addressSeed: string = genAddressSeed(
        BigInt(account.zkAddress.salt),
        'sub',
        decodedJwt.sub!,
        decodedJwt.aud as string,
      ).toString();
      const { bytes, signature: userSignature } = await transaction.sign({
        client,
        signer: Ed25519Keypair.fromSecretKey(fromB64(privateKey)),
      });
      const zkLoginSignature = getZkLoginSignature({
        inputs: {
          ...JSON.parse(account.zkAddress.proof),
          addressSeed,
        },
        maxEpoch: account.nonce.expiration,
        userSignature,
      });
      const { digest, errors } = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature: zkLoginSignature,
      });
      if (errors && errors.length > 0) {
        throw new Error(`${JSON.stringify(errors)}`);
      } else {
        const res = await client.waitForTransaction({
          digest,
          options: { showObjectChanges: true },
        });
        if (res.errors && res.errors.length > 0) {
          throw new Error(`${JSON.stringify(errors)}`);
        }
        return res;
      }
    } catch (error) {
      throw new Error(`${error}`);
    }
  } else {
    throw new Error('account empty');
  }
};
