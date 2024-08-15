import React, { useEffect, useState } from 'react';
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { useRecoilState } from 'recoil';
import { vscode } from './utilities/vscode';

import './App.css';

import { COMMENDS } from './utilities/commends';
import { NETWORK, NETWORKS, STATE } from './recoil';
import { googleLogin } from './utilities/googleLogin';
import { createNonce } from './utilities/createNonce';
import { createProof } from './utilities/createProof';

function App() {
  const [state, setState] = useRecoilState(STATE);
  const [network, setNetwork] = useState<NETWORK>(NETWORK.DevNet);

  const [login, setLogin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasTerminal, setHasTerminal] = useState<boolean>(false);
  const [address, setAddress] = useState<string | undefined>(undefined);

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
          if (state && message.data) {
            setLogin(false);
            const { proof, address, salt } = await createProof(
              state.nonce,
              message.data,
            );
            setAddress(address);
            setState({
              ...state,
              zkAddress: {
                address,
                proof,
                salt,
                jwt: message.data,
              },
            });
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    vscode.postMessage({ command: COMMENDS.Env });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <>
      <VSCodeDropdown
        style={{ width: '100%', marginBottom: '8px' }}
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
      <VSCodeDivider style={{ marginTop: '10px', marginBottom: '8px' }} />
      <label style={{ fontSize: '11px', color: 'GrayText' }}>ACCOUNT</label>
      <VSCodeTextField
        style={{ width: '100%' }}
        readOnly
        value={address || ''}
      />
    </>
  );
}

export default App;
