# Sui Extension

The Sui extension provides seamless support for compiling, deploying, and testing Sui smart contracts directly within VS Code. It enhances development productivity, especially when using GitHub Codespaces, by enabling unified management of front-end and back-end development within a single repository.

## Features

- **Compile Sui Smart Contracts**: Easily compile your Sui smart contracts from within VS Code.
- **Deploy and Test**: Deploy and test your smart contracts using the zkLogin-generated wallet, all from within the extension.
- **Format Sui Smart Contracts**: Format your Move smart contracts with Prettier, using `@mysten/prettier-plugin-move` for clean, readable, and consistent code.

  > Note: The extension supports formatting configurations defined in a `.prettierrc.json` file located in your project. These configurations allow you to customize the formatting rules for your Move files. If no configuration is found, the extension falls back to its default settings:

  ```json
  {
    "tabWidth": 4,
    "printWidth": 100,
    "useModuleLabel": true,
    "autoGroupImports": "module",
    "enableErrorDebug": false,
    "wrapComments": false
  }
  ```

  > Customize: To use a custom configuration, create a .prettierrc.json file in the root of your project directory with your preferred settings. For example:

  - Configuration Options:
  - tabWidth: Number of spaces per tab (default: 4).
  - printWidth: Maximum line length before wrapping (default: 100).
  - useModuleLabel: Converts old module blocks to a module label (default: true).
  - autoGroupImports: Controls how imports are grouped. Options: "module" (default) or "package".
  - enableErrorDebug: Enables debug information for formatting errors (default: false).
  - wrapComments: Wraps comments to adhere to the printWidth (default: false).

  ```json
  {
    "tabWidth": 2,
    "printWidth": 80,
    "useModuleLabel": false,
    "autoGroupImports": "package",
    "wrapComments": true
  }
  ```

- **GitHub Codespaces Integration**: Increase the efficiency of your development workflow with full support for GitHub Codespaces.
- **Unified Development**: Manage both front-end and back-end code in a single repository for streamlined development.
- **Upgrade Smart Contracts**: Seamlessly upgrade and test your smart contracts.

  > Note: To upgrade, add an `upgrade.toml` file in the same directory as your `move.toml` file. The format is as follows:

  ```toml
  [upgrade]
  package_id = "The address of the deployed package"
  upgrade_cap = "The UpgradeCap is the central type responsible for coordinating package upgrades."
  ```

## Interface Overview

![Sui Extension](https://docs.zktx.io/images/sui-extension.png)

1. **Wallet**: This section of the interface is used to manage wallets. You can create a wallet using Sui’s `zkLogin`. After selecting a network, click the `Google Login` button to create a wallet. Please note that wallets created using zkLogin will require re-authentication after a specific period. The currently supported networks are `Devnet` and `Testnet` (accessible via **[Enoki](https://docs.enoki.mystenlabs.com)**).
1. **Workspace**: This section of the interface allows you to compile or deploy Smart Contracts. If you have multiple smart contracts in your repository, you can select the specific smart contract (`Move.toml`) and proceed with compilation or deployment. If there is an `Upgrade.toml` file in the same folder as the `Move.toml` file, the contract will be upgraded rather than published.
1. **Owner Objects Explorer**: This section of the interface allows you to load and inspect owner objects, one of the key features of Sui. By loading objects, you can check its `type` to verify that it contains the appropriate information required for the function arguments of a deployed smart contract.
1. **Object Explorer**: This section of the interface allows you to load and inspect objects, one of the key features of Sui. By loading an object, you can check its `type` to verify that it contains the appropriate information required for the function arguments of a deployed smart contract.
1. **Package Explorer**: This section of the user interface allows you to test smart contracts. When you deploy a Smart Contract, it is automatically registered here. You can also manually enter the address of a previously deployed Smart Contract to register it. If the smart contract is loaded correctly, you will see a list of functions available to interact with the contract.
1. **Fromat**: Use the `Format` button. This ensures your code adheres to a consistent style, improving readability and maintainability.
1. **Output**: In this section, you can view the transaction execution data in raw format. Please select `Sui Extension` in the Task.

## Requirements

- **Sui CLI**: Install the Sui command-line interface to interact with the Sui blockchain.
  > Note: If you are using GitHub Codespaces, please install Homebrew from https://brew.sh first to manage and install the Sui CLI.
- **zkLogin**: Set up zkLogin to generate wallets for contract deployment and testing. A Google account is required.

## Extension Settings

- No additional configuration is required.

## Docs

- [link](https://docs.zktx.io/vsce/sui/)
