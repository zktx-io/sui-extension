import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
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

type IModule = {
  [name: string]: SuiMoveNormalizedModule;
};

export type PackageManagerHandles = {
  addPackage: (objectId: string) => Promise<void>;
};

export const PackageManager = forwardRef<PackageManagerHandles>(
  (props, ref) => {
    const initialized = useRef<boolean>(false);

    const [account] = useRecoilState(ACCOUNT);
    const [client, setClinet] = useState<Client | undefined>(undefined);

    const [packages, setPackages] = useState<{
      [packageId: string]: {
        index: number;
        data: IModule;
      };
    }>({});
    const [packageId, setPackageId] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(false);

    const loadPackageData = async (objectId: string) => {
      if (client && !packages[objectId]) {
        try {
          const module: IModule =
            await client.getNormalizedMoveModulesByPackage({
              package: objectId,
            });
          vscode.postMessage({
            command: COMMENDS.PackageAdd,
            data: {
              [objectId]: { index: Date.now(), data: module },
            },
          });
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
      if (account) {
        setClinet(
          new SuiClient({
            url: getFullnodeUrl(account.nonce.network),
          }),
        );
      }

      const handleMessage = (event: any) => {
        const message = event.data;
        switch (message.command) {
          case COMMENDS.PackageAdd:
          case COMMENDS.PackageDelete:
            setPackages(message.data.packages);
            break;
          default:
            break;
        }
      };

      window.addEventListener('message', handleMessage);

      if (!initialized.current) {
        initialized.current = true;
        vscode.postMessage({ command: COMMENDS.PackageAdd, data: {} });
      }

      return () => {
        window.removeEventListener('message', handleMessage);
      };
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
            disabled={isLoading}
            value={packageId}
            onInput={(e) => setPackageId((e.target as HTMLInputElement).value)}
          />
          <SpinButton
            title="Load"
            spin={isLoading}
            disabled={isLoading}
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
          Object.keys(packages)
            .sort((a, b) => packages[b].index - packages[a].index)
            .map((id, key) => (
              <Package key={key} packageId={id} data={packages[id].data} />
            ))}
      </>
    );
  },
);
