import { useEffect, useState } from 'react';
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeTextArea,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { useRecoilState } from 'recoil';
import {
  getFullnodeUrl,
  SuiClient,
  SuiObjectResponse,
} from '@mysten/sui/client';
import { ACCOUNT } from '../recoil';
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
    transition: 'background-color 0.3s ease, border-color 0.3s ease',
  },
  cardHidden: {
    border: 'none',
    backgroundColor: 'transparent',
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
  arrow: {
    transition: 'transform 0.3s ease',
  },
  header: {
    width: '100%',
    padding: '6px 0',
    fontWeight: 'bold',
    marginTop: '8px',
    marginBottom: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    cursor: 'pointer',
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
  const [isContentVisible, setIsContentVisible] = useState<boolean>(false);

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
            data: `${JSON.stringify(res.error)}`,
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
        style={styles.header}
        onClick={() => setIsContentVisible(!isContentVisible)}
      >
        <span>Object Explorer</span>
        <div
          style={{
            ...styles.arrow,
            transform: isContentVisible ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
          dangerouslySetInnerHTML={{
            __html: `
              <?xml version="1.0" encoding="iso-8859-1"?>
                <svg fill="currentColor" height="8px" width="8px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" 
                viewBox="0 0 330 330" xml:space="preserve">
                <path id="XMLID_222_" d="M250.606,154.389l-150-149.996c-5.857-5.858-15.355-5.858-21.213,0.001
                c-5.857,5.858-5.857,15.355,0.001,21.213l139.393,139.39L79.393,304.394c-5.857,5.858-5.857,15.355,0.001,21.213
                C82.322,328.536,86.161,330,90,330s7.678-1.464,10.607-4.394l149.999-150.004c2.814-2.813,4.394-6.628,4.394-10.606
                C255,161.018,253.42,157.202,250.606,154.389z"/>
              </svg>
              `,
          }}
        />
      </div>

      <VSCodeDivider />

      <div
        style={{
          ...styles.card,
          ...(isContentVisible ? {} : styles.cardHidden),
        }}
      >
        <div
          style={{
            ...styles.contentWrapper,
            ...(isContentVisible ? styles.openContent : {}),
          }}
        >
          <div
            style={{
              ...styles.content,
              ...(isContentVisible ? styles.openContentVisible : {}),
            }}
          >
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

            <VSCodeDivider style={{ marginTop: '8px', marginBottom: '8px' }} />

            <label style={{ fontSize: '11px', color: 'GrayText' }}>Type</label>
            <VSCodeTextArea
              rows={2}
              resize="vertical"
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
              resize="vertical"
              style={{ width: '100%' }}
              value={
                objectInfo?.data?.content
                  ? JSON.stringify(objectInfo.data.content, null, 4)
                  : ''
              }
              readOnly
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '8px',
              }}
            >
              <VSCodeButton onClick={() => setObjectInfo(undefined)}>
                Clear
              </VSCodeButton>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
