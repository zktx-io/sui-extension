import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { parse } from 'smol-toml';
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeDropdown,
  VSCodeOption,
} from '@vscode/webview-ui-toolkit/react';
import { vscode } from '../utilities/vscode';
import { COMMENDS } from '../utilities/commends';
import { SpinButton } from './SpinButton';
import { STATE } from '../recoil';
import { packageUpgrade } from '../utilities/packageUpgrade';
import { packagePublish } from '../utilities/packagePublish';
import { dataGet, packageSelect } from '../utilities/stateController';
import { getBalance } from '../utilities/getBalance';

export const Workspace = ({
  hasTerminal,
  update,
}: {
  hasTerminal: boolean;
  update: (packageId: string) => void;
}) => {
  const [state, setState] = useRecoilState(STATE);
  const [isLoading, setIsLoading] = useState<boolean>(false);
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
              const data = dataGet();
              const tempPath =
                data.path && temp.find(({ path }) => path === data.path)
                  ? data.path
                  : temp[0].path;
              setState((oldState) => ({
                ...oldState,
                ...packageSelect(tempPath),
              }));
            } else {
              setState((oldState) => ({ ...oldState, ...packageSelect() }));
              setUpgradeToml('');
            }
          }
          break;
        case COMMENDS.Deploy:
          try {
            if (!!state.account?.zkAddress) {
              if (!upgradeToml) {
                const { packageId } = await packagePublish(
                  state.account,
                  message.data,
                );
                const balance = await getBalance(state.account);
                setState((oldState) => ({ ...oldState, balance }));
                update(packageId);
              } else {
                const { packageId } = await packageUpgrade(
                  state.account,
                  message.data,
                  upgradeToml,
                );
                const balance = await getBalance(state.account);
                setState((oldState) => ({ ...oldState, balance }));
                update(packageId);
              }
            }
          } catch (e) {
            console.error(e);
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
  }, [setState, state, update, upgradeToml]);

  return (
    <>
      <div
        style={{
          width: '100%',
          padding: '6px 0',
          fontWeight: 'bold',
          marginTop: '8px',
          marginBottom: '4px',
        }}
      >
        Workspace
        <VSCodeDivider />
      </div>
      <label style={{ fontSize: '11px', color: 'GrayText' }}>PACKAGE</label>
      <VSCodeDropdown
        style={{ width: '100%', marginBottom: '8px' }}
        value={state.path}
        disabled={!state.account || !state.account.zkAddress}
        onChange={(e) => {
          if (e.target) {
            const path = (e.target as HTMLInputElement).value;
            path &&
              setState((oldState) => ({ ...oldState, ...packageSelect(path) }));
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
        disabled={
          !hasTerminal ||
          !state.account ||
          !state.account.zkAddress ||
          !state.path
        }
        onClick={() => {
          vscode.postMessage({
            command: COMMENDS.Compile,
            data: state.path,
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
        disabled={
          !hasTerminal ||
          !state.account ||
          !state.account.zkAddress ||
          !state.path
        }
        onClick={() => {
          vscode.postMessage({
            command: COMMENDS.UintTest,
            data: state.path,
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
          !state.path ||
          !state.account?.zkAddress?.address ||
          isLoading
        }
        width="100%"
        onClick={() => {
          const selected = fileList.find((item) => item.path === state.path);
          if (selected) {
            setIsLoading(true);
            vscode.postMessage({
              command: COMMENDS.Deploy,
              data: selected.path,
            });
          }
        }}
      />
    </>
  );
};
