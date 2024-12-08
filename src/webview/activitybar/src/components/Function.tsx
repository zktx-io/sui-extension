import { useEffect, useState } from 'react';
import {
  VSCodeTextArea,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { useRecoilState } from 'recoil';
import {
  SuiMoveNormalizedFunction,
  SuiMoveNormalizedType,
} from '@mysten/sui/client';
import {
  getInterfaceType,
  getTypeName,
  validateInput,
} from '../utilities/helper';
import { removeTxContext } from '../utilities/removeTxContext';
import { VectorInputFields } from './VectorInputFields';
import { STATE } from '../recoil';
import { SpinButton } from './SpinButton';

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
  titleContainer: {
    display: 'flex',
    alignItems: 'center',
  },
  title: {
    margin: '0',
    fontSize: '14px',
  },
  icon: {
    marginRight: '4px',
    cursor: 'default',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '12px',
    height: '10px',
    borderRadius: '2px',
    border: '1px dotted var(--vscode-foreground)',
    color: 'var(--vscode-foreground)',
    fontSize: '8px',
    fontWeight: 'bold' as const,
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
  isWrite,
  name,
  func,
  isDisable,
  onExcute,
}: {
  isWrite: boolean;
  name: string;
  func: SuiMoveNormalizedFunction;
  isDisable: boolean;
  onExcute: (
    name: string,
    func: SuiMoveNormalizedFunction,
    inputValues: Array<string | string[]>,
  ) => Promise<void>;
}) => {
  const [state] = useRecoilState(STATE);
  const [parameters, setParameters] = useState<SuiMoveNormalizedType[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [inputValues, setInputValues] = useState<Array<string | string[]>>([]);
  const [inputErrors, setInputErrors] = useState<boolean[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const handleInputChange = (index: number, value: string | string[]) => {
    const newInputValues = [...inputValues];
    newInputValues[index] = value;
    setInputValues(newInputValues);
  };

  const handleExcute = async (
    name: string,
    func: SuiMoveNormalizedFunction,
    inputValues: Array<string | string[]>,
  ) => {
    try {
      setIsLoading(true);
      let errors: boolean[] = [...new Array(inputValues.length).fill(false)];
      for (let i = 0; i < inputValues.length; i++) {
        if (state.account) {
          const filtered = removeTxContext(func);
          const temp = await validateInput(
            state.account,
            filtered[i],
            inputValues[i],
          );
          errors[i] = !temp;
        }
      }
      setInputErrors(errors);
      !!state.account &&
        errors.every((value) => value === false) &&
        (await onExcute(name, func, inputValues));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const filtered = removeTxContext(func);
    setParameters(filtered);
    setInputValues(new Array(filtered.length).fill(''));
    setInputErrors(new Array(filtered.length).fill(false));
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
          <div style={styles.titleContainer}>
            {isWrite ? (
              func.isEntry ? (
                <span style={styles.icon} title="entry">
                  E
                </span>
              ) : (
                <span style={styles.icon} title="public">
                  P
                </span>
              )
            ) : (
              <span style={styles.icon} title="read">
                R
              </span>
            )}
            <div style={styles.title}>{name}</div>
          </div>
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
                    {getInterfaceType(item) === 'vector' && (
                      <VectorInputFields
                        error={
                          inputErrors[key]
                            ? `Invalid value for type ${getTypeName(item)}`
                            : undefined
                        }
                        paramType={(item as any).Vector}
                        update={(params: string[]) => {
                          handleInputChange(key, params);
                        }}
                      />
                    )}
                    {getInterfaceType(item) === 'complex' && (
                      <>
                        <VSCodeTextArea
                          rows={3}
                          style={{ width: '100%' }}
                          placeholder={getTypeName(item)}
                          value={inputValues[key] as string}
                          onInput={(e) =>
                            handleInputChange(
                              key,
                              (e.target as HTMLTextAreaElement).value,
                            )
                          }
                        />
                        {inputErrors[key] && (
                          <span
                            style={{
                              color: 'red',
                              fontSize: '11px',
                              wordWrap: 'break-word',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            Invalid value for type {getTypeName(item)}
                          </span>
                        )}
                      </>
                    )}
                    {getInterfaceType(item) === 'other' && (
                      <>
                        <VSCodeTextField
                          style={{ width: '100%' }}
                          placeholder={getTypeName(item)}
                          value={inputValues[key] as string}
                          onInput={(e) =>
                            handleInputChange(
                              key,
                              (e.target as HTMLInputElement).value,
                            )
                          }
                        />
                        {inputErrors[key] && (
                          <span
                            style={{
                              color: 'red',
                              fontSize: '11px',
                              wordWrap: 'break-word',
                              whiteSpace: 'pre-wrap',
                            }}
                          >
                            Invalid value for type {getTypeName(item)}
                          </span>
                        )}
                      </>
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
              <SpinButton
                title={isWrite ? 'Write' : 'Read'}
                spin={isLoading}
                disabled={isDisable || isLoading}
                onClick={() => {
                  handleExcute(name, func, inputValues);
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
