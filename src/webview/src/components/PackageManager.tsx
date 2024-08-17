import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  getFullnodeUrl,
  SuiClient,
  SuiMoveNormalizedModule,
} from '@mysten/sui/client';
import { useRecoilState } from 'recoil';
import { Client, Package } from './Package';
import { ACCOUNT } from '../recoil';
import {
  VSCodeDivider,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { SpinButton } from './SpinButton';
import { vscode } from '../utilities/vscode';
import { COMMENDS } from '../utilities/commends';

export type PackageManagerHandles = {
  addPackage: (objectId: string) => Promise<void>;
};

export const PackageManager = forwardRef<PackageManagerHandles>(
  (props, ref) => {
    const [account] = useRecoilState(ACCOUNT);
    const [client, setClinet] = useState<Client | undefined>(undefined);

    const [index, setIndex] = useState<string[]>([]);
    const [packages, setPackages] = useState<{
      [packageId: string]: { [module: string]: SuiMoveNormalizedModule };
    }>({});

    const [packageId, setPackageId] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const updateFunctions = async (objectId: string) => {
      if (client && !packages[objectId]) {
        try {
          const res: { [module: string]: SuiMoveNormalizedModule } =
            await client.getNormalizedMoveModulesByPackage({
              package: objectId,
            });
          setPackages({ ...packages, [objectId]: res });
          setIndex([objectId, ...index]);
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
        await updateFunctions(objectId);
      },
    }));

    const handleLoading = async () => {
      setLoading(true);
      await updateFunctions(packageId);
      setLoading(false);
    };

    useEffect(() => {
      if (account) {
        setClinet(
          new SuiClient({
            url: getFullnodeUrl(account.nonce.network),
          }),
        );
      }
    }, [account]);

    return (
      <>
        <div>
          <VSCodeDivider style={{ marginTop: '10px', marginBottom: '8px' }} />
          <label style={{ fontSize: '11px', color: 'GrayText' }}>
            Load Package
          </label>
          <VSCodeTextField
            style={{ width: '100%', marginBottom: '8px' }}
            placeholder="Package Id"
            disabled={loading}
            value={packageId}
            onInput={(e) => setPackageId((e.target as HTMLInputElement).value)}
          />
          <SpinButton
            title="Load"
            spin={loading}
            disabled={loading}
            width="100%"
            onClick={handleLoading}
          />
        </div>
        {client &&
          index.map((id, key) => (
            <Package key={key} packageId={id} data={packages[id]} />
          ))}
      </>
    );
  },
);
