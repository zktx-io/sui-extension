import * as vscode from 'vscode';
import {
  ClientId,
  ClientSecret,
  PkceUrl,
} from '../webview/src/utilities/commends';

const exchangeAuthCodeForJwt = async (
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
        client_id: ClientId,
        client_secret: ClientSecret,
        redirect_uri: `${PkceUrl}/callback`,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });

    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      return tokenData.id_token;
    } else {
      vscode.window.showErrorMessage('Failed to exchange auth code for token.');
      return null;
    }
  } catch {
    return null;
  }
};

export const exchangeToken = (
  state: string,
  codeVerifier: string,
  getJwt: (token: string) => void,
) => {
  const intervalId = setInterval(async () => {
    try {
      const tokenResponse = await fetch(
        `${PkceUrl}/getAuthCode?state=${state}`,
      );
      const { authCode } = await tokenResponse.json();

      if (authCode) {
        clearInterval(intervalId);
        const jwt = await exchangeAuthCodeForJwt(authCode, codeVerifier);
        jwt && getJwt(jwt);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Error retrieving authCode: ${error}`);
    }
  }, 10000);
};
