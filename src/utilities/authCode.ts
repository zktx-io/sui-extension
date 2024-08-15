import * as vscode from 'vscode';
import { COMMENDS, PkceUrl } from '../webview/src/utilities/commends';

const exchangeAuthCodeForToken = async (
  clientId: string,
  authCode: string,
  codeVerifier: string,
): Promise<string | null> => {
  try {
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code: authCode,
        client_id: clientId,
        redirect_uri: `${PkceUrl}/callback`,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });

    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      return accessToken;
    } else {
      vscode.window.showErrorMessage('Failed to exchange auth code for token.');
      return null;
    }
  } catch {
    return null;
  }
};

export const exchangeToken = (
  clientId: string,
  state: string,
  codeVerifier: string,
  getAccessToken: (token: string) => void,
) => {
  const intervalId = setInterval(async () => {
    try {
      const tokenResponse = await fetch(
        `${PkceUrl}/getAuthCode?state=${state}`,
      );
      const { authCode } = await tokenResponse.json();

      if (authCode) {
        clearInterval(intervalId);
        const accessToken = await exchangeAuthCodeForToken(
          clientId,
          authCode,
          codeVerifier,
        );
        accessToken && getAccessToken(accessToken);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error retrieving authCode: ${error}`);
    }
  }, 5000);
};
