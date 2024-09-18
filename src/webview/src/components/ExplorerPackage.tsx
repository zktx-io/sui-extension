import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  VSCodeDivider,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { useRecoilState } from 'recoil';
import {
  getFullnodeUrl,
  SuiClient,
  SuiMoveNormalizedModules,
} from '@mysten/sui/client';
import { Package } from './Package';
import { STATE } from '../recoil';
import { SpinButton } from './SpinButton';
import { vscode } from '../utilities/vscode';
import { COMMENDS } from '../utilities/commends';
import { packageAdd } from '../utilities/stateController';

export type ExplorerPackageHandles = {
  addPackage: (objectId: string) => Promise<void>;
};

export const ExplorerPackage = forwardRef<ExplorerPackageHandles>(
  (props, ref) => {
    const [state, setState] = useRecoilState(STATE);
    const [client, setClinet] = useState<SuiClient | undefined>(undefined);
    const [packageId, setPackageId] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const loadPackageData = async (objectId: string) => {
      if (client) {
        try {
          const modules: SuiMoveNormalizedModules =
            await client.getNormalizedMoveModulesByPackage({
              package: objectId,
            });
          setState((oldState) => ({
            ...oldState,
            ...packageAdd(objectId, modules),
          }));
        } catch (error) {
          vscode.postMessage({
            command: COMMENDS.MsgError,
            data: `${error}`,
          });
        }
      }
    };

    useImperativeHandle(ref, () => ({
      addPackage: async (objectId: string) => {
        await loadPackageData(objectId);
      },
    }));

    useEffect(() => {
      if (state.account && !client) {
        setClinet(
          new SuiClient({
            url: getFullnodeUrl(state.account.nonce.network),
          }),
        );
      }
    }, [client, state]);

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
          Package Explorer
          <VSCodeDivider />
        </div>
        <div>
          <label style={{ fontSize: '11px', color: 'GrayText' }}>
            Load Package
          </label>
          <VSCodeTextField
            style={{ width: '100%', marginBottom: '8px' }}
            placeholder="Package Id"
            disabled={isLoading}
            value={packageId}
            onInput={(e) => setPackageId((e.target as HTMLInputElement).value)}
          />
          <SpinButton
            title="Load"
            spin={isLoading}
            disabled={
              isLoading || !client || !state.account || !state.account.zkAddress
            }
            width="100%"
            onClick={async () => {
              setIsLoading(true);
              await loadPackageData(packageId);
              setIsLoading(false);
            }}
          />
        </div>
        <VSCodeDivider style={{ marginTop: '10px', marginBottom: '10px' }} />
        {client &&
          state &&
          Object.keys(state.packages)
            .sort((a, b) => state.packages[b].index - state.packages[a].index)
            .map((id, key) => (
              <Package
                key={key}
                client={client}
                packageId={id}
                data={state.packages[id].data}
              />
            ))}
      </>
    );
  },
);
