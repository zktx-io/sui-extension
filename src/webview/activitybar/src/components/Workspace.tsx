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
  packageUpdate,
  packageSelect,
} from '../utilities/stateController';
import { getBalance } from '../utilities/getBalance';
import { loadPackageData } from '../utilities/loadPackageData';

type PackageListEntry = { path: string; content: string };
type PackageListMessage = {
  command: COMMANDS.PackageList;
  data: PackageListEntry[];
};
type DeployMessage = {
  command: COMMANDS.Deploy;
  data: { dumpByte: string; upgradeToml: string };
};
type UpgradeMessage = {
  command: COMMANDS.Upgrade;
  data: { path: string; content: string };
};
type WorkspaceMessage = PackageListMessage | DeployMessage | UpgradeMessage;

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

  const buildUpgradeToml = (
    packageId: string,
    upgradeCapId: string | undefined,
    policy?: unknown,
  ) => {
    const lines = [
      '[upgrade]',
      `package_id = "${packageId}"`,
      `upgrade_cap = "${upgradeCapId ?? 'YOUR_UPGRADE_CAP_OBJECT_ID'}"`,
    ];

    if (typeof policy === 'string' && policy.trim()) {
      lines.push(`policy = "${policy.trim()}"`);
    } else if (typeof policy === 'number' && Number.isFinite(policy)) {
      lines.push(`policy = ${policy}`);
    } else {
      lines.push(
        '# policy = "compatible" # optional: compatible|additive|dep_only',
      );
    }
    return `${lines.join('\n')}\n`;
  };

  useEffect(() => {
    if (!state.path) {
      setUpgradeToml('');
      return;
    }
    vscode.postMessage({ command: COMMANDS.Upgrade, data: state.path });
  }, [state.path]);

  useEffect(() => {
    const handleMessage = async (event: MessageEvent<WorkspaceMessage>) => {
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
        case COMMANDS.Upgrade:
          if (message.data.path === state.path) {
            setUpgradeToml(message.data.content);
          }
          break;
        case COMMANDS.Deploy:
          try {
            if (!!state.account?.zkAddress && !!client) {
              const toml = message.data.upgradeToml;
              if (!message.data.dumpByte?.trim()) {
                vscode.postMessage({
                  command: COMMANDS.MsgError,
                  data: `Missing bytecode dump. Run "Build" first to generate bytecode.dump.json.`,
                });
                break;
              }
              setUpgradeToml(toml);
              if (!toml) {
                const { packageId, upgradeCap } = await packagePublish(
                  state.account,
                  client,
                  message.data.dumpByte,
                );
                const balance = await getBalance(client, state.account);
                const modules = await loadPackageData(client, packageId);
                setState((oldState) =>
                  modules
                    ? {
                        ...oldState,
                        balance,
                        ...packageAdd(packageId, modules, {
                          upgradeCap,
                          upgradeCapChecked: Boolean(upgradeCap),
                          upgradeCapValidated: false,
                          path: state.path,
                        }),
                      }
                    : { ...oldState, balance },
                );
                if (state.path) {
                  vscode.postMessage({
                    command: COMMANDS.UpgradeSave,
                    data: {
                      path: state.path,
                      content: buildUpgradeToml(packageId, upgradeCap),
                      overwrite: false,
                      notify: true,
                    },
                  });
                }
              } else {
                const { packageId, fromPackageId, upgradeCap } =
                  await packageUpgrade(
                    state.account,
                    client,
                    message.data.dumpByte,
                    toml,
                  );
                const balance = await getBalance(client, state.account);
                const modules = await loadPackageData(client, packageId);
                setState((oldState) =>
                  modules
                    ? {
                        ...oldState,
                        balance,
                        ...packageAdd(packageId, modules, {
                          upgradeCap,
                          upgradeCapChecked: true,
                          upgradeCapValidated: false,
                          path: state.path,
                        }),
                      }
                    : { ...oldState, balance },
                );
                setState((oldState) => ({
                  ...oldState,
                  ...packageUpdate(fromPackageId, {
                    upgradeCap: undefined,
                    upgradeCapChecked: true,
                    upgradeCapValidated: true,
                  }),
                }));
                let policy: unknown = undefined;
                try {
                  const parsed = parse(toml) as {
                    upgrade?: { policy?: unknown };
                  };
                  policy = parsed.upgrade?.policy;
                } catch {
                  policy = undefined;
                }
                if (state.path) {
                  vscode.postMessage({
                    command: COMMANDS.UpgradeSave,
                    data: {
                      path: state.path,
                      content: buildUpgradeToml(packageId, upgradeCap, policy),
                      overwrite: true,
                      notify: true,
                    },
                  });
                }
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
  }, [client, state.account, state.path]);

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
                data: { kind: 'build', path: state.path },
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
                data: { kind: 'test', path: state.path },
              });
          }}
        >
          Test
        </VSCodeButton>
      </div>

      <SpinButton
        title={upgradeToml ? 'Upgrade' : 'Deploy'}
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
