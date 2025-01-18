import { SuiClient, SuiMoveNormalizedFunction } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { signAndExcute } from './signAndExcute';
import { makeParams } from './helper';
import { IAccount } from '../recoil';

export const moveCall = async (
  client: SuiClient,
  account: IAccount,
  target: string,
  func: SuiMoveNormalizedFunction,
  inputValues: Array<string>,
  typeArguments: string[],
): Promise<void> => {
  if (account.nonce.privateKey && account.zkAddress) {
    try {
      const address = account.zkAddress.address;
      const transaction = new Transaction();
      transaction.setSender(address);
      transaction.moveCall({
        target,
        ...(inputValues.length > 0 && {
          arguments: inputValues.map((value, i) =>
            makeParams(transaction, func.parameters[i], value),
          ),
        }),
        ...(typeArguments.length > 0 && { typeArguments }),
      });
      await signAndExcute(account, client, transaction);
    } catch (error) {
      throw new Error(`${error}`);
    }
  } else {
    throw new Error('account empty');
  }
};
