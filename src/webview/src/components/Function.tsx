import { useState } from 'react';
import {
  VSCodeButton,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { SuiMoveNormalizedFunction } from '@mysten/sui/client';
import { getPlaceholder } from './utils';

const styles = {
  card: {
    borderRadius: '4px',
    border: '1px solid var(--vscode-editorGroup-border)',
    backgroundColor: 'var(--vscode-titleBar-activeBackground)',
    color: 'var(--vscode-foreground)',
    width: '100%',
    marginTop: '10px',
  },
  titleBar: {
    cursor: 'pointer',
    backgroundColor: 'var(--vscode-editor-background)',
    borderRadius: '4px 4px 0 0',
    height: 'auto',
    display: 'flex',
    alignItems: 'center',
    padding: '8px 12px'
  },
  title: {
    marginTop: '0px',
    marginBottom: '0px',
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

export const Function = ({
  name,
  func,
  isDisable,
  onExcute,
}: {
  name: string;
  func: SuiMoveNormalizedFunction;
  isDisable: boolean;
  onExcute: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleCard = () => {
    setIsOpen(!isOpen);
  };

  return (
    <div style={styles.card}>
      <div style={{ flexDirection: 'column' }}>
        <div style={styles.titleBar} onClick={toggleCard}>
          <div style={styles.title}>{name}</div>
        </div>
        <div
          style={{
            ...styles.contentWrapper,
            ...(isOpen ? styles.openContent : {}),
          }}
        >
          <div
            style={{
              ...styles.content,
              ...(isOpen ? styles.openContentVisible : {}),
            }}
          >
            {func.typeParameters.length > 0 && (
              <>
                <small>Type Parameters</small>
                <p>{JSON.stringify(func.typeParameters)}</p>
              </>
            )}
            {func.parameters.length > 0 && (
              <>
                <small>Parameters</small>
                {func.parameters.map((item, key) => (
                  <div key={key}>
                    <label style={{ fontSize: '11px', color: 'GrayText' }}>
                      {`Arg ${key}`}
                    </label>
                    <VSCodeTextField
                      style={{ width: '100%' }}
                      placeholder={getPlaceholder(item)}
                    />
                  </div>
                ))}
              </>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                marginTop: '8px',
              }}
            >
              <VSCodeButton disabled={isDisable} onClick={onExcute}>
                Excute
              </VSCodeButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
