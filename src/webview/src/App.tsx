import { useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';

import './App.css';

import { vscode } from './utilities/vscode';
import { Account, AccountHandles } from './components/Account';
import { ExplorerObject } from './components/ExplorerObject';
import {
  ExplorerPackage,
  ExplorerPackageHandles,
} from './components/ExplorerPackage';
import { Workspace } from './components/Workspace';
import { COMMENDS } from './utilities/commends';
import { STATE } from './recoil';

function App() {
  const initialized = useRef<boolean>(false);
  const refAccount = useRef<AccountHandles>(null);
  const refPackageManager = useRef<ExplorerPackageHandles>(null);
  const [hasTerminal, setHasTerminal] = useState<boolean>(false);
  const [, setState] = useRecoilState(STATE);

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

  return (
    <>
      <Account ref={refAccount} />
      <Workspace
        hasTerminal={hasTerminal}
        update={(packageId: string) => {
          refAccount.current?.updateBalance();
          refPackageManager.current?.addPackage(packageId);
        }}
      />
      <ExplorerObject />
      <ExplorerPackage ref={refPackageManager} />
    </>
  );
}

export default App;
