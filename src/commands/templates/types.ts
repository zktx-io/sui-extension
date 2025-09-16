import * as vscode from 'vscode';

export type FileMap = Record<string, string>;

export interface MoveTemplate {
  id: string;
  label: string;
  defaultName: string;
  description: string;
  detail: string;
  files: (pkgName: string) => FileMap;
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
