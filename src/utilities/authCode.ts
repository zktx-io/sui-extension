import * as vscode from 'vscode';
import {
  ClientId,
  ClientSecret,
  UrlAuthCode,
  UrlCallback,
} from '../webview/activitybar/src/utilities/commends';

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
        redirect_uri: UrlCallback,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });

    if (tokenResponse.ok) {
      const tokenData: any = await tokenResponse.json();
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
  done: () => void,
  maxRetries: number = 6,
) => {
  let retryCount = 0;

  const intervalId = setInterval(async () => {
    try {
      const tokenResponse = await fetch(`${UrlAuthCode}?state=${state}`);
      const { authCode }: any = await tokenResponse.json();

      if (authCode) {
        clearInterval(intervalId);
        const jwt = await exchangeAuthCodeForJwt(authCode, codeVerifier);
        jwt && getJwt(jwt);
      } else {
        retryCount++;
        if (retryCount >= maxRetries) {
          clearInterval(intervalId);
          vscode.window.showErrorMessage('Maximum retry attempts reached');
        }
      }
    } catch (error) {
      retryCount++;
      if (retryCount >= maxRetries) {
        clearInterval(intervalId);
        vscode.window.showErrorMessage('Maximum retry attempts reached');
        done();
      }
    }
  }, 5000);
};
