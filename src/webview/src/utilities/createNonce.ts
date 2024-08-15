import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { generateNonce, generateRandomness } from '@mysten/zklogin';
import { NETWORK } from '../recoil';

export const createNonce = async (
  network: NETWORK,
): Promise<{
  nonce: string;
  expiration: number;
  randomness: string;
  ephemeralKeyPair: { publicKey: string; secretKey: string };
}> => {
  const suiClient = new SuiClient({ url: getFullnodeUrl(network) });
  const { epoch } = await suiClient.getLatestSuiSystemState();

  const expiration = Number(epoch) + 9;
  const ephemeralKeyPair = new Ed25519Keypair();
  const randomness = generateRandomness();
  const nonce = generateNonce(
    ephemeralKeyPair.getPublicKey(),
    expiration,
    randomness,
  );
  return {
    nonce,
    expiration,
    randomness,
    ephemeralKeyPair: {
      publicKey: ephemeralKeyPair.getPublicKey().toBase64(),
      secretKey: ephemeralKeyPair.getSecretKey(),
    },
  };
};
