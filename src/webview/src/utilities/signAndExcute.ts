import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromB64 } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import { genAddressSeed, getZkLoginSignature } from '@mysten/zklogin';
import { decodeJwt } from 'jose';
import { IAccount } from '../recoil';
import { vscode } from './vscode';
import { COMMENDS } from './commends';

export const signAndExcute = async (
  account: IAccount,
  client: SuiClient,
  transaction: Transaction,
): Promise<SuiTransactionBlockResponse> => {
  if (account.nonce.privateKey && account.zkAddress) {
    try {
      const privateKey = account.nonce.privateKey;
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
      }
      const res = await client.waitForTransaction({
        digest,
        options: { showObjectChanges: true },
      });
      vscode.postMessage({
        command: COMMENDS.OutputInfo,
        data: JSON.stringify(res, null, 4),
      });
      if (!!res.errors) {
        vscode.postMessage({
          command: COMMENDS.MsgError,
          data: `error: ${res.errors.toString()}`,
        });
        throw new Error(`${res.errors.toString()}`);
      }
      vscode.postMessage({
        command: COMMENDS.MsgInfo,
        data: `success: ${account.nonce.network}:${res.digest}`,
      });
      return res;
    } catch (error) {
      throw new Error(`${error}`);
    }
  } else {
    throw new Error('account empty');
  }
};
