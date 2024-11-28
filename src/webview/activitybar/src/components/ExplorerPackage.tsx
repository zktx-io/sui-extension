import { useState } from 'react';
import {
  VSCodeDivider,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { useRecoilState } from 'recoil';
import { SuiClient } from '@mysten/sui/client';
import { Package } from './Package';
import { STATE } from '../recoil';
import { SpinButton } from './SpinButton';
import { packageAdd } from '../utilities/stateController';
import { loadPackageData } from '../utilities/loadPackageData';

export const ExplorerPackage = ({
  client,
}: {
  client: SuiClient | undefined;
}) => {
  const [state, setState] = useRecoilState(STATE);
  const [packageId, setPackageId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

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
            const modules = await loadPackageData(client, packageId);
            if (modules) {
              setState((oldState) => ({
                ...oldState,
                ...packageAdd(packageId, modules),
              }));
            }
            setIsLoading(false);
          }}
        />
      </div>
      <VSCodeDivider style={{ marginTop: '10px', marginBottom: '10px' }} />
      {state &&
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
};
