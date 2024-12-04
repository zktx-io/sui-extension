import { COMMENDS } from './commends';
import { vscode } from './vscode';

export type ToastVariant = 'error' | 'info' | 'success' | 'warning';

export const postMessage = (
  message: string,
  { variant }: { variant: ToastVariant },
) => {
  switch (variant) {
    case 'info':
    case 'success':
      vscode.postMessage({ command: COMMENDS.MsgInfo, data: message });
      break;
    case 'error':
    case 'warning':
      vscode.postMessage({ command: COMMENDS.MsgError, data: message });
      break;
    default:
      break;
  }
};
