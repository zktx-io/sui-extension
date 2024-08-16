import { getExtendedEphemeralPublicKey, jwtToAddress } from '@mysten/zklogin';
import { Ed25519PublicKey } from '@mysten/sui/keypairs/ed25519';
import Base64 from 'crypto-js/enc-base64';
import Hex from 'crypto-js/enc-hex';
import SHA256 from 'crypto-js/sha256';
import { INonce, NETWORK } from '../recoil';

const getProverUrl = (network: NETWORK): string => {
  switch (network) {
    case NETWORK.DevNet:
      return 'https://prover-dev.mystenlabs.com/v1';
    default:
      return 'https://prover.mystenlabs.com/v1';
  }
};

const getPath = (network: NETWORK, index?: number): string => {
  return `zkpath:${network}:0`;
};

export const createProof = async (
  { network, expiration, randomness, publicKey }: INonce,
  jwt: string,
): Promise<{ address: string; proof: string; salt: string }> => {
  const path = getPath(network);
  const salt = `0x${SHA256(path).toString(Hex).slice(0, 32)}`;
  const address = jwtToAddress(jwt, BigInt(salt));

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
      salt,
      keyClaimName: 'sub',
    }),
  });

  const data = await res.json();
  return { address, proof: JSON.stringify(data), salt };
};
