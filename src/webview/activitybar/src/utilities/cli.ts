export const CHANNEL = 'Sui Extension';
export const COMPILER = 'sui';
export const COMPILER_URL =
  'https://docs.sui.io/guides/developer/getting-started/sui-install';
export const MoveToml = 'Move.toml';
export const ByteDump = 'bytecode.dump.json';

// Shell escape function to prevent command injection
const shellEscape = (arg: string): string => {
  // Replace single quotes with '\'' and wrap in single quotes
  // This works for both bash/zsh and PowerShell
  return `'${arg.replace(/'/g, "'\\''")}'`;
};

export const runBuild = (path: string) => {
  const escapedPath = shellEscape(path);
  return `${COMPILER} move build --dump-bytecode-as-base64 --path ${escapedPath} > ${escapedPath}/${ByteDump}`;
};

export const runTest = (path: string) => {
  const escapedPath = shellEscape(path);
  return `${COMPILER} move test --path ${escapedPath}`;
};
