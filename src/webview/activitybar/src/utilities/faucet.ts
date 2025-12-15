import { getFaucetHost, requestSuiFromFaucetV2 } from '@mysten/sui/faucet';
import { IAccount } from '../recoil';

export const faucet = async (account: IAccount): Promise<boolean> => {
  if (account.nonce.network !== 'mainnet' && account.zkAddress) {
    try {
      const res = await requestSuiFromFaucetV2({
        host: getFaucetHost(account.nonce.network),
        recipient: account.zkAddress.address,
      });
      return res.status === 'Success';
    } catch (error) {
      console.error('Faucet request failed:', error);
      return false;
    }
  }
  return false;
};
