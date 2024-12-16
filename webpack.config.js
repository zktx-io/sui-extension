/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check

'use strict';

const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const CopyPlugin = require('copy-webpack-plugin');

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

/** @type WebpackConfig */
const webExtensionConfig = {
  mode: 'production', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  target: 'webworker', // extensions run in a webworker context
  entry: './src/extension.ts', // source of the web extension main file
  output: {
    path: path.resolve(__dirname, 'out/web'),
    filename: 'extension.js',
    libraryTarget: 'commonjs',
  },
  resolve: {
    mainFields: ['browser', 'module', 'main'], // look for `browser` entry point in imported node modules
    extensions: ['.ts', '.js'], // support ts-files and js-files
    alias: {
      // provides alternate implementation for node module and source files
    },
    fallback: {
      // Webpack 5 no longer polyfills Node.js core modules automatically.
      // see https://webpack.js.org/configuration/resolve/#resolvefallback
      // for the list of Node.js core module polyfills.
      assert: require.resolve('assert'),
      buffer: require.resolve('buffer/'),
      path: require.resolve('path-browserify'),
      fs: false,
    },
  },
  experiments: {
    asyncWebAssembly: true,
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
    ],
  },
  plugins: [
    new webpack.ProvidePlugin({
      process: 'process/browser', // provide a shim for the global `process` variable
    }),
    new webpack.ProvidePlugin({
      Buffer: ['buffer', 'Buffer'],
    }),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(
            __dirname,
            'node_modules/web-tree-sitter/tree-sitter.wasm',
          ),
          to: path.resolve(__dirname, 'out/tree-sitter.wasm'),
        },
      ],
    }),
    new CopyPlugin({
      patterns: [
        {
          from: path.resolve(
            __dirname,
            'node_modules/@mysten/prettier-plugin-move/tree-sitter-move.wasm',
          ),
          to: path.resolve(__dirname, 'out/tree-sitter-move.wasm'),
        },
      ],
    }),
  ],
  externals: {
    vscode: 'commonjs vscode', // ignored because it doesn't exist
    prettier: 'commonjs prettier',
  },
  performance: {
    hints: false,
  },
  devtool: 'nosources-source-map', // create a source map that points to the original source file
};

/** @type WebpackConfig */
const nodeExtensionConfig = {
  mode: 'production', // this leaves the source code as close as possible to the original (when packaging we set this to 'production')
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  target: 'node', // VS Code extensions run in a Node.js-context 📖 -> https://webpack.js.org/configuration/node/

  entry: './src/extension.ts', // the entry point of this extension, 📖 -> https://webpack.js.org/configuration/entry-context/
  output: {
    // the bundle is stored in the 'dist' folder (check package.json), 📖 -> https://webpack.js.org/configuration/output/
    path: path.resolve(__dirname, 'out'),
    filename: 'extension.js',
    libraryTarget: 'commonjs2',
  },
  externals: {
    vscode: 'commonjs vscode', // the vscode-module is created on-the-fly and must be excluded. Add other modules that cannot be webpack'ed, 📖 -> https://webpack.js.org/configuration/externals/
    // modules added here also need to be added in the .vscodeignore file
  },
  resolve: {
    // support reading TypeScript and JavaScript files, 📖 -> https://github.com/TypeStrong/ts-loader
    extensions: ['.ts', '.js', '.wasm'],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: 'ts-loader',
          },
        ],
      },
      {
        test: /\.wasm$/,
        type: 'asset/resource',
      },
    ],
  },
  devtool: 'nosources-source-map',
  infrastructureLogging: {
    level: 'log', // enables logging required for problem matchers
  },
};

module.exports = [webExtensionConfig, nodeExtensionConfig];
