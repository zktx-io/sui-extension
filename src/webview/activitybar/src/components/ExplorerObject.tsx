import { useState } from 'react';
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { useRecoilState } from 'recoil';
import { SuiClient, SuiObjectResponse } from '@mysten/sui/client';
import { STATE } from '../recoil';
import { SpinButton } from './SpinButton';
import { vscode } from '../utilities/vscode';
import { COMMANDS } from '../utilities/commands';
import { SuiObject } from './SuiObject';

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
    overflow: 'hidden',
  },
  title: {
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
};

const ChevronRight = ({ size }: { size: number }) => (
  <svg
    fill="currentColor"
    height={`${size}px`}
    width={`${size}px`}
    viewBox="0 0 330 330"
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M250.606 154.389l-150-149.996c-5.857-5.858-15.355-5.858-21.213.001-5.857 5.858-5.857 15.355.001 21.213l139.393 139.39-139.394 139.407c-5.857 5.858-5.857 15.355.001 21.213C82.322 328.536 86.161 330 90 330s7.678-1.464 10.607-4.394l149.999-150.004c2.814-2.813 4.394-6.628 4.394-10.606 0-3.978-1.58-7.794-4.394-10.607z" />
  </svg>
);

export const ExplorerObject = ({
  client,
}: {
  client: SuiClient | undefined;
}) => {
  const [state] = useRecoilState(STATE);
  const [objectId, setObjectId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [objectInfo, setObjectInfo] = useState<SuiObjectResponse | undefined>(
    undefined,
  );
  const [isContentVisible, setIsContentVisible] = useState<boolean>(false);

  const loadObjectData = async (objectId: string) => {
    if (state.account && client) {
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
            command: COMMANDS.MsgError,
            data: `${JSON.stringify(res.error)}`,
          });
        } else {
          setObjectInfo(res);
          vscode.postMessage({
            command: COMMANDS.OutputInfo,
            data: JSON.stringify(res, null, 4),
          });
        }
      } catch (error) {
        vscode.postMessage({ command: COMMANDS.MsgError, data: `${error}` });
      }
    }
  };

  return (
    <>
      <div
        style={styles.header}
        onClick={() => setIsContentVisible(!isContentVisible)}
      >
        <span style={styles.title}>Object Explorer</span>
        <div
          style={{
            ...styles.arrow,
            transform: isContentVisible ? 'rotate(90deg)' : 'rotate(0deg)',
          }}
        >
          <ChevronRight size={8} />
        </div>
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

            <SuiObject objectInfo={objectInfo} />

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
