import {
  VSCodeTextArea,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { SuiObjectResponse } from '@mysten/sui/client';

export const SuiObject = ({
  showObjectID,
  objectInfo,
}: {
  showObjectID?: boolean;
  objectInfo?: SuiObjectResponse;
}) => {
  return (
    <>
      {showObjectID && (
        <>
          <label style={{ fontSize: '11px', color: 'GrayText' }}>
            Object Id
          </label>
          <VSCodeTextField
            style={{ width: '100%' }}
            value={objectInfo?.data?.objectId || ''}
            readOnly
          />
        </>
      )}
      <label style={{ fontSize: '11px', color: 'GrayText' }}>Type</label>
      <VSCodeTextArea
        rows={2}
        resize="vertical"
        style={{ width: '100%' }}
        value={objectInfo?.data?.type || ''}
        readOnly
      />

      <label style={{ fontSize: '11px', color: 'GrayText' }}>Version</label>
      <VSCodeTextField
        style={{ width: '100%' }}
        value={objectInfo?.data?.version || ''}
        readOnly
      />

      <label style={{ fontSize: '11px', color: 'GrayText' }}>Digest</label>
      <VSCodeTextField
        style={{ width: '100%' }}
        value={objectInfo?.data?.digest || ''}
        readOnly
      />

      <label style={{ fontSize: '11px', color: 'GrayText' }}>Content</label>
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
    </>
  );
};
