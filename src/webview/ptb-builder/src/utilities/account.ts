export enum NETWORK {
  MainNet = 'mainnet',
  TestNet = 'testnet',
  DevNet = 'devnet',
}

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
    proof?: string;
    salt?: string;
    jwt?: string;
  };
}
