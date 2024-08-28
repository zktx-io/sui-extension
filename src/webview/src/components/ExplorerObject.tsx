import { useEffect, useState } from 'react';
import {
  getFullnodeUrl,
  SuiClient,
  SuiObjectResponse,
} from '@mysten/sui/client';
import { useRecoilState } from 'recoil';
import { ACCOUNT } from '../recoil';
import {
  VSCodeDivider,
  VSCodeTextArea,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { SpinButton } from './SpinButton';
import { vscode } from '../utilities/vscode';
import { COMMENDS } from '../utilities/commends';

const styles = {
  card: {
    borderRadius: '4px',
    border: '1px solid var(--vscode-editorGroup-border)',
    backgroundColor: 'var(--vscode-titleBar-activeBackground)',
    color: 'var(--vscode-foreground)',
    width: '100%',
    marginTop: '10px',
  },
  contentWrapper: {
    overflow: 'hidden',
    transition: 'max-height 0.3s ease',
    maxHeight: '0px',
  },
  content: {
    opacity: 0,
    transition: 'opacity 0.3s ease, padding 0.3s ease',
    padding: '0px 10px',
  },
  openContent: {
    maxHeight: '100%',
  },
  openContentVisible: {
    opacity: 1,
    padding: '10px 10px',
  },
};

export const ExplorerObject = () => {
  const [account] = useRecoilState(ACCOUNT);
  const [client, setClinet] = useState<SuiClient | undefined>(undefined);

  const [objectId, setObjectId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [objectInfo, setObjectInfo] = useState<SuiObjectResponse | undefined>(
    undefined,
  );

  const loadObjectData = async (objectId: string) => {
    if (account && client) {
      try {
        const res = await client.getObject({
          id: objectId,
          options: {
            showContent: true,
            showType: true,
            showOwner: true,
          },
        });
        if (res.error) {
          vscode.postMessage({
            command: COMMENDS.MsgError,
            data: `${res.error}`,
          });
        } else {
          setObjectInfo(res);
        }
      } catch (error) {
        vscode.postMessage({ command: COMMENDS.MsgError, data: `${error}` });
      }
    }
  };

  useEffect(() => {
    if (account && !client) {
      setClinet(
        new SuiClient({
          url: getFullnodeUrl(account.nonce.network),
        }),
      );
    }
  }, [account, client]);

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
        Object Explorer
      </div>

      <VSCodeDivider />
      <div>
        <label style={{ fontSize: '11px', color: 'GrayText' }}>
          Load Object
        </label>
        <VSCodeTextField
          style={{ width: '100%', marginBottom: '8px' }}
          placeholder="Object Id"
          disabled={isLoading}
          value={objectId}
          onInput={(e) => setObjectId((e.target as HTMLInputElement).value)}
        />
        <SpinButton
          title="Load"
          spin={isLoading}
          disabled={isLoading || !client}
          width="100%"
          onClick={async () => {
            setIsLoading(true);
            await loadObjectData(objectId);
            setIsLoading(false);
          }}
        />
      </div>

      <div style={styles.card}>
        <div
          style={{
            ...styles.contentWrapper,
            ...styles.openContent,
          }}
        >
          <div
            style={{
              ...styles.content,
              ...styles.openContentVisible,
            }}
          >
            <label style={{ fontSize: '11px', color: 'GrayText' }}>Type</label>
            <VSCodeTextArea
              rows={2}
              style={{ width: '100%' }}
              value={objectInfo?.data?.type || ''}
              readOnly
            />

            <label style={{ fontSize: '11px', color: 'GrayText' }}>
              Version
            </label>
            <VSCodeTextField
              style={{ width: '100%' }}
              value={objectInfo?.data?.version || ''}
              readOnly
            />

            <label style={{ fontSize: '11px', color: 'GrayText' }}>
              Digest
            </label>
            <VSCodeTextField
              style={{ width: '100%' }}
              value={objectInfo?.data?.digest || ''}
              readOnly
            />

            <label style={{ fontSize: '11px', color: 'GrayText' }}>
              Content
            </label>
            <VSCodeTextArea
              rows={3}
              style={{ width: '100%' }}
              value={
                objectInfo?.data?.content
                  ? JSON.stringify(objectInfo.data.content, null, 4)
                  : ''
              }
              readOnly
            />
          </div>
        </div>
      </div>
    </>
  );
};
