import { useState } from 'react';
import {
  VSCodeButton,
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
  const [vectorValues, setVectorValues] = useState<string[]>(['']);

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

  return (
    <div style={cardStyles.card}>
      <div style={{ flexDirection: 'column', padding: '8px' }}>
        {vectorValues.map((value, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              marginBottom: '8px',
              width: '100%',
            }}
          >
            <VSCodeTextField
              style={{ width: '100%' }}
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
  );
};
