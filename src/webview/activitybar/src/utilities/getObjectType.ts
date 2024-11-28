import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { IAccount } from '../recoil';

export const getObjectType = async (
  account: IAccount,
  objectId: string,
): Promise<string> => {
  try {
    const client = new SuiClient({
      url: getFullnodeUrl(account.nonce.network),
    });
    const res = await client.getObject({
      id: objectId,
      options: {
        showContent: true,
        showType: true,
        showOwner: true,
      },
    });
    if (res.error || !res.data?.type) {
      throw new Error(`${res.error}`);
    }
    return res.data.type;
  } catch (error) {
    throw new Error(`${error}`);
  }
};
