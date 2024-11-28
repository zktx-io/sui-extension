import { vscode } from './vscode';

interface IPackage {
  path?: string;
  packages: { [x: string]: any };
}

const setState = (state: IPackage) => {
  vscode.setState(state);
};

export const packageAdd = (objectId: string, modules: any): IPackage => {
  const state: IPackage = dataGet();
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

export const packageDelete = (objectId: string): IPackage => {
  const state = dataGet();
  state.packages && delete state.packages[objectId];
  setState({
    ...state,
  });
  return dataGet();
};

export const packageSelect = (path?: string): IPackage => {
  const state = dataGet();
  setState({
    ...state,
    path,
  });
  const temp: IPackage = dataGet();
  return temp;
};

export const dataGet = (): IPackage => {
  const temp: IPackage = (vscode.getState() as any) || {
    packages: {},
  };
  return temp;
};
