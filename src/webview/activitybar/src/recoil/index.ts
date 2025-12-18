import { atom } from 'recoil';
import type { SuiMoveNormalizedModules } from '@mysten/sui/client';

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
    proof?: string;
    salt?: string;
    jwt?: string;
  };
}

export interface IPackageEntry {
  index: number;
  data: SuiMoveNormalizedModules;
  upgradeCap?: string;
  upgradeCapChecked?: boolean;
  upgradeCapValidated?: boolean;
  path?: string;
}

export type PackageMap = Record<string, IPackageEntry>;

export interface IState {
  account?: IAccount;
  canSign?: boolean;
  balance?: string;
  path?: string;
  packages: PackageMap;
}

export const STATE = atom<IState>({
  key: 'State',
  default: {
    packages: {},
    canSign: false,
  },
});
