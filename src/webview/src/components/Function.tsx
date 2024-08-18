import { useEffect, useState } from 'react';
import {
  VSCodeButton,
  VSCodeTextArea,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import {
  SuiMoveAbilitySet,
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
    justifyContent: 'space-between',
  },
  title: {
    marginTop: '0px',
    marginBottom: '0px',
  },
  arrow: {
    transition: 'transform 0.3s ease',
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
  isWrire,
  name,
  func,
  isDisable,
  onExcute,
}: {
  isWrire: boolean;
  name: string;
  func: SuiMoveNormalizedFunction;
  isDisable: boolean;
  onExcute: () => void;
}) => {
  const [parameters, setParameters] = useState<SuiMoveNormalizedType[]>([]);

  const [isOpen, setIsOpen] = useState(false);
  const [inputValues, setInputValues] = useState<string[]>([]);
  const [inputErrors, setInputErrors] = useState<boolean[]>([]);

  const allFieldsValid =
    inputErrors.every((error) => !error) &&
    inputValues.every((value) => value.trim() !== '');

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

  useEffect(() => {
    const temp = func.parameters.filter((type) => {
      if (typeof type === 'object') {
        const struct =
          (type as any).MutableReference?.Struct ||
          (type as any).Reference?.Struct ||
          (type as any).Struct;
        return !(
          struct &&
          struct.address === '0x2' &&
          struct.module === 'tx_context' &&
          struct.name === 'TxContext'
        );
      }
      return true;
    });
    setParameters(temp);
    setInputValues(new Array(temp.length).fill(''));
    setInputErrors(new Array(temp.length).fill(''));
    setIsOpen(false);
  }, [func]);

  return (
    <div style={styles.card}>
      <div style={{ flexDirection: 'column' }}>
        <div
          style={styles.titleBar}
          onClick={() => {
            setIsOpen(!isOpen);
          }}
        >
          <div style={styles.title}>{name}</div>
          <div
            style={{
              ...styles.arrow,
              transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
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
            {parameters.length > 0 && (
              <>
                {parameters.map((item, key) => (
                  <div key={key}>
                    <label style={{ fontSize: '11px', color: 'GrayText' }}>
                      {`Arg ${key}`}
                    </label>
                    {isComplexType(item) ? (
                      <VSCodeTextArea
                        rows={3}
                        style={{ width: '100%' }}
                        placeholder={getTypeName(item)}
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
                        placeholder={getTypeName(item)}
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
                        Invalid value for type {getTypeName(item)}
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
                {isWrire ? 'Write' : 'Read'}
              </VSCodeButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
