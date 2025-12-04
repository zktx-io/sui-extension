import { useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { parse } from 'smol-toml';
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeDropdown,
  VSCodeOption,
} from '@vscode/webview-ui-toolkit/react';
import { SuiClient } from '@mysten/sui/client';
import { vscode } from '../utilities/vscode';
import { COMMANDS } from '../utilities/commands';
import { SpinButton } from './SpinButton';
import { STATE } from '../recoil';
import { packageUpgrade } from '../utilities/packageUpgrade';
import { packagePublish } from '../utilities/packagePublish';
import {
  dataGet,
  packageAdd,
  packageSelect,
} from '../utilities/stateController';
import { getBalance } from '../utilities/getBalance';
import { loadPackageData } from '../utilities/loadPackageData';
import { runBuild, runTest } from '../utilities/cli';

type PackageListEntry = { path: string; content: string };
type PackageListMessage = {
  command: COMMANDS.PackageList;
  data: PackageListEntry[];
};
type DeployMessage = {
  command: COMMANDS.Deploy;
  data: string;
};
type WorkspaceMessage = PackageListMessage | DeployMessage;

type SuiPackageManifest = {
  package?: {
    name?: string;
    version?: string;
  };
};

export const Workspace = ({
  hasTerminal,
  client,
}: {
  hasTerminal: boolean;
  client: SuiClient | undefined;
}) => {
  const [state, setState] = useRecoilState(STATE);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [fileList, setFileList] = useState<
    { path: string; name: string; version: string }[]
  >([]);
  const [upgradeToml, setUpgradeToml] = useState<string>('');

  useEffect(() => {
    const handleMessage = async (
      event: MessageEvent<WorkspaceMessage>,
    ) => {
      const message = event.data;
      switch (message.command) {
        case COMMANDS.PackageList:
          {
            const temp = message.data.map(({ path, content }) => {
              const parsed = parse(content) as SuiPackageManifest;
              const manifestPackage = parsed.package ?? {};
              return {
                path,
                name: manifestPackage.name ?? '',
                version: manifestPackage.version ?? '',
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
        case COMMANDS.Deploy:
          try {
            if (!!state.account?.zkAddress && !!client) {
              if (!upgradeToml) {
                const { packageId } = await packagePublish(
                  state.account,
                  client,
                  message.data,
                );
                const balance = await getBalance(client, state.account);
                const modules = await loadPackageData(client, packageId);
                setState((oldState) =>
                  modules
                    ? {
                        ...oldState,
                        balance,
                        ...packageAdd(packageId, modules),
                      }
                    : { ...oldState, balance },
                );
              } else {
                const { packageId } = await packageUpgrade(
                  state.account,
                  client,
                  message.data,
                  upgradeToml,
                );
                const balance = await getBalance(client, state.account);
                const modules = await loadPackageData(client, packageId);
                setState((oldState) =>
                  modules
                    ? {
                        ...oldState,
                        balance,
                        ...packageAdd(packageId, modules),
                      }
                    : { ...oldState, balance },
                );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, state.account, upgradeToml]);

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

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '4px',
        }}
      >
        <VSCodeButton
          style={{ flex: 1, marginRight: '2px' }}
          disabled={
            !hasTerminal ||
            !state.account ||
            !state.account.zkAddress ||
            !state.path
          }
          onClick={() => {
            state.path &&
              vscode.postMessage({
                command: COMMANDS.CLI,
                data: runBuild(state.path),
              });
          }}
        >
          Build
        </VSCodeButton>
        <VSCodeButton
          style={{ flex: 1, marginLeft: '2px' }}
          disabled={
            !hasTerminal ||
            !state.account ||
            !state.account.zkAddress ||
            !state.path
          }
          onClick={() => {
            state.path &&
              vscode.postMessage({
                command: COMMANDS.CLI,
                data: runTest(state.path),
              });
          }}
        >
          Test
        </VSCodeButton>
      </div>

      <SpinButton
        title={!upgradeToml ? 'Deploy' : 'Upgrade'}
        spin={isLoading}
        disabled={
          !client ||
          !hasTerminal ||
          !state.path ||
          !state.account?.zkAddress?.address ||
          isLoading
        }
        width="100%"
        bgColor="#ff9800"
        onClick={() => {
          const selected = fileList.find((item) => item.path === state.path);
          if (selected) {
            setIsLoading(true);
            vscode.postMessage({
              command: COMMANDS.Deploy,
              data: selected.path,
            });
          }
        }}
      />
    </>
  );
};
