import React from 'react';
import ReactDOM from 'react-dom/client';
import { VSCodeButton } from '@vscode/webview-ui-toolkit/react';
import { closeSnackbar, SnackbarProvider } from 'notistack';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);
root.render(
  <React.StrictMode>
    <SnackbarProvider
      anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
      hideIconVariant
      action={(snackbarId) => (
        <VSCodeButton
          appearance="icon"
          onClick={() => closeSnackbar(snackbarId)}
          style={{ padding: 0 }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="white"
            width="20"
            height="20"
          >
            <path
              d="M18 6L6 18M6 6l12 12"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </VSCodeButton>
      )}
    />
    <App />
  </React.StrictMode>,
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
