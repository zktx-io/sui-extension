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
  inputValues: Array<string | string[]>,
): Promise<void> => {
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
      await signAndExcute(account, client, transaction);
    } catch (error) {
      throw new Error(`${error}`);
    }
  } else {
    throw new Error('account empty');
  }
};
