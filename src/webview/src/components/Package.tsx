import { useEffect, useState } from 'react';
import {
  VSCodeDivider,
  VSCodeDropdown,
  VSCodeOption,
} from '@vscode/webview-ui-toolkit/react';
import {
  SuiClient,
  SuiMoveNormalizedFunction,
  SuiMoveNormalizedModule,
  SuiTransactionBlockResponse,
} from '@mysten/sui/client';
import { VSCodeTextField } from '@vscode/webview-ui-toolkit/react';
import { Function } from './Function';

export type Client = SuiClient;
export type Receipt = SuiTransactionBlockResponse;

export const Package = ({
  client,
  packageId,
}: {
  client: Client;
  packageId: string;
}) => {
  const [functions, setFunctions] = useState<{
    [module: string]: SuiMoveNormalizedModule;
  }>({});
  const [modules, setModules] = useState<string[]>([]);
  const [module, setModule] = useState<string | undefined>(undefined);
  const [expose, setExpose] = useState<
    | {
        [name: string]: SuiMoveNormalizedFunction;
      }
    | undefined
  >(undefined);
  const [excute, setExcute] = useState<boolean>(false);

  useEffect(() => {
    const updateFunctions = async () => {
      const res: { [module: string]: SuiMoveNormalizedModule } =
        await client.getNormalizedMoveModulesByPackage({
          package: packageId,
        });
      setFunctions(res);
      const temp = Object.keys(res).sort();
      if (temp.length > 0) {
        setModules(temp);
        setModule(temp[0]);
        const entryFunctions = Object.fromEntries(
          Object.entries(res[temp[0]].exposedFunctions).filter(
            ([, value]) => value.isEntry,
          ),
        );
        setExpose(
          Object.keys(entryFunctions).length > 0 ? entryFunctions : undefined,
        );
      } else {
        setModules([]);
        setModule(undefined);
        setExpose(undefined);
      }
    };
    updateFunctions();
  }, [client, packageId]);

  return (
    <>
      <VSCodeDivider style={{ marginBottom: '6px', marginTop: '18px' }} />

      <div
        style={{
          width: '100%',
          flexDirection: 'column',
        }}
      >
        <label style={{ fontSize: '11px', color: 'GrayText' }}>
          Package Id
        </label>
        <VSCodeTextField
          style={{ width: '100%', marginBottom: '4px' }}
          readOnly
          value={packageId}
        />
        <label style={{ fontSize: '11px', color: 'GrayText' }}>Modules</label>
        <VSCodeDropdown
          style={{ width: '100%' }}
          value={module}
          onChange={(e) => {
            if (e.target) {
              const key = (e.target as any).value;
              setModule(key);
              const entryFunctions = Object.fromEntries(
                Object.entries(functions[key].exposedFunctions).filter(
                  ([, value]) => value.isEntry,
                ),
              );
              setExpose(
                Object.keys(entryFunctions).length > 0
                  ? entryFunctions
                  : undefined,
              );
            } else {
              setModule(undefined);
              setExpose(undefined);
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
          {expose ? (
            Object.keys(expose).map((name, key) => (
              <Function
                key={key}
                name={name}
                packageId={packageId}
                func={expose[name]}
                isDisable={excute}
                onExcute={() => {
                  setExcute(true);
                }}
              />
            ))
          ) : (
            <p>No public entry functions found.</p>
          )}
        </div>
      </div>
    </>
  );
};
