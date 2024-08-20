import { useEffect, useRef, useState } from 'react';

import './App.css';

import { vscode } from './utilities/vscode';
import { Account, AccountHandles } from './components/Account';
import {
  PackageExplorer,
  PackageExplorerHandles,
} from './components/PackageExplorer';
import { Workspace } from './components/Workspace';
import { COMMENDS } from './utilities/commends';
import { useRecoilState } from 'recoil';
import { ACCOUNT } from './recoil';

function App() {
  const initialized = useRef<boolean>(false);
  const refAccount = useRef<AccountHandles>(null);
  const refPackageManager = useRef<PackageExplorerHandles>(null);
  const [hasTerminal, setHasTerminal] = useState<boolean>(false);
  const [, setAccount] = useRecoilState(ACCOUNT);

  useEffect(() => {
    const handleMessage = async (event: any) => {
      const message = event.data;
      switch (message.command) {
        case COMMENDS.Env:
          {
            const {
              hasTerminal: terminal,
              account: loaddedAccount,
              state,
            } = message.data;
            setHasTerminal(terminal);
            loaddedAccount && setAccount(loaddedAccount);
            state &&
              state.path &&
              vscode.postMessage({
                command: COMMENDS.PackageSelect,
                data: state.path,
              });
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
  }, [setAccount]);

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
      <PackageExplorer ref={refPackageManager} />
    </>
  );
}

export default App;
