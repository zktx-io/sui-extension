import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { SUI_DECIMALS } from '@mysten/sui/utils';
import BigNumber from 'bignumber.js';
import { IAccount } from '../recoil';

export const getBalance = async (account: IAccount): Promise<string> => {
  if (account.nonce.privateKey && account.zkAddress) {
    try {
      const client = new SuiClient({
        url: getFullnodeUrl(account.nonce.network),
      });
      const balance = await client.getBalance({
        owner: account.zkAddress.address,
      });
      const bn = new BigNumber(balance.totalBalance).shiftedBy(
        -1 * SUI_DECIMALS,
      );
      return `${bn.toFormat()} SUI`;
    } catch (error) {
      throw new Error(`${error}`);
    }
  } else {
    return 'n/a';
  }
};
