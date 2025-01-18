# Sui Extension

The Sui extension provides seamless support for compiling, deploying, and testing Sui smart contracts directly within VS Code. It enhances development productivity, especially when using GitHub Codespaces, by enabling unified management of front-end and back-end development within a single repository.

## Features

- **Compile Sui Smart Contracts**: Easily compile your Sui smart contracts from within VS Code.
- **Deploy and Test**: Deploy and test your smart contracts using the zkLogin-generated wallet, all from within the extension.
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
1. **Workspace**: This section of the interface allows you to compile or deploy Smart Contracts. If you have multiple smart contracts in your repository, you can select the specific smart contract (`Move.toml`) and proceed with compilation or deployment. If there is an `Upgrade.toml` file in the same folder as the `Move.toml` file, the contract will be upgraded rather than published. Use the `Format` button. This ensures your code adheres to a consistent style, improving readability and maintainability.
1. **Owner Objects Explorer**: This section of the interface allows you to load and inspect owner objects, one of the key features of Sui. By loading objects, you can check its `type` to verify that it contains the appropriate information required for the function arguments of a deployed smart contract.
1. **Object Explorer**: This section of the interface allows you to load and inspect objects, one of the key features of Sui. By loading an object, you can check its `type` to verify that it contains the appropriate information required for the function arguments of a deployed smart contract.
1. **Package Explorer**: This section of the user interface allows you to test smart contracts. When you deploy a Smart Contract, it is automatically registered here. You can also manually enter the address of a previously deployed Smart Contract to register it. If the smart contract is loaded correctly, you will see a list of functions available to interact with the contract.
1. **Move Call**: Input Format for Multi-Vectors Using JSON Strings. When working with multi-vectors, the input must be provided in JSON string format. JSON is ideal for representing nested structures and allows handling multi-dimensional arrays effectively.

    |Type|JSON|
    |------|-------|
    |`Vector<U8>` | [1, 2, 3, 255]|
    |`Vector<Vector<U128>>`|[["1", "555"], ["123", "456", "789"]]|
    |`Vector<Vector<Vector<Bool>>>`|[[[true, false], [true]], [[false, true]]]|

    ![Vector](https://docs.zktx.io/images/sui-extension-vector.png)

1. **Output**: In this section, you can view the transaction execution data in raw format. Please select `Sui Extension` in the Task.
1. **PTB-Builder**: **PTB Builder** is a visual development tool for **Programmable Transaction Blocks (PTBs)**, a core technology of the Sui blockchain. Designed to create a powerful synergy with Sui’s PTB capabilities, this tool allows both developers and non-developers to easily construct and manage complex transactions, maximizing the potential of this advanced technology and making it more accessible to a broader audience.

![ptb-builder-editor.png](https://docs.zktx.io/images/ptb-builder-editor.png)

## Requirements

- **Sui CLI**: Install the Sui command-line interface to interact with the Sui blockchain.
  > Note: If you are using GitHub Codespaces, please install Homebrew from https://brew.sh first to manage and [install the Sui CLI](https://docs.sui.io/guides/developer/getting-started/sui-install).
- **zkLogin**: Set up zkLogin to generate wallets for contract deployment and testing. A Google account is required.

## Extension Settings

- No additional configuration is required.

## Docs

- [link](https://docs.zktx.io/vsce/sui/)
