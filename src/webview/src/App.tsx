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
import { COMMENDS } from './utilities/commends';
import { STATE } from './recoil';

function App() {
  const initialized = useRef<boolean>(false);
  const [hasTerminal, setHasTerminal] = useState<boolean>(false);
  const [client, setClinet] = useState<SuiClient | undefined>(undefined);
  const [state, setState] = useRecoilState(STATE);

  useEffect(() => {
    const handleMessage = async (event: any) => {
      const message = event.data;
      switch (message.command) {
        case COMMENDS.Env:
          {
            const { hasTerminal: terminal, account: loaddedAccount } =
              message.data;
            setHasTerminal(terminal);
            loaddedAccount &&
              setState((oldState) => ({
                ...oldState,
                account: { ...oldState.account, ...loaddedAccount },
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
      vscode.postMessage({ command: COMMENDS.Env });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [setState]);

  useEffect(() => {
    if (!client && state.account) {
      setClinet(
        new SuiClient({
          url: getFullnodeUrl(state.account.nonce.network),
        }),
      );
    }
  }, [client, state]);

  return (
    <>
      <Account />
      <Workspace client={client} hasTerminal={hasTerminal} />
      <ExplorerOwnerObjects client={client} />
      <ExplorerObject client={client} />
      <ExplorerPackage client={client} />
    </>
  );
}

export default App;
