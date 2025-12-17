import { useEffect, useState } from 'react';
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { useRecoilState } from 'recoil';
import {
  SuiClient,
  SuiMoveNormalizedFunction,
  SuiMoveNormalizedModule,
} from '@mysten/sui/client';
import { Function } from './Function';
import { STATE } from '../recoil';
import { moveCall } from '../utilities/moveCall';
import { packageDelete, packageUpdate } from '../utilities/stateController';
import { vscode } from '../utilities/vscode';
import { COMMANDS } from '../utilities/commands';
import {
  findOwnedUpgradeCap,
  getUpgradeCapPackageId,
} from '../utilities/upgradeCap';

const cardStyles = {
  card: {
    borderRadius: '4px',
    border: '1px solid var(--vscode-editorGroup-border)',
    backgroundColor: 'var(--vscode-editor-background)',
    width: '100%',
    marginBottom: '16px',
  },
  titleBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--vscode-titleBar-activeBackground)',
    padding: '8px 12px',
    borderRadius: '4px 4px 0 0',
    height: 'auto',
  },
  label: {
    fontSize: '14px',
    color: 'var(--vscode-foreground)',
  },
  deleteButton: {
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
  },
  divider: {
    width: '100%',
    marginTop: '0px',
    marginBottom: '8px',
  },
  content: {
    padding: '12px',
  },
};

type IFunctions = {
  [name: string]: SuiMoveNormalizedFunction;
};

