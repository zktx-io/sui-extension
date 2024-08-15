import React, { useEffect, useRef, useState } from 'react';
import {
  VSCodeButton,
  VSCodeDropdown,
  VSCodeOption,
} from '@vscode/webview-ui-toolkit/react';
import { useRecoilState } from 'recoil';
import { vscode } from './utilities/vscode';

import './App.css';

import { COMMENDS } from './utilities/commends';
import { NETWORK, NETWORKS, STATE } from './recoil';
import { googleLogin } from './utilities/googleLogin';
import { createNonce } from './utilities/createNonce';

function App() {
  const initialized = useRef<boolean>(false);

  const [state, setState] = useRecoilState(STATE);
  const [network, setNetwork] = useState<NETWORK>(NETWORK.DevNet);

  const [login, setLogin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasTerminal, setHasTerminal] = useState<boolean>(false);

  const handleGoogleLogin = async () => {
    setLogin(true);
    const {
      nonce,
      expiration,
      randomness,
      ephemeralKeyPair: { publicKey, secretKey },
    } = await createNonce(network);
    setState({
      nonce: {
        expiration,
        randomness,
        network,
        publicKey,
        secretKey,
      },
    });
    await googleLogin(nonce);
  };

  useEffect(() => {
    const handleMessage = async (event: any) => {
      const message = event.data;
      switch (message.command) {
        case COMMENDS.Env:
          const { hasTerminal: terminal, proof } = message.data;
          setHasTerminal(terminal);
          proof && setState(proof);
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
      <VSCodeDropdown
        style={{ width: '100%' }}
        value={network}
        disabled={!state}
        onChange={(e) => {
          e.target && setNetwork((e.target as any).value);
        }}
      >
        {NETWORKS.map((network, index) => (
          <VSCodeOption key={index} value={network}>
            {network}
          </VSCodeOption>
        ))}
      </VSCodeDropdown>
      <br />
      <VSCodeButton
        style={{ width: '100%' }}
        disabled={login || !!state}
        onClick={handleGoogleLogin}
      >
        google login
      </VSCodeButton>
    </>
  );
}

export default App;
