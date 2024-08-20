import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import {
  VSCodeButton,
  VSCodeDivider,
  VSCodeDropdown,
  VSCodeOption,
  VSCodeTextField,
} from '@vscode/webview-ui-toolkit/react';
import { SpinButton } from './SpinButton';
import { ACCOUNT, NETWORK, NETWORKS } from '../recoil';
import { useRecoilState } from 'recoil';
import { createNonce } from '../utilities/createNonce';
import { googleLogin } from '../utilities/googleLogin';
import { vscode } from '../utilities/vscode';
import { COMMENDS } from '../utilities/commends';
import { getBalance } from '../utilities/getBalance';
import { createProof } from '../utilities/createProof';

export type AccountHandles = {
  updateBalance: () => void;
};

export const Account = forwardRef<AccountHandles>((props, ref) => {
  const [account, setAccount] = useRecoilState(ACCOUNT);
  const [balance, setBalance] = useState<string>('n/a');
  const [network, setNetwork] = useState<NETWORK>(NETWORK.DevNet);
  const [isLogin, setIsLogin] = useState<boolean>(false);

  useImperativeHandle(ref, () => ({
    updateBalance: async () => {
      const value = account && (await getBalance(account));
      setBalance(value || 'n/a');
    },
  }));

  const handleLogin = async () => {
    setIsLogin(true);
    const {
      nonce,
      expiration,
      randomness,
      ephemeralKeyPair: { publicKey, privateKey },
    } = await createNonce(network);
    setAccount({
      nonce: {
        expiration,
        randomness,
        network,
        publicKey,
        privateKey,
      },
    });
    await googleLogin(nonce);
  };

  const handleLogout = async () => {
    vscode.postMessage({
      command: COMMENDS.StoreAccount,
      data: undefined,
    });
    setAccount(undefined);
    setBalance('n/a');
  };

  useEffect(() => {
    const updateBalance = async () => {
      try {
        const value = account && (await getBalance(account));
        setBalance(value || 'n/a');
      } catch (error) {
        setBalance('n/a');
      }
    };

    const handleMessage = async (event: any) => {
      const message = event.data;
      switch (message.command) {
        case COMMENDS.LoginJwt:
          if (account && message.data) {
            try {
              const { address, proof, salt } = await createProof(
                account.nonce,
                message.data,
              );
              setAccount({
                ...account,
                zkAddress: {
                  address,
                  proof,
                  salt,
                  jwt: message.data,
                },
              });
              vscode.postMessage({
                command: COMMENDS.StoreAccount,
                data: {
                  ...account,
                  zkAddress: {
                    address,
                    proof,
                    salt,
                    jwt: message.data,
                  },
                },
              });
            } catch (error) {
              vscode.postMessage({
                command: COMMENDS.MsgError,
                data: `${error}`,
              });
            } finally {
              setIsLogin(false);
            }
          } else {
            setIsLogin(false);
          }
          break;
        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    updateBalance();

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [account, setAccount]);

  return (
    <>
      <div
        style={{
          width: '100%',
          padding: '6px 0',
          fontWeight: 'bold',
          marginBottom: '4px',
        }}
      >
        Wallet
        <VSCodeDivider />
      </div>
      <label style={{ fontSize: '11px', color: 'GrayText' }}>ACCOUNT</label>
      <VSCodeTextField
        style={{ width: '100%' }}
        readOnly
        value={account?.zkAddress?.address || ''}
      />
      <div
        style={{
          fontSize: '11px',
          color: 'GrayText',
          marginBottom: '8px',
          textAlign: 'right',
        }}
      >{`Balance: ${balance}`}</div>

      <label style={{ fontSize: '11px', color: 'GrayText' }}>NETWORK</label>
      <VSCodeDropdown
        style={{ width: '100%', marginBottom: '8px' }}
        value={network}
        disabled={!!account?.zkAddress?.address || isLogin}
        onChange={(e) => {
          e.target &&
            setNetwork((e.target as HTMLInputElement).value as NETWORK);
        }}
      >
        {NETWORKS.map((network, index) => (
          <VSCodeOption key={index} value={network}>
            {network}
          </VSCodeOption>
        ))}
      </VSCodeDropdown>
      {!account?.zkAddress ? (
        <SpinButton
          title="Google Login"
          spin={isLogin}
          disabled={isLogin}
          width="100%"
          onClick={handleLogin}
        />
      ) : (
        <VSCodeButton
          style={{ width: '100%' }}
          disabled={isLogin}
          onClick={handleLogout}
        >
          Logout
        </VSCodeButton>
      )}
    </>
  );
});
