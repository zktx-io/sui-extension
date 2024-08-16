import { atom } from 'recoil';

export enum NETWORK {
  MainNet = 'mainnet',
  TestNet = 'testnet',
  DevNet = 'devnet',
}

export const NETWORKS: NETWORK[] = [
  NETWORK.DevNet,
  NETWORK.TestNet,
  // NETWORK.MainNet,
];

export interface INonce {
  expiration: number;
  randomness: string;
  network: NETWORK;
  publicKey: string;
  privateKey?: string; // TODO: fix webauthn
}

export interface IAccount {
  nonce: INonce;
  zkAddress?: {
    address: string;
    proof: string;
    salt: string;
    jwt: string;
  };
}

export const ACCOUNT = atom<IAccount | undefined>({
  key: 'Account',
  default: undefined,
});
