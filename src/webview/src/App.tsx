import React, { useEffect, useRef, useState } from 'react';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { useRecoilState } from 'recoil';
import { vscode } from './utilities/vscode';

import './App.css';

import { COMMENDS } from './utilities/commends';
import { STATE } from './recoil';
import { googleLogin } from './utilities/googleLogin';

function App() {
  const initialized = useRef<boolean>(false);

  const [state] = useRecoilState(STATE);

  const [login, setLogin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasTerminal, setHasTerminal] = useState<boolean>(false);

  useEffect(() => {
    const handleMessage = async (event: any) => {
      const message = event.data;
      switch (message.command) {
        case COMMENDS.Env:
          const { hasTerminal: terminal } = JSON.parse(message.data);
          setHasTerminal(terminal);
          vscode.postMessage({ command: COMMENDS.PackageList, data: '' });
          break;
        case COMMENDS.LoginToken:
          // TODO
          console.log(message.data);
          break;
        default:
          break;
      }
    };

    if (!initialized.current) {
      initialized.current = true;
      window.addEventListener('message', handleMessage);
      vscode.postMessage({ command: COMMENDS.Env });
    }

    return () => {
      window.removeEventListener('message', handleMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      {!state && (
        <VSCodeButton
          style={{ width: '100%' }}
          disabled={login}
          onClick={() => {
            setLogin(true);
            googleLogin();
          }}
        >
          google login
        </VSCodeButton>
      )}
    </>
  );
}

export default App;
