import type { SuiMoveNormalizedModules } from '@mysten/sui/client';
import { vscode } from './vscode';
import type { PackageMap } from '../recoil';

interface StoredPackageState {
  path?: string;
  packages: PackageMap;
}

const setState = (state: StoredPackageState) => {
  vscode.setState(state);
};

export const packageAdd = (
  objectId: string,
  modules: SuiMoveNormalizedModules,
): StoredPackageState => {
  const state = dataGet();
  const index = Date.now();
  setState({
    ...state,
    packages: state.packages
      ? {
          ...state.packages,
          [objectId]: { index, data: modules },
        }
      : {
          [objectId]: { index, data: modules },
        },
  });
  return dataGet();
};

export const packageDelete = (objectId: string): StoredPackageState => {
  const state = dataGet();
  const { [objectId]: deletedEntry, ...rest } = state.packages;
  if (!deletedEntry) {
    return state;
  }
  setState({
    ...state,
    packages: rest,
  });
  return dataGet();
};

export const packageSelect = (path?: string): StoredPackageState => {
  const state = dataGet();
  setState({
    ...state,
    path,
  });
  const temp = dataGet();
  return temp;
};

export const dataGet = (): StoredPackageState => {
  const persisted = vscode.getState() as StoredPackageState | undefined;
  return persisted ?? { packages: {} };
};
