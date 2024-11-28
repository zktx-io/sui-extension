import { v4 as uuidv4 } from 'uuid';
import SHA256 from 'crypto-js/sha256';
import Base64 from 'crypto-js/enc-base64';
import * as querystring from 'querystring';
import { vscode } from './vscode';
import { ClientId, COMMENDS, UrlCallback } from './commends';

const generateLoginUrl = (
  state: string,
  codeChallenge: string,
  nonce: string,
): string => {
  return `https://accounts.google.com/o/oauth2/auth?${querystring.stringify({
    response_type: 'code',
    client_id: ClientId,
    redirect_uri: UrlCallback,
    scope: 'openid profile email',
    nonce,
    state,
    code_challenge_method: 'S256',
    code_challenge: codeChallenge,
  })}`;
};

export const googleLogin = async (nonce: string) => {
  const codeVerifier = uuidv4().replace(/-/g, '');
  const state = uuidv4().replace(/-/g, '');
  const codeChallenge = Base64.stringify(SHA256(codeVerifier))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  vscode.postMessage({
    command: COMMENDS.Login,
    data: {
      url: generateLoginUrl(state, codeChallenge, nonce),
      state,
      codeVerifier,
    },
  });
};
