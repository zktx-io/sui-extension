import React, { useEffect, useRef, useState } from 'react';
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { useRecoilState } from 'recoil';
import { parse } from 'smol-toml';

import { NETWORK, NETWORKS, STATE } from './recoil';
import { vscode } from './utilities/vscode';
import { COMMENDS } from './utilities/commends';
import { googleLogin } from './utilities/googleLogin';
import { createNonce } from './utilities/createNonce';
import { createProof } from './utilities/createProof';

import './App.css';

function App() {
  const [state, setState] = useRecoilState(STATE);
  const [network, setNetwork] = useState<NETWORK>(NETWORK.DevNet);

  const [login, setLogin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasTerminal, setHasTerminal] = useState<boolean>(false);
  const [address, setAddress] = useState<string | undefined>(undefined);

  const [selectedPath, setSelectedPath] = useState<string | undefined>(
    undefined,
  );
  const [fileList, setFileList] = useState<
    { path: string; name: string; version: string }[]
  >([]);
  const [upgradeToml, setUpgradeToml] = useState<string>('');

  const refAddress = useRef(address);
  const refNetwork = useRef(network);
  const refUpgradeToml = useRef(upgradeToml);

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
          {
            const { hasTerminal: terminal, proof } = message.data;
            setHasTerminal(terminal);
            proof && setState(proof);
          }
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
        case COMMENDS.PackageList:
          const temp = (
            message.data as { path: string; content: string }[]
          ).map(({ path, content }) => {
            const parsed = parse(content);
            return {
              path,
              name: (parsed.package as any).name,
              version: (parsed.package as any).version,
            };
          });
          setFileList(temp);
          if (temp.length > 0) {
            const tempPath =
              selectedPath && temp.find(({ path }) => path === selectedPath)
                ? selectedPath
                : temp[0].path;
            vscode.postMessage({
              command: COMMENDS.PackageSelect,
              data: tempPath,
            });
          } else {
            setSelectedPath(undefined);
            setUpgradeToml('');
          }
          break;
        case COMMENDS.PackageSelect:
          const { path, upgradeToml } = message.data;
          setSelectedPath(path);
          setUpgradeToml(upgradeToml);
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
  }, [selectedPath, setState, state]);

  return (
    <>
      <label style={{ fontSize: '11px', color: 'GrayText' }}>ACCOUNT</label>
      <VSCodeTextField
        style={{ width: '100%', marginBottom: '8px' }}
        readOnly
        value={address || ''}
      />

      <label style={{ fontSize: '11px', color: 'GrayText' }}>NETWORK</label>
      <VSCodeDropdown
        style={{ width: '100%', marginBottom: '8px' }}
        value={network}
        disabled={!!state || !!address}
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
      <VSCodeButton
        style={{ width: '100%' }}
        disabled={login}
        onClick={handleGoogleLogin}
      >
        Google Login
      </VSCodeButton>
      <VSCodeDivider style={{ marginTop: '10px', marginBottom: '8px' }} />

      <label style={{ fontSize: '11px', color: 'GrayText' }}>PACKAGE</label>
      <VSCodeDropdown
        style={{ width: '100%', marginBottom: '8px' }}
        value={selectedPath}
        onChange={(e) => {
          if (e.target) {
            const path = (e.target as any).value;
            path &&
              vscode.postMessage({
                command: COMMENDS.PackageSelect,
                data: path,
              });
          }
        }}
      >
        {fileList.map(({ path, name, version }, index) => (
          <VSCodeOption key={index} value={path}>
            {`${name} (v${version})`}
          </VSCodeOption>
        ))}
      </VSCodeDropdown>

      <VSCodeButton
        style={{ width: '100%', marginBottom: '8px' }}
        disabled={!hasTerminal || !selectedPath}
        onClick={() => {
          vscode.postMessage({
            command: COMMENDS.Compile,
            data: selectedPath,
          });
        }}
      >
        Compile
      </VSCodeButton>

      <VSCodeButton
        style={{
          width: '100%',
          marginBottom: '8px',
          backgroundColor: '#ff9800',
        }}
        disabled={!hasTerminal || !selectedPath}
        onClick={() => {
          vscode.postMessage({
            command: COMMENDS.UintTest,
            data: selectedPath,
          });
        }}
      >
        Unit Test
      </VSCodeButton>
    </>
  );
}

export default App;
