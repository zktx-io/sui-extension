import { useEffect, useRef, useState } from 'react';
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeDropdown,
  VSCodeOption,
} from '@vscode/webview-ui-toolkit/react';
import { useRecoilState } from 'recoil';
import { parse } from 'smol-toml';

import './App.css';

import { ACCOUNT } from './recoil';
import { SpinButton } from './components/SpinButton';
import { vscode } from './utilities/vscode';
import { COMMENDS } from './utilities/commends';

import { Account, AccountHandles } from './components/Account';
import { packagePublish } from './utilities/packagePublish';
import { packageUpgrade } from './utilities/packageUpgrade';
import {
  PackageManager,
  PackageManagerHandles,
} from './components/PackageManager';

function App() {
  const refAccount = useRef<AccountHandles>(null);
  const refPackageManager = useRef<PackageManagerHandles>(null);

  const [account] = useRecoilState(ACCOUNT);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedPath, setSelectedPath] = useState<string | undefined>(
    undefined,
  );
  const [fileList, setFileList] = useState<
    { path: string; name: string; version: string }[]
  >([]);
  const [upgradeToml, setUpgradeToml] = useState<string>('');

  useEffect(() => {
    const handleMessage = async (event: any) => {
      const message = event.data;
      switch (message.command) {
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
              refAccount.current?.updateBalance();
              refPackageManager.current?.addPackage(res.packageId);
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
              refAccount.current?.updateBalance();
              refPackageManager.current?.addPackage(res.packageId);
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

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [account, selectedPath, upgradeToml]);

  return (
    <>
      <Account ref={refAccount} />

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
        disabled={!refAccount.current?.hasTerminal || !selectedPath}
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
        disabled={!refAccount.current?.hasTerminal || !selectedPath}
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
          !refAccount.current?.hasTerminal ||
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
      <PackageManager ref={refPackageManager} />
    </>
  );
}

export default App;
