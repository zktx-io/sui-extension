export enum COMMANDS {
  SaveData = 'ptb-builder:save-data',
  LoadData = 'ptb-builder:load-data',
  UpdateState = 'ptb-builder:update-state',
  RequestUndo = 'ptb-builder:request-undo',
  RequestRedo = 'ptb-builder:request-redo',
  MsgInfo = 'message:info',
  MsgError = 'message:error',
  OutputInfo = 'output:info',
  OutputError = 'output:error',
  SignTransaction = 'ptb-builder:sign-transaction',
}
