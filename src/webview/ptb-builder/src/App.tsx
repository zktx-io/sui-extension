import { useEffect, useRef, useState } from 'react';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { toBase64 } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import { Chain, PTBBuilder, PTBDoc, usePTB } from '@zktx.io/ptb-builder';

import '@zktx.io/ptb-builder/index.css';
import '@zktx.io/ptb-builder/styles/themes-all.css';
import './App.css';

import { COMMANDS } from './utilities/commands';
import { vscode } from './utilities/vscode';
import { IAccount } from './utilities/account';
import { postMessage } from './utilities/postMessage';

// Typed payloads for inbound messages.
type LoadDataPayload = {
  account?: IAccount;
  ptb?: string;
  suppressSave?: boolean;
};
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
  const suppressNextSaveRef = useRef<boolean>(false);
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
      if (!account?.zkAddress) {
        postMessage('account empty or missing secrets', { variant: 'error' });
        return { error: 'account empty' };
      }

      const client = new SuiClient({ url: getFullnodeUrl(net) });
      const bytes = await transaction.build({ client });

      const signature = await new Promise<string>((resolve, reject) => {
        const handler = (event: MessageEvent) => {
          const msg = event.data;
          if (msg.command === COMMANDS.SignTransaction) {
            window.removeEventListener('message', handler);
            if (msg.data.signature) {
              resolve(msg.data.signature);
            } else {
              reject(new Error('No signature returned'));
            }
          }
        };
        window.addEventListener('message', handler);
        vscode.postMessage({
          command: COMMANDS.SignTransaction,
          data: { transactionBytes: toBase64(bytes) },
        });
        setTimeout(() => {
          window.removeEventListener('message', handler);
          reject(new Error('Signing timeout'));
        }, 30000);
      });

      const { digest, errors } = await client.executeTransactionBlock({
        transactionBlock: bytes,
        signature: signature,
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
          suppressNextSaveRef.current = Boolean(message.data?.suppressSave);
          setAccount(acc);

          // Load PTB document even without account
          if (ptbRaw) {
            // Load existing PTB file
            if (ptbRaw !== lastDocKeyRef.current) {
              const doc = JSON.parse(ptbRaw) as PTBDoc;
              lastDocKeyRef.current = ptbRaw;
              setIncomingDoc(doc);
            }
          } else if (acc) {
            // Create new PTB for network only if account exists
            const docKey = `sui:${acc.nonce.network}`;
            if (docKey !== lastDocKeyRef.current) {
              const doc = docKey as Chain;
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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isModifierPressed = event.metaKey || event.ctrlKey;
      if (!isModifierPressed) {
        return;
      }

      const target = event.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isTextInput =
          target.isContentEditable ||
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          target.getAttribute('role') === 'textbox';
        if (isTextInput) {
          return;
        }
      }

      const key = event.key.toLowerCase();
      const isUndoKey = key === 'z';
      const isRedoKey = key === 'y';

      if (!isUndoKey && !isRedoKey) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (isUndoKey && !event.shiftKey) {
        vscode.postMessage({ command: COMMANDS.RequestUndo });
        return;
      }

      vscode.postMessage({ command: COMMANDS.RequestRedo });
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
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
          if (suppressNextSaveRef.current) {
            suppressNextSaveRef.current = false;
            return;
          }
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
