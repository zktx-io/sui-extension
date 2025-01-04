import { getFaucetHost, requestSuiFromFaucetV0 } from '@mysten/sui/faucet';
import { IAccount } from '../recoil';

export const faucet = async (account: IAccount): Promise<boolean> => {
  if (account.nonce.network !== 'mainnet' && account.zkAddress) {
    try {
      const res = await requestSuiFromFaucetV0({
        host: getFaucetHost(account.nonce.network),
        recipient: account.zkAddress?.address,
      });
      return !res.error;
    } catch {
      return false;
    }
  }
  return false;
};
