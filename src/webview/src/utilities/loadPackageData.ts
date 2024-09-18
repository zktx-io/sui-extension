import { SuiClient, SuiMoveNormalizedModules } from '@mysten/sui/client';
import { vscode } from './vscode';
import { COMMENDS } from './commends';

export const loadPackageData = async (
  client: SuiClient | undefined,
  objectId: string,
): Promise<SuiMoveNormalizedModules | undefined> => {
  if (client) {
    try {
      const modules: SuiMoveNormalizedModules =
        await client.getNormalizedMoveModulesByPackage({
          package: objectId,
        });
      return modules;
    } catch (error) {
      vscode.postMessage({
        command: COMMENDS.MsgError,
        data: `${error}`,
      });
      return undefined;
    }
  }
  vscode.postMessage({
    command: COMMENDS.MsgError,
    data: 'client is undefined',
  });
  return undefined;
};
