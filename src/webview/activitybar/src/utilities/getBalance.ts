import { SuiClient } from '@mysten/sui/client';
import { SUI_DECIMALS } from '@mysten/sui/utils';
import BigNumber from 'bignumber.js';
import { IAccount } from '../recoil';

export const getBalance = async (
  client: SuiClient | undefined,
  account: IAccount | undefined,
): Promise<string | undefined> => {
  if (
    !!client &&
    account &&
    account.zkAddress &&
    account.zkAddress.address &&
    account.nonce.privateKey
  ) {
    try {
      const balance = await client.getBalance({
        owner: account.zkAddress.address,
      });
      const bn = new BigNumber(balance.totalBalance).shiftedBy(
        -1 * SUI_DECIMALS,
      );
      return `${bn.toFormat()} SUI`;
    } catch {
      return undefined;
    }
  } else {
    return undefined;
  }
};
