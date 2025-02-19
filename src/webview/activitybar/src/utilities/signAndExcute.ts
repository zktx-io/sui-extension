import { SuiClient, SuiTransactionBlockResponse } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import { genAddressSeed, getZkLoginSignature } from '@mysten/sui/zklogin';
import { decodeJwt } from 'jose';
import { IAccount } from '../recoil';
import { vscode } from './vscode';
import { COMMANDS } from './commands';

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
        signer: Ed25519Keypair.fromSecretKey(fromBase64(privateKey)),
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
