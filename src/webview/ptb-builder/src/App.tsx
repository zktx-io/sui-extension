import React, { useCallback, useEffect, useRef } from 'react';
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
import { postMessage } from './utilities/postMessage';

function App() {
  const initialized = useRef<boolean>(false);
  const [ptbJson, setPtbJson] = React.useState<string | undefined>(undefined);
  const [account, setAccount] = React.useState<IAccount | undefined>(undefined);
  const [transaction, setTransaction] = React.useState<Transaction | undefined>(
    undefined,
  );

  const excuteTx = async (tx: Transaction | undefined) => {
    try {
      if (account && account.nonce.privateKey && account.zkAddress && tx) {
        setTransaction(undefined);
        await signAndExcuteTx(account, tx);
      } else {
        setTransaction(tx);
        vscode.postMessage({ command: COMMENDS.GetAccountAndSignTx });
        const updatedAccount = await waitForAccount();
        if (updatedAccount) {
          await signAndExcuteTx(updatedAccount, tx);
        } else {
          postMessage(`Account retrieval failed.`, { variant: 'error' });
        }
      }
    } catch (error) {
      postMessage(`${error}`, { variant: 'error' });
    }
  };

  const waitForAccount = (): Promise<IAccount | undefined> => {
    return new Promise((resolve) => {
      const handleMessage = (event: any) => {
        const message = event.data;
        if (message.command === COMMENDS.GetAccountAndSignTx) {
          window.removeEventListener('message', handleMessage);
          resolve(message.data);
        }
      };
      window.addEventListener('message', handleMessage);
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        resolve(undefined);
      }, 10000);
    });
  };

  const signAndExcuteTx = useCallback(
    async (_account: IAccount, _tx?: Transaction) => {
      try {
        const tx = _tx || transaction;
        if (_account && _account.nonce.privateKey && _account.zkAddress && tx) {
          const client = new SuiClient({
            url: getFullnodeUrl(_account.nonce.network),
          });
          const privateKey = _account.nonce.privateKey;
          const decodedJwt = decodeJwt(_account.zkAddress.jwt);
          const addressSeed: string = genAddressSeed(
            BigInt(_account.zkAddress.salt),
            'sub',
            decodedJwt.sub!,
            decodedJwt.aud as string,
          ).toString();
          tx.setSender(_account.zkAddress.address);
          tx.setGasOwner(_account.zkAddress.address);
          tx.setGasBudget(10000000);
          const { bytes, signature: userSignature } = await tx.sign({
            client,
            signer: Ed25519Keypair.fromSecretKey(fromBase64(privateKey)),
          });
          const zkLoginSignature = getZkLoginSignature({
            inputs: {
              ...JSON.parse(_account.zkAddress.proof),
              addressSeed,
            },
            maxEpoch: _account.nonce.expiration,
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
            if (!!res.errors) {
              postMessage(`${res.errors}`, { variant: 'error' });
              vscode.postMessage({
                command: COMMENDS.OutputError,
                data: JSON.stringify(res, null, 4),
              });
            }
            postMessage(`${_account.nonce.network}:${res.digest}`, {
              variant: 'success',
            });
            vscode.postMessage({
              command: COMMENDS.OutputInfo,
              data: JSON.stringify(res, null, 4),
            });
          }
        } else {
          postMessage(`account empty: ${_account}`, { variant: 'error' });
        }
      } catch (error) {
        postMessage(`${error}`, { variant: 'error' });
      }
    },
    [transaction],
  );

  useEffect(() => {
    const handleMessage = (event: any) => {
      const message = event.data;
      switch (message.command) {
        case COMMENDS.GetAccountAndSignTx:
          setAccount(message.data);
          signAndExcuteTx(message.data);
          setTransaction(undefined);
          break;
        case COMMENDS.LoadData:
          setAccount(message.data.account);
          setPtbJson(message.data.ptb);
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
  }, [signAndExcuteTx]);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <PTBBuilder
        address={account?.zkAddress?.address}
        network={account?.nonce?.network}
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
