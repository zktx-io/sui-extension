import {
  getExtendedEphemeralPublicKey,
  jwtToAddress,
} from '@mysten/sui/zklogin';
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import { INonce, NETWORK } from '../recoil';
import { getEnokiSalt } from './enoki/getSault';
import { Enoki } from './commends';

const getProverUrl = (network: NETWORK): string => {
  switch (network) {
    case NETWORK.DevNet:
      return 'https://prover-dev.mystenlabs.com/v1';
    default:
      return 'https://prover.mystenlabs.com/v1';
  }
};

export const createProof = async (
  { network, expiration, randomness, publicKey }: INonce,
  jwt: string,
): Promise<{ address: string; proof: string; salt: string }> => {
  const enoki = await getEnokiSalt(jwt);

  if (network === 'testnet') {
    const res = await fetch(`${Enoki.url}/zklogin/zkp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${Enoki.key}`,
        'zklogin-jwt': jwt,
      },
      body: JSON.stringify({
        network: network,
        randomness: randomness,
        maxEpoch: expiration,
        ephemeralPublicKey: getExtendedEphemeralPublicKey(
          new Ed25519PublicKey(Buffer.from(publicKey, 'base64')),
        ),
      }),
    });

    const { data, errors } = await res.json();

    if (!data) {
      throw new Error(`${errors}`);
    }

    return {
      address: enoki.address,
      proof: JSON.stringify(data),
      salt: enoki.salt,
    };
  }

  const address = jwtToAddress(jwt, BigInt(enoki.salt));
  const res = await fetch(getProverUrl(network), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jwt,
      extendedEphemeralPublicKey: getExtendedEphemeralPublicKey(
        new Ed25519PublicKey(Buffer.from(publicKey, 'base64')),
      ),
      maxEpoch: expiration,
      jwtRandomness: randomness,
      salt: enoki.salt,
      keyClaimName: 'sub',
    }),
  });

  if (res.ok) {
    const data = await res.json();
    return { address, proof: JSON.stringify(data), salt: enoki.salt };
  } else {
    throw new Error('Login Fail - create proof error');
  }
};
