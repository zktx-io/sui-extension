import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';
import { Transaction as TransactionBlock } from '@mysten/sui/transactions';
import { genAddressSeed, getZkLoginSignature } from '@mysten/zklogin';
import { decodeJwt } from 'jose';
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
      const privateKey = account.nonce.privateKey;
      const transaction = new TransactionBlock();
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
        const published = (res.objectChanges || []).filter(
          (item) => item.type === 'published',
        );
        if (published[0]) {
          return {
            digest: res.digest,
            packageId: (published[0] as any).packageId,
          };
        }
        throw new Error('publish error');
      }
    } catch (error) {
      throw new Error(`${error}`);
    }
  } else {
    throw new Error('account empty');
  }
};
