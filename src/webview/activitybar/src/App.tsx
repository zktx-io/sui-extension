import { useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';

import './App.css';

import { vscode } from './utilities/vscode';
import { Account } from './components/Account';
import { ExplorerOwnerObjects } from './components/ExplorerOwnerObjects';
import { ExplorerObject } from './components/ExplorerObject';
import { ExplorerPackage } from './components/ExplorerPackage';
import { Workspace } from './components/Workspace';
import { COMMANDS } from './utilities/commands';
import { IAccount, STATE } from './recoil';

function App() {
  const initialized = useRef<boolean>(false);
  const [hasTerminal, setHasTerminal] = useState<boolean>(false);
  const [client, setClinet] = useState<SuiClient | undefined>(undefined);
  const [state, setState] = useRecoilState(STATE);

  useEffect(() => {
    const handleMessage = async (
      event: MessageEvent<{
        command: COMMANDS;
        data: {
          hasTerminal: boolean;
          account?: IAccount;
          canSign?: boolean;
        };
      }>,
    ) => {
      const message = event.data;
      switch (message.command) {
        case COMMANDS.Env:
          {
            const {
              hasTerminal: terminal,
              account: loaddedAccount,
              canSign,
            } = message.data;
            setHasTerminal(terminal);
            setState((oldState) => ({
              ...oldState,
              account: loaddedAccount ? loaddedAccount : undefined,
              canSign: Boolean(canSign),
            }));
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', handleMessage);

    if (!initialized.current) {
      initialized.current = true;
      vscode.postMessage({ command: COMMANDS.Env });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [setState]);

  useEffect(() => {
    if (state.account) {
      setClinet(
        new SuiClient({
          url: getFullnodeUrl(state.account.nonce.network),
        }),
      );
    } else {
      setClinet(undefined);
    }
  }, [state.account]);

  return (
    <>
      <Account client={client} />
      <Workspace client={client} hasTerminal={hasTerminal} />
      <ExplorerOwnerObjects client={client} />
      <ExplorerObject client={client} />
      <ExplorerPackage client={client} />
    </>
  );
}

export default App;
