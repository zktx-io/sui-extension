import { useEffect, useRef, useState } from 'react';
import {
  VSCodeButton,
  VSCodeTextArea,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { SuiMoveNormalizedType } from '@mysten/sui/client';
import { getTypeName } from '../utilities/helper';

const cardStyles = {
  card: {
    borderRadius: '4px',
    border: '1px solid var(--vscode-editorGroup-border)',
    backgroundColor: 'var(--vscode-titleBar-activeBackground)',
    color: 'var(--vscode-foreground)',
    width: '100%',
  },
};

export const VectorInputFields = ({
  error,
  paramType,
  update,
}: {
  error?: string;
  paramType: SuiMoveNormalizedType;
  update: (params: string[]) => void;
}) => {
  const debounceTimeout = useRef<NodeJS.Timeout | null>(null);
  const [vectorValues, setVectorValues] = useState<string[]>(['']);
  const [hexInput, setHexInput] = useState('');

  const handleAddField = () => {
    setVectorValues([...vectorValues, '']);
  };

  const handleRemoveField = (index: number) => {
    const newVectorValues = vectorValues.filter((_, i) => i !== index);
    setVectorValues(newVectorValues);
  };

  const handleChange = (index: number, value: string) => {
    const newVectorValues = [...vectorValues];
    newVectorValues[index] = value;
    setVectorValues(newVectorValues);
    update(newVectorValues);
  };

  const getChunkSize = (): number => {
    switch (paramType) {
      case 'U8':
        return 2;
      case 'U16':
        return 4;
      case 'U32':
        return 8;
      case 'U64':
        return 16;
      case 'U128':
        return 32;
      case 'U256':
        return 64;
      default:
        return 2;
    }
  };

  const handleInput = (e: any) => {
    const rawValue = e.target.value
      .replace(/^0x/i, '')
      .replace(/[^0-9A-F]/gi, '')
      .toUpperCase();
    setHexInput(rawValue);

    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    debounceTimeout.current = setTimeout(() => {
      const chunkSize = getChunkSize();
      const formatted =
        rawValue.match(new RegExp(`.{1,${chunkSize}}`, 'g'))?.join(' ') || '';
      setHexInput(formatted);
      setVectorValues(
        rawValue.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || [],
      );
      update(rawValue.match(new RegExp(`.{1,${chunkSize}}`, 'g')) || []);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
    };
  }, []);

  return (
    <>
      {paramType === 'U8' ||
      paramType === 'U16' ||
      paramType === 'U32' ||
      paramType === 'U64' ||
      paramType === 'U128' ||
      paramType === 'U256' ? (
        <div style={{ flexDirection: 'column' }}>
          <VSCodeTextArea
            rows={3}
            style={{ width: '100%' }}
            placeholder={`Vector<${paramType}>`}
            value={hexInput}
            onInput={handleInput}
          />
          {error && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '8px',
                width: '100%',
              }}
            >
              <span
                style={{
                  color: 'red',
                  fontSize: '11px',
                  wordWrap: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {error}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div style={cardStyles.card}>
          <div style={{ flexDirection: 'column', padding: '8px' }}>
            {vectorValues.map((value, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flexDirection: 'row',
                  marginBottom: '8px',
                  width: '100%',
                }}
              >
                {`[${index}]`}
                <VSCodeTextField
                  style={{ width: '100%', paddingLeft: '4px' }}
                  value={value}
                  placeholder={getTypeName(paramType)}
                  onInput={(e) =>
                    handleChange(index, (e.target as HTMLInputElement).value)
                  }
                />
                {vectorValues.length > 1 && (
                  <VSCodeButton
                    appearance="icon"
                    onClick={() => handleRemoveField(index)}
                    style={{ marginLeft: '8px' }}
                  >
                    <svg
                      width="16px"
                      height="16px"
                      viewBox="0 0 16 16"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        clipRule="evenodd"
                        d="M7.116 8l-4.558 4.558.884.884L8 8.884l4.558 4.558.884-.884L8.884 8l4.558-4.558-.884-.884L8 7.116 3.442 2.558l-.884.884L7.116 8z"
                      />
                    </svg>
                  </VSCodeButton>
                )}
              </div>
            ))}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '8px',
                width: '100%',
              }}
            >
              {error ? (
                <span
                  style={{
                    color: 'red',
                    fontSize: '11px',
                    wordWrap: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {error}
                </span>
              ) : (
                <>&nbsp;</>
              )}
              <VSCodeButton style={{ height: '16px' }} onClick={handleAddField}>
                <div style={{ fontSize: '8px' }}>Add</div>
              </VSCodeButton>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
