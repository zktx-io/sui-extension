import * as vscode from 'vscode';

export type FileMap = Record<string, string>;

export interface MoveTemplate {
  id: string;
  label: string;
  defaultName: string;
  description: string;
  detail: string;
  files: (pkgName: string) => FileMap;
}

/** Picker item shape */
export interface PTBTemplateItem {
  id: string;
  label: string;
  defaultName: string;
  description: string;
  detail: string;
  file: () => string;
}

// templates/readmeCommon.ts
export const COMMON_README_TAIL = `
## Build & Deploy

You can build and deploy in two ways:

- **CLI**
  1. Run \`sui move build\` to compile the package.
  2. Run \`sui client publish .\` to deploy it on your target network.

- **Sui VS Code Extension**
  1. Open the **Sui** panel (Build view) inside VS Code.
  2. Select your package from the list and click **Build**.
  3. From the same panel, you can also **Deploy/Publish** the built package.

## Sending Transactions with the PTB Builder

1. Open the **PTB Builder** (new visual editor for Programmable Transaction Blocks).
2. Add a **MoveCall** node and paste the **deployed package ID** (address).
3. Load the module and function ABI, then set arguments/type arguments as required.
4. Connect signer and gas nodes, and finally **Send** the transaction.
`.trim();

/** Append the common tail to any README body. */
export const withCommon = (readme: string) =>
  `${readme.trim()}\n\n${COMMON_README_TAIL}`;
