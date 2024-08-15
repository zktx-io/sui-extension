import { v4 as uuidv4 } from 'uuid';
import SHA256 from 'crypto-js/sha256';
import Base64 from 'crypto-js/enc-base64';
import * as querystring from 'querystring';
import { vscode } from './vscode';
import { COMMENDS } from './commends';

const clientId =
  '39820794793-qgodeckj0dobe2qd7o23s8etn8j5lf05.apps.googleusercontent.com';
const redirectUri =
  'https://us-central1-proof-key-exchange.cloudfunctions.net/callback';

const generateLoginUrl = (state: string, codeChallenge: string): string => {
  return `https://accounts.google.com/o/oauth2/auth?${querystring.stringify({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'openid profile email',
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  })}`;
};

const exchangeAuthCodeForToken = async (
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
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      }),
    });

    if (tokenResponse.ok) {
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      return accessToken;
    } else {
      vscode.postMessage({
        command: COMMENDS.MsgError,
        data: 'Failed to exchange auth code for token.',
      });
      return null;
    }
  } catch {
    return null;
  }
};

export const googleLogin = async () => {
  const codeVerifier = uuidv4().replace(/-/g, '');
  const state = uuidv4().replace(/-/g, '');
  const codeChallenge = Base64.stringify(SHA256(codeVerifier))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  vscode.postMessage({
    command: COMMENDS.Login,
    data: generateLoginUrl(state, codeChallenge),
  });

  const intervalId = setInterval(async () => {
    try {
      const tokenResponse = await fetch(
        `https://us-central1-proof-key-exchange.cloudfunctions.net/getAuthCode?state=${state}`,
      );
      const { authCode } = await tokenResponse.json();

      if (authCode) {
        clearInterval(intervalId);
        const accessToken = await exchangeAuthCodeForToken(
          authCode,
          codeVerifier,
        );
        if (accessToken) {
          vscode.postMessage({
            command: COMMENDS.StoreToken,
            data: accessToken,
          });
        }
      }
    } catch (error) {
      vscode.postMessage({
        command: COMMENDS.MsgError,
        data: `Error retrieving authCode: ${error}`,
      });
    }
  }, 5000);
};
