import * as vscode from 'vscode';
import { CHANNEL } from '../webview/activitybar/src/utilities/cli';

let outputChannel: vscode.OutputChannel | undefined = undefined;

const getOutputChannel = (): vscode.OutputChannel => {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel(CHANNEL);
  }
  return outputChannel;
};

export const printOutputChannel = (message: string): void => {
  const channel = getOutputChannel();
  channel.appendLine(message);
  channel.show();
};
