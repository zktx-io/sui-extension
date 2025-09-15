import { MoveTemplate, PTBTemplateItem } from './types';
import { MoveTemplate_HelloWorld } from './moveTemplate_01_hello';
import { MoveTemplate_Transcript } from './moveTemplate_02_transcript';
import { MoveTemplate_FT } from './moveTemplate_03_ft';
import { MoveTemplate_Marketplace } from './moveTemplate_04_marketplace';
import { mergeTemplateJson, splitTemplateJson } from './ptbTemplates';

export const moveTemplates: MoveTemplate[] = [
  MoveTemplate_HelloWorld,
  MoveTemplate_Transcript,
  MoveTemplate_FT,
  MoveTemplate_Marketplace,
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
  {
    id: 'split',
    label: 'Split Template',
    description: 'Sample split pipeline',
    defaultName: 'split.ptb',
    detail: 'Split a Coin into parts (SplitCoins).',
    file: () => JSON.stringify(splitTemplateJson, null, 2),
  },
  {
    id: 'merge',
    label: 'Merge Template',
    description: 'Sample merge pipeline',
    defaultName: 'merge.ptb',
    detail: 'Merge multiple Coins (MergeCoins).',
    file: () => JSON.stringify(mergeTemplateJson, null, 2),
  },
];
