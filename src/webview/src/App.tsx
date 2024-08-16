import { useEffect, useRef, useState } from 'react';
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { useRecoilState } from 'recoil';
import { parse } from 'smol-toml';

import './App.css';

import { ACCOUNT, NETWORK, NETWORKS } from './recoil';
import { vscode } from './utilities/vscode';
import { COMMENDS } from './utilities/commends';
import { googleLogin } from './utilities/googleLogin';
import { createNonce } from './utilities/createNonce';
import { createProof } from './utilities/createProof';

import { packagePublish } from './utilities/packagePublish';
import { packageUpgrade } from './utilities/packageUpgrade';
import { getBalance } from './utilities/getBalance';

function App() {
  const initialized = useRef<boolean>(false);

  const [account, setAccount] = useRecoilState(ACCOUNT);
  const [network, setNetwork] = useState<NETWORK>(NETWORK.DevNet);
  const [balance, setBalance] = useState<string>('n/a');

  const [login, setLogin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [hasTerminal, setHasTerminal] = useState<boolean>(false);

  const [selectedPath, setSelectedPath] = useState<string | undefined>(
    undefined,
  );
  const [fileList, setFileList] = useState<
    { path: string; name: string; version: string }[]
  >([]);
  const [upgradeToml, setUpgradeToml] = useState<string>('');

  const handleLogin = async () => {
    setLogin(true);
    const {
      nonce,
      expiration,
      randomness,
      ephemeralKeyPair: { publicKey, privateKey },
    } = await createNonce(network);
    setAccount({
      nonce: {
        expiration,
        randomness,
        network,
        publicKey,
        privateKey,
      },
    });
    await googleLogin(nonce);
  };

  const handleLogout = async () => {
    vscode.postMessage({
      command: COMMENDS.StoreAccount,
      data: undefined,
    });
    setAccount(undefined);
  };

  useEffect(() => {
    const updateBalance = async () => {
      try {
        const value = account && (await getBalance(account));
        setBalance(value || 'n/a');
      } catch (error) {
        setBalance('n/a');
      }
    };

    const handleMessage = async (event: any) => {
      const message = event.data;
      switch (message.command) {
        case COMMENDS.Env:
          {
            const { hasTerminal: terminal, account: loadedAccpimt } =
              message.data;
            setHasTerminal(terminal);
            if (loadedAccpimt) {
              setAccount(loadedAccpimt);
            }
          }
          break;
        case COMMENDS.LoginJwt:
          if (account && message.data) {
            const { address, proof, salt } = await createProof(
              account.nonce,
              message.data,
            );
            setAccount({
              ...account,
              zkAddress: {
                address,
                proof,
                salt,
                jwt: message.data,
              },
            });
            vscode.postMessage({
              command: COMMENDS.StoreAccount,
              data: {
                ...account,
                zkAddress: {
                  address,
                  proof,
                  salt,
                  jwt: message.data,
                },
              },
            });
            setLogin(false);
          } else {
            setLogin(false);
          }
          break;
        case COMMENDS.PackageList:
          {
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
          }
          break;
        case COMMENDS.PackageSelect:
          {
            const { path, data } = message.data;
            setSelectedPath(path);
            setUpgradeToml(data);
          }
          break;
        case COMMENDS.Deploy:
          try {
            if (!upgradeToml && !!account?.zkAddress) {
              const res = await packagePublish(account, message.data);
              vscode.postMessage({
                command: COMMENDS.MsgInfo,
                data: `success: ${account.nonce.network}:${res.digest}`,
              });
            } else if (!!account?.zkAddress) {
              const res = await packageUpgrade(
                account,
                message.data,
                upgradeToml,
              );
              vscode.postMessage({
                command: COMMENDS.MsgInfo,
                data: `success: ${account.nonce.network}:${res.digest}`,
              });
            }
          } catch (error) {
            vscode.postMessage({
              command: COMMENDS.MsgError,
              data: `${error}`,
            });
          } finally {
            setLoading(false);
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

    updateBalance();

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [account, selectedPath, setAccount, upgradeToml]);

  return (
    <>
      <label style={{ fontSize: '11px', color: 'GrayText' }}>ACCOUNT</label>
      <VSCodeTextField
        style={{ width: '100%' }}
        readOnly
        value={account?.zkAddress?.address || ''}
      />
      <div
        style={{
          fontSize: '11px',
          color: 'GrayText',
          marginBottom: '8px',
          textAlign: 'right',
        }}
      >{`Balance: ${balance}`}</div>

      <label style={{ fontSize: '11px', color: 'GrayText' }}>NETWORK</label>
      <VSCodeDropdown
        style={{ width: '100%', marginBottom: '8px' }}
        value={network}
        disabled={!!account?.zkAddress?.address || login}
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
      {!account?.zkAddress ? (
        <VSCodeButton
          style={{ width: '100%' }}
          disabled={login}
          onClick={handleLogin}
        >
          {!login ? (
            'Google Login'
          ) : (
            <svg
              id="loading-spinner"
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 48 48"
            >
              <g fill="none">
                <path
                  id="track"
                  fill="#C6CCD2"
                  d="M24,48 C10.745166,48 0,37.254834 0,24 C0,10.745166 10.745166,0 24,0 C37.254834,0 48,10.745166 48,24 C48,37.254834 37.254834,48 24,48 Z M24,44 C35.045695,44 44,35.045695 44,24 C44,12.954305 35.045695,4 24,4 C12.954305,4 4,12.954305 4,24 C4,35.045695 12.954305,44 24,44 Z"
                />
                <path
                  id="section"
                  fill="#3F4850"
                  d="M24,0 C37.254834,0 48,10.745166 48,24 L44,24 C44,12.954305 35.045695,4 24,4 L24,0 Z"
                />
              </g>
            </svg>
          )}
        </VSCodeButton>
      ) : (
        <VSCodeButton
          style={{ width: '100%' }}
          disabled={login}
          onClick={handleLogout}
        >
          Logout
        </VSCodeButton>
      )}
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

      <VSCodeButton
        style={{ width: '100%', marginBottom: '8px' }}
        disabled={
          !hasTerminal ||
          !selectedPath ||
          !account?.zkAddress?.address ||
          loading
        }
        onClick={() => {
          const selected = fileList.find((item) => item.path === selectedPath);
          if (selected) {
            setLoading(true);
            vscode.postMessage({
              command: COMMENDS.Deploy,
              data: selected.path,
            });
          }
        }}
      >
        {!upgradeToml ? 'Deploy' : 'Upgrade'}
      </VSCodeButton>
    </>
  );
}

export default App;
