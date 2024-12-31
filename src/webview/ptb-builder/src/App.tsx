import React, { useEffect, useRef } from 'react';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { genAddressSeed, getZkLoginSignature } from '@mysten/zklogin';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import { decodeJwt } from 'jose';
import { PTB_SCHEME, PTBBuilder } from '@zktx.io/ptb-builder';

import './App.css';

import { COMMENDS } from './utilities/commends';
import { vscode } from './utilities/vscode';
import { IAccount } from './utilities/account';
import { postMessage } from './utilities/postMessage';

function App() {
  const initialized = useRef<boolean>(false);
  const [ptb, setPtb] = React.useState<PTB_SCHEME | undefined>(undefined);
  const [account, setAccount] = React.useState<IAccount | undefined>(undefined);

  const excuteTx = async (transaction: Transaction | undefined) => {
    try {
      if (
        account &&
        account.nonce.privateKey &&
        account.zkAddress &&
        transaction
      ) {
        const client = new SuiClient({
          url: getFullnodeUrl(account.nonce.network),
        });
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
          postMessage(`${JSON.stringify(errors)}`, { variant: 'error' });
        } else {
          const res = await client.waitForTransaction({
            digest,
            options: { showObjectChanges: true },
          });
          if (res.errors) {
            postMessage(`${res.errors}`, { variant: 'error' });
            vscode.postMessage({
              command: COMMENDS.OutputError,
              data: JSON.stringify(res, null, 4),
            });
          }
          postMessage(`${account.nonce.network}:${res.digest}`, {
            variant: 'success',
          });
          vscode.postMessage({
            command: COMMENDS.OutputInfo,
            data: JSON.stringify(res, null, 4),
          });
        }
      } else {
        postMessage(`account empty: ${account}`, { variant: 'error' });
      }
    } catch (error) {
      postMessage(`${error}`, { variant: 'error' });
    }
  };

  useEffect(() => {
    const handleMessage = (event: any) => {
      const message = event.data;
      switch (message.command) {
        case COMMENDS.LoadData:
          setAccount(message.data.account);
          setPtb(
            message.data.ptb !== undefined && message.data.ptb !== ''
              ? JSON.parse(message.data.ptb)
              : { version: '2', modules: {} },
          );
          initialized.current = true;
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', handleMessage);

    if (!initialized.current) {
      vscode.postMessage({ command: COMMENDS.LoadData });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <PTBBuilder
        wallet={account?.zkAddress?.address}
        network={account?.nonce?.network}
        options={{ canEdit: true }}
        excuteTx={excuteTx}
        restore={ptb}
        update={(data: PTB_SCHEME) => {
          initialized.current &&
            vscode.postMessage({
              command: COMMENDS.SaveData,
              data: JSON.stringify(data),
            });
        }}
        enqueueToast={(message, options) =>
          postMessage(message, { variant: options.variant })
        }
      />
    </div>
  );
}

export default App;
