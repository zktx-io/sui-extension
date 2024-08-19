# Sui Extension

The Sui extension provides seamless support for compiling, deploying, and testing Sui smart contracts directly within VS Code. It enhances development productivity, especially when using GitHub Codespaces, by enabling unified management of front-end and back-end development within a single repository.

## Features

- **Compile Sui Smart Contracts**: Easily compile your Sui smart contracts from within VS Code.
- **Deploy and Test**: Deploy and test your smart contracts using the zkLogin-generated wallet, all from within the extension.
- **GitHub Codespaces Integration**: Increase the efficiency of your development workflow with full support for GitHub Codespaces.
- **Unified Development**: Manage both front-end and back-end code in a single repository for streamlined development.
- **Upgrade Smart Contracts**: Seamlessly upgrade and test your smart contracts.
> <i class="fa fa-info-circle" aria-hidden="true"></i> Note: To upgrade, add an `upgrade.toml` file in the same directory as your `move.toml` file. The format is as follows:

  ```toml
  [upgrade]
  package_id = "The address of the deployed package"
  upgrade_cap = "The UpgradeCap is the central type responsible for coordinating package upgrades."
  ```

## Requirements

- **Sui CLI**: Install the Sui command-line interface to interact with the Sui blockchain.
> <i class="fa fa-info-circle" aria-hidden="true"></i> Note: If you are using GitHub Codespaces, please install Homebrew from https://brew.sh first to manage and install the Sui CLI.
- **zkLogin**: Set up zkLogin to generate wallets for contract deployment and testing. A Google account is required.

## Extension Settings

- No additional configuration is required.