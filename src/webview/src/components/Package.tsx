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

type IFunctions = {
  [name: string]: SuiMoveNormalizedFunction;
};

export const Package = ({
  packageId,
  data,
}: {
  packageId: string;
  data: { [module: string]: SuiMoveNormalizedModule };
}) => {
  const [modules, setModules] = useState<string[]>([]);
  const [module, setModule] = useState<string | undefined>(undefined);
  const [excute, setExcute] = useState<boolean>(false);
  const [funcWrite, setFuncWrite] = useState<IFunctions | undefined>(undefined);

  useEffect(() => {
    const temp = Object.keys(data).sort();
    if (temp.length > 0) {
      setModules(temp);
      setModule(temp[0]);
      const entryFunctions = Object.fromEntries(
        Object.entries(data[temp[0]].exposedFunctions).filter(
          ([, value]) => value.isEntry,
        ),
      );
      setFuncWrite(
        Object.keys(entryFunctions).length > 0 ? entryFunctions : undefined,
      );
    } else {
      setModules([]);
      setModule(undefined);
      setFuncWrite(undefined);
    }
  }, [data]);

  return (
    <>
      <VSCodeDivider style={{ marginTop: '10px', marginBottom: '8px' }} />
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
              const key = (e.target as HTMLInputElement).value;
              setModule(key);
              const entryFunctions = Object.fromEntries(
                Object.entries(data[key].exposedFunctions).filter(
                  ([, value]) => value.isEntry,
                ),
              );
              setFuncWrite(
                Object.keys(entryFunctions).length > 0
                  ? entryFunctions
                  : undefined,
              );
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
                isWrire={true}
                name={name}
                func={funcWrite[name]}
                isDisable={excute}
                onExcute={() => {
                  // TODO
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
