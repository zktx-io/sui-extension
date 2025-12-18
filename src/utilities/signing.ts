import * as vscode from 'vscode';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import { genAddressSeed, getZkLoginSignature } from '@mysten/sui/zklogin';
import { decodeJwt } from 'jose';
import { accountLoad } from './account';

// Helper type for the webview's postMessage method
type SignTransactionResponse = {
  signature?: string;
  error?: string;
};

type PostMessage = (message: {
  command: string;
  data: SignTransactionResponse;
}) => void;

export const handleSignTransaction = async (
  context: vscode.ExtensionContext,
  data: { transactionBytes: string },
  postMessage: PostMessage,
  commandName: string,
) => {
  try {
    const { transactionBytes } = data;
    const account = await accountLoad(context);

    // 1. Validate Account existence
    if (!account || !account.nonce.privateKey || !account.zkAddress) {
      throw new Error('Account not loaded or missing private key/zkAddress');
    }

    // 2. Validate zkLogin secrets (User Upgrade)
    if (
      !account.zkAddress.jwt ||
      !account.zkAddress.salt ||
      !account.zkAddress.proof
    ) {
      throw new Error(
        'Account is missing zkLogin secrets (jwt/salt/proof). Please login again.',
      );
    }

    // 3. Prepare Secrets
    const decodedJwt = decodeJwt(account.zkAddress.jwt);
    const addressSeed = genAddressSeed(
      BigInt(account.zkAddress.salt),
      'sub',
      decodedJwt.sub!,
      decodedJwt.aud as string,
    ).toString();

    // 4. Sign with Private Key
    const keypair = Ed25519Keypair.fromSecretKey(
      fromBase64(account.nonce.privateKey),
    );
    const { signature: userSignature } = await keypair.signTransaction(
      fromBase64(transactionBytes),
    );

    // 5. Generate zkLogin Signature
    const zkLoginSignature = getZkLoginSignature({
      inputs: {
        ...JSON.parse(account.zkAddress.proof),
        addressSeed,
      },
      maxEpoch: account.nonce.expiration,
      userSignature,
    });

    // 6. Return Success
    postMessage({
      command: commandName,
      data: {
        signature: zkLoginSignature,
      },
    });
  } catch (error) {
    const errorMessage = String(error);
    vscode.window.showErrorMessage(`Signing failed: ${errorMessage}`);

    // 7. Return Error to Webview
    postMessage({
      command: commandName,
      data: {
        error: errorMessage,
      },
    });
  }
};