export const Package = ({
  client,
  packageId,
  data,
}: {
  client: SuiClient | undefined;
  packageId: string;
  data: { [name: string]: SuiMoveNormalizedModule };
}) => {
  const [state, setState] = useRecoilState(STATE);
  const [modules, setModules] = useState<string[]>([]);
  const [module, setModule] = useState<string | undefined>(undefined);
  const [isExcute, setIsExcute] = useState<boolean>(false);
  const [funcWrite, setFuncWrite] = useState<IFunctions | undefined>(undefined);

  const entry = state.packages?.[packageId];
  const upgradeCapId = entry?.upgradeCap;
  const isUpgradable = Boolean(upgradeCapId);

  const onDelete = () => {
    setState((oldState) => ({ ...oldState, ...packageDelete(packageId) }));
  };

  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isDetectingCap, setIsDetectingCap] = useState(false);

  useEffect(() => {
    const run = async () => {
      if (!entry) return;
      if (!client || !state.account?.zkAddress?.address) return;

      setIsDetectingCap(true);
      try {
        if (entry.upgradeCap) {
          if (entry.upgradeCapValidated) return;
          const capPackageId = await getUpgradeCapPackageId(
            client,
            entry.upgradeCap,
          );
          if (capPackageId === packageId) {
            setState((oldState) => ({
              ...oldState,
              ...packageUpdate(packageId, {
                upgradeCapChecked: true,
                upgradeCapValidated: true,
              }),
            }));
            return;
          }
        } else if (entry.upgradeCapChecked) {
          return;
        }

        const found = await findOwnedUpgradeCap(
          client,
          state.account.zkAddress.address,
          packageId,
        );
        setState((oldState) => ({
          ...oldState,
          ...packageUpdate(packageId, {
            upgradeCap: found?.upgradeCapId,
            upgradeCapChecked: true,
            upgradeCapValidated: true,
          }),
        }));
      } catch {
        setState((oldState) => ({
          ...oldState,
          ...packageUpdate(packageId, {
            upgradeCapChecked: true,
            upgradeCapValidated: true,
          }),
        }));
      } finally {
        setIsDetectingCap(false);
      }
    };
    void run();
  }, [client, entry, packageId, setState, state.account?.zkAddress?.address]);

  const onCopyUpgradeToml = async () => {
    if (isUpgrading) return;
    setIsUpgrading(true);
    try {
      let upgradeCap = state.packages?.[packageId]?.upgradeCap;

      if (!upgradeCap && client && state.account?.zkAddress?.address) {
        try {
          const found = await findOwnedUpgradeCap(
            client,
            state.account.zkAddress.address,
            packageId,
          );
          if (found?.upgradeCapId) {
            upgradeCap = found.upgradeCapId;
            setState((oldState) => ({
              ...oldState,
              ...packageUpdate(packageId, { upgradeCap }),
            }));
          }
        } catch {
          // ignore lookup failures; fall back to placeholder
        }
      }

      const upgradable = Boolean(upgradeCap);
      if (!upgradable) {
        vscode.postMessage({
          command: COMMANDS.MsgError,
          data: `Upgrade is not available for this package in the current wallet (no UpgradeCap found for ${packageId}).`,
        });
      }

      const toml = `[upgrade]
package_id = "${packageId}"
upgrade_cap = "${upgradeCap ?? 'YOUR_UPGRADE_CAP_OBJECT_ID'}"
# policy = "compatible" # optional: compatible|additive|dep_only
`;

      const path = state.packages?.[packageId]?.path;
      if (path) {
        vscode.postMessage({
          command: COMMANDS.UpgradeSave,
          data: { path, content: toml },
        });
      } else {
        vscode.postMessage({ command: COMMANDS.ClipboardWrite, data: toml });
      }
    } finally {
      setIsUpgrading(false);
    }
  };

  const onExcute = async (
    name: string,
    func: SuiMoveNormalizedFunction,
    inputValues: Array<string>,
    typeArguments: string[],
  ) => {
    if (client && state.account && state.account.zkAddress && module) {
      try {
        setIsExcute(true);
        await moveCall(
          client,
          state.account,
          `${packageId}::${module}::${name}`,
          func,
          inputValues,
          typeArguments,
        );
      } catch (e) {
        console.error(e);
      } finally {
        setIsExcute(false);
      }
    }
  };

  const selectModule = (select: string) => {
    if (data[select].exposedFunctions) {
      setModule(select);
      const writeFunctions = Object.fromEntries(
        Object.entries(data[select].exposedFunctions).filter(
          ([, value]) => value.isEntry || value.visibility === 'Public',
        ),
      );
      setFuncWrite(
        Object.keys(writeFunctions).length > 0 ? writeFunctions : undefined,
      );
    }
  };

  useEffect(() => {
    const temp = Object.keys(data).sort();
    if (temp.length > 0) {
      setModules(temp);
      selectModule(temp[0]);
    } else {
      setModules([]);
      setModule(undefined);
      setFuncWrite(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return (
    <div style={cardStyles.card}>
      <div style={cardStyles.titleBar}>
        <label style={cardStyles.label}>Package</label>
        <VSCodeButton
          appearance="icon"
          onClick={onDelete}
          style={cardStyles.deleteButton}
        >
          <svg
            width="16px"
            height="16px"
            viewBox="0 0 16 16"
            xmlns="http://www.w3.org/2000/svg"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M7.116 8l-4.558 4.558.884.884L8 8.884l4.558 4.558.884-.884L8.884 8l4.558-4.558-.884-.884L8 7.116 3.442 2.558l-.884.884L7.116 8z"
            />
          </svg>
        </VSCodeButton>
      </div>
      <VSCodeDivider style={cardStyles.divider} />
      <div style={cardStyles.content}>
        <label style={{ fontSize: '11px', color: 'GrayText' }}>
          Package Id
        </label>
        <VSCodeTextField
          style={{ width: '100%', marginBottom: '4px' }}
          readOnly
          value={packageId}
        />
        <label style={{ fontSize: '11px', color: 'GrayText' }}>
          Upgrade Cap Id
        </label>
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            width: '100%',
            marginBottom: '4px',
          }}
        >
          <VSCodeTextField
            style={{ flex: '1 1 auto' }}
            readOnly
            value={upgradeCapId ?? ''}
            placeholder={
              isDetectingCap
                ? 'Detecting…'
                : isUpgradable
                  ? 'Upgradable'
                  : 'Not upgradable (no UpgradeCap in the current wallet)'
            }
          />
          <VSCodeButton
            appearance="icon"
            onClick={onCopyUpgradeToml}
            disabled={isUpgrading || isDetectingCap || !isUpgradable}
            title="Create or copy Upgrade.toml"
            style={{ marginLeft: '6px', flex: '0 0 auto' }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 48 48"
            >
              <path d="M0 0h48v48h-48z" fill="none" />
              <path d="M38.86 25.95c.08-.64.14-1.29.14-1.95s-.06-1.31-.14-1.95l4.23-3.31c.38-.3.49-.84.24-1.28l-4-6.93c-.25-.43-.77-.61-1.22-.43l-4.98 2.01c-1.03-.79-2.16-1.46-3.38-1.97l-.75-5.3c-.09-.47-.5-.84-1-.84h-8c-.5 0-.91.37-.99.84l-.75 5.3c-1.22.51-2.35 1.17-3.38 1.97l-4.98-2.01c-.45-.17-.97 0-1.22.43l-4 6.93c-.25.43-.14.97.24 1.28l4.22 3.31c-.08.64-.14 1.29-.14 1.95s.06 1.31.14 1.95l-4.22 3.31c-.38.3-.49.84-.24 1.28l4 6.93c.25.43.77.61 1.22.43l4.98-2.01c1.03.79 2.16 1.46 3.38 1.97l.75 5.3c.08.47.49.84.99.84h8c.5 0 .91-.37.99-.84l.75-5.3c1.22-.51 2.35-1.17 3.38-1.97l4.98 2.01c.45.17.97 0 1.22-.43l4-6.93c.25-.43.14-.97-.24-1.28l-4.22-3.31zm-14.86 5.05c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" />
            </svg>
          </VSCodeButton>
        </div>
        <label style={{ fontSize: '11px', color: 'GrayText' }}>Modules</label>
        <VSCodeDropdown
          style={{ width: '100%' }}
          value={module}
          onChange={(e) => {
            if (e.target) {
              const key = (e.target as HTMLInputElement).value;
              selectModule(key);
            } else {
              setModule(undefined);
              setFuncWrite(undefined);
            }
          }}
        >
          {modules.map((item, index) => (
            <VSCodeOption key={index} value={item}>
              {item}
            </VSCodeOption>
          ))}
        </VSCodeDropdown>
        <div style={{ marginTop: '16px' }}>
          {funcWrite ? (
            Object.keys(funcWrite).map((name, key) => (
              <Function
                key={key}
                isWrite={true}
                name={name}
                func={funcWrite[name]}
                isDisable={isExcute}
                onExcute={onExcute}
              />
            ))
          ) : (
            <p>No public entry functions found.</p>
          )}
        </div>
      </div>
    </div>
  );
};
