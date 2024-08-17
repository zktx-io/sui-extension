import { useState } from 'react';
import {
  VSCodeButton,
  VSCodeTextArea,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import {
  SuiMoveNormalizedFunction,
  SuiMoveNormalizedType,
} from '@mysten/sui/client';
import { getTypeName, isComplexType, validateInput } from './utils';

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
    padding: '8px 12px',
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
  packageId,
  func,
  isDisable,
  onExcute,
}: {
  name: string;
  packageId: string;
  func: SuiMoveNormalizedFunction;
  isDisable: boolean;
  onExcute: () => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValues, setInputValues] = useState<string[]>(
    new Array(func.parameters.length).fill(''),
  );
  const [inputErrors, setInputErrors] = useState<boolean[]>(
    new Array(func.parameters.length).fill(false),
  );

  const allFieldsValid =
    inputErrors.every((error) => !error) &&
    inputValues.every((value) => value.trim() !== '');

  const toggleCard = () => {
    setIsOpen(!isOpen);
  };

  const handleInputChange = (
    index: number,
    value: string,
    expectedType: SuiMoveNormalizedType,
  ) => {
    const newInputValues = [...inputValues];
    const newInputErrors = [...inputErrors];

    newInputValues[index] = value;

    if (value.trim()) {
      newInputErrors[index] = !validateInput(value, expectedType);
    } else {
      newInputErrors[index] = false;
    }

    setInputValues(newInputValues);
    setInputErrors(newInputErrors);
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
                    {isComplexType(item) ? (
                      <VSCodeTextArea
                        rows={3}
                        style={{ width: '100%' }}
                        placeholder={getTypeName(packageId, item)}
                        value={inputValues[key]}
                        onInput={(e) =>
                          handleInputChange(
                            key,
                            (e.target as HTMLTextAreaElement).value,
                            item,
                          )
                        }
                      />
                    ) : (
                      <VSCodeTextField
                        style={{ width: '100%' }}
                        placeholder={getTypeName(packageId, item)}
                        value={inputValues[key]}
                        onInput={(e) =>
                          handleInputChange(
                            key,
                            (e.target as HTMLInputElement).value,
                            item,
                          )
                        }
                      />
                    )}
                    {inputErrors[key] && (
                      <span style={{ color: 'red', fontSize: '11px' }}>
                        Invalid value for type {getTypeName(packageId, item)}
                      </span>
                    )}
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
              <VSCodeButton
                disabled={isDisable || !allFieldsValid}
                onClick={onExcute}
              >
                Execute
              </VSCodeButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
