import * as vscode from 'vscode';
import { RequestData } from '../webview/panel/src/utilities/commands';

const generateThreadId = async (): Promise<void> => {
  try {
    const response = await fetch('https://playgr.app/chefgpt/thread/new', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'docsbot',
      }),
    });
    if (!response.ok) {
      vscode.window.showErrorMessage(`HTTP error! status: ${response.status}`);
    }
    const data: any = await response.json();
    threadId = data.thread._id;
    threadUUID = data.thread.uuid;
  } catch (error) {
    vscode.window.showErrorMessage(`Unknown error: ${error}`);
  }
};

let isLoading: boolean = false;
let threadId: string | undefined = undefined;
let threadUUID: string | undefined = undefined;

const history: {
  user: RequestData;
  bot: string;
}[] = [];

export const getHistory = () => history;

export const suiAI = async (
  request: RequestData,
  onData: (data: string) => void,
  onEnd: () => void,
): Promise<void> => {
  if (isLoading) {
    return;
  }
  isLoading = true;
  history.push({ user: request, bot: '' });
  try {
    if (threadId === undefined || threadUUID === undefined) {
      await generateThreadId();
    }
    const response = await fetch('https://playgr.app/chefgpt/new-message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [],
        data: {
          preTextPrompt: null,
          dataSources: [
            {
              name: 'Sui',
            },
          ],
          speedMode: 'detailed',
          file: {},
        },
        type: 'docsbot',
        question: request.content,
        threadId,
        threadUUID,
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let resultText = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      const decode = decoder.decode(value, { stream: true });
      resultText += decode;
      onData(resultText);
    }

    if (onEnd) {
      isLoading = false;
      history[history.length - 1].bot = resultText;
      onEnd();
    }
  } catch (error) {
    history.slice(0, -1);
    vscode.window.showErrorMessage(`Unknown error: ${error}`);
    if (onEnd) {
      isLoading = false;
      onEnd();
    }
  }
};
