import * as vscode from 'vscode';

export type SuiNetwork = 'testnet' | 'devnet' | 'mainnet';

export type FileMap = Record<string, string>;

export interface MoveTemplate {
  id: string;
  label: string;
  defaultName: string;
  description: string;
  detail: string;
  files: (pkgName: string, network: SuiNetwork) => FileMap;
}

/** Picker item shape */
export interface PTBTemplateItem {
  id: string;
  label: string;
  defaultName: string;
  description: string;
  detail: string;
  file: () => string;
}
