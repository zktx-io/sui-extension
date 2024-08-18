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
import { SpinButton } from './components/SpinButton';
import { vscode } from './utilities/vscode';
import { COMMENDS } from './utilities/commends';
import { googleLogin } from './utilities/googleLogin';
import { createNonce } from './utilities/createNonce';
import { createProof } from './utilities/createProof';

import { packagePublish } from './utilities/packagePublish';
import { packageUpgrade } from './utilities/packageUpgrade';
import { getBalance } from './utilities/getBalance';
import {
  PackageManager,
  PackageManagerHandles,
} from './components/PackageManager';

function App() {
  const initialized = useRef<boolean>(false);
  const ref = useRef<PackageManagerHandles>(null);

  const [account, setAccount] = useRecoilState(ACCOUNT);
  const [network, setNetwork] = useState<NETWORK>(NETWORK.DevNet);
  const [balance, setBalance] = useState<string>('n/a');

  const [isLogin, setIsLogin] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [hasTerminal, setHasTerminal] = useState<boolean>(false);

  const [selectedPath, setSelectedPath] = useState<string | undefined>(
    undefined,
  );
  const [fileList, setFileList] = useState<
    { path: string; name: string; version: string }[]
  >([]);
  const [upgradeToml, setUpgradeToml] = useState<string>('');

  const handleLogin = async () => {
    setIsLogin(true);
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
            try {
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
            } catch (error) {
              vscode.postMessage({
                command: COMMENDS.MsgError,
                data: `${error}`,
              });
            } finally {
              setIsLogin(false);
            }
          } else {
            setIsLogin(false);
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
              const value = account && (await getBalance(account));
              setBalance(value || 'n/a');
              ref.current?.addPackage(res.packageId);
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
              const value = account && (await getBalance(account));
              setBalance(value || 'n/a');
              ref.current?.addPackage(res.packageId);
            }
          } catch (error) {
            vscode.postMessage({
              command: COMMENDS.MsgError,
              data: `${error}`,
            });
          } finally {
            setIsLoading(false);
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
        disabled={!!account?.zkAddress?.address || isLogin}
        onChange={(e) => {
          e.target &&
            setNetwork((e.target as HTMLInputElement).value as NETWORK);
        }}
      >
        {NETWORKS.map((network, index) => (
          <VSCodeOption key={index} value={network}>
            {network}
          </VSCodeOption>
        ))}
      </VSCodeDropdown>
      {!account?.zkAddress ? (
        <SpinButton
          title="Google Login"
          spin={isLogin}
          disabled={isLogin}
          width="100%"
          onClick={handleLogin}
        />
      ) : (
        <VSCodeButton
          style={{ width: '100%' }}
          disabled={isLogin}
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
            const path = (e.target as HTMLInputElement).value;
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

      <SpinButton
        title={!upgradeToml ? 'Deploy' : 'Upgrade'}
        spin={isLoading}
        disabled={
          !hasTerminal ||
          !selectedPath ||
          !account?.zkAddress?.address ||
          isLoading
        }
        width="100%"
        onClick={() => {
          const selected = fileList.find((item) => item.path === selectedPath);
          if (selected) {
            setIsLoading(true);
            vscode.postMessage({
              command: COMMENDS.Deploy,
              data: selected.path,
            });
          }
        }}
      />
      <PackageManager ref={ref} />
    </>
  );
}

export default App;
