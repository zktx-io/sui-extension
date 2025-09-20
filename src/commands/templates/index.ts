import { MoveTemplate, PTBTemplateItem } from './types';
import { MoveTemplate_HelloWorld } from './moveTemplate_01_hello';
import { MoveTemplate_Transcript } from './moveTemplate_02_transcript';
import { MoveTemplate_FT } from './moveTemplate_03_ft';
import { MoveTemplate_Marketplace } from './moveTemplate_04_marketplace';
import { MoveTemplate_Kiosk } from './moveTemplate_05_kiosk';
import { MoveTemplate_Flashloan } from './moveTemplate_06_flashloan';
import { MoveTemplate_Empty } from './MoveTemplate_Empty';
import { PTBTemplate_merge } from './PTBTemplate_merge';
import { PTBTemplate_split } from './PTBTemplate_split';
import { PTBTemplate_exchange_all_for_wal } from './PTBTemplate_exchange_all_for_wal';
import { PTBTemplate_exchange_all_for_sui } from './PTBTemplate_exchange_all_for_sui';

export const moveTemplates: MoveTemplate[] = [
  MoveTemplate_Empty,
  MoveTemplate_HelloWorld,
  MoveTemplate_Transcript,
  MoveTemplate_FT,
  MoveTemplate_Marketplace,
  MoveTemplate_Kiosk,
  MoveTemplate_Flashloan,
];

export const ptbTemplates: PTBTemplateItem[] = [
  {
    id: 'empty',
    label: 'Empty PTB',
    description: 'Blank .ptb file',
    defaultName: 'empty.ptb',
    detail: 'Start with a blank PTB file.',
    file: () => '',
  },
  PTBTemplate_split,
  PTBTemplate_merge,
  PTBTemplate_exchange_all_for_wal,
  PTBTemplate_exchange_all_for_sui,
];
