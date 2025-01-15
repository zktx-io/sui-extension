export enum COMMANDS {
  Env = 'env',
  AiHistory = 'ai:history',
  AiQuestion = 'ai:question',
  AiStream = 'ai:stream',
  AiStreamEnd = 'ai:stream:end',
  MsgInfo = 'message:info',
  MsgError = 'message:error',
  OutputInfo = 'output:info',
  OutputError = 'output:error',
}

export interface RequestData {
  code: boolean;
  content: string;
}
