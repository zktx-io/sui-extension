import { SuiClient, SuiMoveNormalizedFunction } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { signAndExcute } from './signAndExcute';
import { COMMENDS } from './commends';
import { vscode } from './vscode';
import { makeParams } from './helper';
import { IAccount } from '../recoil';

export const moveCall = async (
  client: SuiClient,
  account: IAccount,
  target: string,
  func: SuiMoveNormalizedFunction,
  inputValues: Array<string | string[]>,
): Promise<{ digest: string }> => {
  if (account.nonce.privateKey && account.zkAddress) {
    try {
      const address = account.zkAddress.address;
      const transaction = new Transaction();
      transaction.setSender(address);
      transaction.moveCall({
        target,
        // typeArguments: func.typeParameters, // TODO
        arguments: inputValues.map((value, i) =>
          makeParams(transaction, value, func.parameters[i]),
        ),
      });
      const res = await signAndExcute(account, client, transaction);
      vscode.postMessage({
        command: COMMENDS.OutputInfo,
        data: JSON.stringify(res, null, 4),
      });
      return {
        digest: res.digest,
      };
    } catch (error) {
      throw new Error(`${error}`);
    }
  } else {
    throw new Error('account empty');
  }
};
