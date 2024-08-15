import { atom } from 'recoil';

export type CRYPTO = 'ed25519';
export type NETWORK = 'mainnet' | 'testnet' | 'devnet';

export interface INonce {
  crypto: CRYPTO;
  expiration: number;
  randomness: string;
  network: NETWORK;
  publicKey: string;
  privateKey?: string; // TODO: fix webauthn
}

interface IAccount {
  nonce: INonce;
  zkAddress?: {
    address: string;
    proof: string;
    salt: string;
    jwt: string;
  };
}

export const STATE = atom<IAccount | undefined>({
  key: 'Account',
  default: undefined,
});
