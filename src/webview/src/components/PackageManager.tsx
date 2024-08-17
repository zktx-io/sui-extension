import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { useRecoilState } from 'recoil';
import { Client, Package } from './Package';
import { ACCOUNT } from '../recoil';

export type PackageManagerHandles = {
  update: (packageId: string) => void;
};

export const PackageManager = forwardRef<PackageManagerHandles>(
  (props, ref) => {
    const [account] = useRecoilState(ACCOUNT);
    const [client, setClinet] = useState<Client | undefined>(undefined);
    const [list, setList] = useState<string[]>([]);

    useImperativeHandle(ref, () => ({
      update(packageId: string) {
        setList([...list, packageId]);
      },
    }));

    useEffect(() => {
      if (account) {
        setClinet(
          new SuiClient({
            url: getFullnodeUrl(account.nonce.network),
          }),
        );
      }
    }, [account]);

    return (
      <>
        {client &&
          list.map((id, key) => (
            <Package key={key} client={client} packageId={id} />
          ))}
      </>
    );
  },
);
