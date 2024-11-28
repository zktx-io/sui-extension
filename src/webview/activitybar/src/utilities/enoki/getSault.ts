import { Enoki } from '../commends';

export const getEnokiSalt = async (
  jwt: string,
): Promise<{
  address: string;
  salt: string;
}> => {
  const res = await fetch(`${Enoki.url}/zklogin`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Enoki.key}`,
      'zklogin-jwt': jwt,
    },
  });
  const { data } = (await res.json()) as {
    data: {
      address: string;
      salt: string;
    };
  };
  return data;
};
