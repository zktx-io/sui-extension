export const CHANNEL = 'Sui Extension';
export const COMPILER = 'sui';
export const COMPILER_URL =
  'https://docs.sui.io/guides/developer/getting-started/sui-install';
export const MoveToml = 'Move.toml';
export const ByteDump = 'bytecode.dump.json';

export const runBuild = (path: string) => {
  return `${COMPILER} move build --dump-bytecode-as-base64 --path ${path} > ${path}/${ByteDump}`;
};

export const runTest = (path: string) => {
  return `${COMPILER} move test --path ${path}`;
};
