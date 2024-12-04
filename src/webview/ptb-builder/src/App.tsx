import React, { useEffect, useRef } from 'react';
import { enqueueSnackbar } from 'notistack';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { genAddressSeed, getZkLoginSignature } from '@mysten/zklogin';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import { decodeJwt } from 'jose';
import { PTBBuilder } from '@zktx.io/ptb-builder';

import './App.css';

import { COMMENDS } from './utilities/commends';
import { vscode } from './utilities/vscode';
import { IAccount } from './utilities/account';

function App() {
  const initialized = useRef<boolean>(false);
  const [ptbJson, setPtbJson] = React.useState<string | undefined>(undefined);
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
        transaction.setSender(account.zkAddress.address);
        transaction.setGasOwner(account.zkAddress.address);
        transaction.setGasBudget(10000000);
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
          enqueueSnackbar(`${JSON.stringify(errors)}`, { variant: 'error' });
        } else {
          const res = await client.waitForTransaction({
            digest,
            options: { showObjectChanges: true },
          });
          if (!!res.errors) {
            enqueueSnackbar(`${res.errors}`, { variant: 'error' });
          }
          enqueueSnackbar(`${res.digest}`, { variant: 'success' });
        }
      } else {
        enqueueSnackbar(`account empty: ${account}`, { variant: 'error' });
      }
    } catch (error) {
      enqueueSnackbar(`${error}`, { variant: 'error' });
    }
  };

  useEffect(() => {
    const handleMessage = (event: any) => {
      const message = event.data;
      switch (message.command) {
        case COMMENDS.LoadData:
          setAccount(message.data.account);
          setPtbJson(message.data.ptb);
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', handleMessage);

    if (!initialized.current) {
      initialized.current = true;
      vscode.postMessage({ command: COMMENDS.LoadData });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <PTBBuilder
        address={account?.zkAddress?.address}
        txbOrPtb={ptbJson}
        options={{ isEditor: true }}
        excuteTx={excuteTx}
        update={(data: string) => {
          initialized.current &&
            vscode.postMessage({ command: COMMENDS.SaveData, data });
        }}
      />
    </div>
  );
}

export default App;
