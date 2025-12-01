import { useEffect, useRef, useState } from 'react';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { genAddressSeed, getZkLoginSignature } from '@mysten/sui/zklogin';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { fromBase64 } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import { decodeJwt } from 'jose';
import { Chain, PTBBuilder, PTBDoc, usePTB } from '@zktx.io/ptb-builder';

import '@zktx.io/ptb-builder/index.css';
import './App.css';

import { COMMANDS } from './utilities/commands';
import { vscode } from './utilities/vscode';
import { IAccount } from './utilities/account';
import { postMessage } from './utilities/postMessage';

// Typed payloads for inbound messages.
type LoadDataPayload = { account?: IAccount; ptb?: string };
type UpdateStatePayload = { account?: IAccount };

// Union for inbound webview messages we handle.
type InboundMessage =
  | { command: COMMANDS.LoadData; data?: LoadDataPayload }
  | { command: COMMANDS.UpdateState; data?: UpdateStatePayload }
  | { command?: string; data?: unknown };

// Type guards for runtime narrowing.
function isLoadData(
  msg: unknown,
): msg is { command: COMMANDS.LoadData; data?: LoadDataPayload } {
  if (typeof msg !== 'object' || msg === null) return false;
  return (msg as { command?: unknown }).command === COMMANDS.LoadData;
}

function isUpdateState(
  msg: unknown,
): msg is { command: COMMANDS.UpdateState; data?: UpdateStatePayload } {
  if (typeof msg !== 'object' || msg === null) return false;
  return (msg as { command?: unknown }).command === COMMANDS.UpdateState;
}

// Bridge that only calls loadFromDoc when a new incomingDoc arrives.
export const PTBBridge = ({
  incomingDoc,
}: {
  incomingDoc?: PTBDoc | Chain;
}) => {
  const { loadFromDoc } = usePTB();
  useEffect(() => {
    if (!incomingDoc) return;
    loadFromDoc(incomingDoc);
  }, [incomingDoc, loadFromDoc]);
  return <></>;
};

function App() {
  const initializedRef = useRef<boolean>(false);
  const lastDocKeyRef = useRef<string | undefined>(undefined);
  const [account, setAccount] = useState<IAccount | undefined>(undefined);
  const [incomingDoc, setIncomingDoc] = useState<PTBDoc | Chain | undefined>(
    undefined,
  );

  // Sui execution adapter
  const executeTx = async (
    chain: Chain,
    transaction?: Transaction,
  ): Promise<{ digest?: string; error?: string }> => {
    try {
      if (!transaction) return { error: 'empty transaction' };

      const parts = String(chain).split(':');
      const net = (parts[1] ?? '') as 'mainnet' | 'testnet' | 'devnet';
      if (!net) return { error: `invalid chain: ${chain}` };

      if (account?.nonce?.network && account.nonce.network !== net) {
        postMessage(
          `network mismatch: doc=${net} / acct=${account.nonce.network}`,
          { variant: 'warning' },
        );
      }
      if (!account?.nonce?.privateKey || !account.zkAddress) {
        postMessage('account empty or missing secrets', { variant: 'error' });
        return { error: 'account empty' };
      }

      const client = new SuiClient({ url: getFullnodeUrl(net) });
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
        inputs: { ...JSON.parse(account.zkAddress.proof), addressSeed },
        maxEpoch: account.nonce.expiration,
        userSignature,
      });

      const { digest, errors } = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature: zkLoginSignature,
      });

      if (errors && errors.length > 0) {
        postMessage(`${JSON.stringify(errors)}`, { variant: 'error' });
        return { error: JSON.stringify(errors) };
      }

      const res = await client.waitForTransaction({
        digest,
        options: { showObjectChanges: true },
      });

      if (res.errors) {
        postMessage(`${res.errors}`, { variant: 'error' });
        vscode.postMessage({
          command: COMMANDS.OutputError,
          data: JSON.stringify(res, null, 4),
        });
        return { error: JSON.stringify(res.errors) };
      }

      postMessage(`${net}:${res.digest}`, { variant: 'success' });
      vscode.postMessage({
        command: COMMANDS.OutputInfo,
        data: JSON.stringify(res, null, 4),
      });
      return { digest: res.digest };
    } catch (error) {
      postMessage(String(error), { variant: 'error' });
      return { error: String(error) };
    }
  };

  // Receive messages from the extension (typed)
  useEffect(() => {
    const handleMessage = (event: MessageEvent<InboundMessage>) => {
      const message = event.data;

      if (isLoadData(message)) {
        try {
          const acc = message.data?.account as IAccount | undefined;
          const ptbRaw = message.data?.ptb as string | undefined;
          setAccount(acc);
          if (acc) {
            const docKey = ptbRaw ?? `sui:${acc.nonce.network}`;
            if (docKey !== lastDocKeyRef.current) {
              const doc = !ptbRaw
                ? (`sui:${acc.nonce.network}` as Chain)
                : (JSON.parse(ptbRaw) as PTBDoc);
              lastDocKeyRef.current = docKey;
              setIncomingDoc(doc);
            }
          }
          initializedRef.current = true;
        } catch (error) {
          postMessage(String(error), { variant: 'error' });
        }
        return;
      }

      if (isUpdateState(message)) {
        const acc = message.data?.account as IAccount | undefined;
        setAccount(acc);
        return;
      }

      // Ignore unknown commands silently
    };

    window.addEventListener('message', handleMessage as EventListener);
    if (!initializedRef.current) {
      vscode.postMessage({ command: COMMANDS.LoadData });
    }
    return () =>
      window.removeEventListener('message', handleMessage as EventListener);
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <PTBBuilder
        toast={({ message, variant }) => {
          if (variant) postMessage(message, { variant });
        }}
        executeTx={executeTx}
        address={account?.zkAddress?.address}
        onDocChange={(doc) => {
          const serialized = JSON.stringify(doc);
          lastDocKeyRef.current = serialized;
          // Single source of truth for persistence: stringify once and send to extension.
          vscode.postMessage({
            command: COMMANDS.SaveData,
            data: serialized,
          });
        }}
      >
        <PTBBridge incomingDoc={incomingDoc} />
      </PTBBuilder>
    </div>
  );
}

export default App;
