import { MoveTemplate_Empty } from './MoveTemplate_Empty';
import { MoveTemplate, PTBTemplateItem } from './types';
import { MoveTemplate_Intro_HelloWorld } from './moveTemplate_01_hello';
import { MoveTemplate_Intro_Transcript } from './moveTemplate_02_transcript';
import { MoveTemplate_Intro_FT } from './moveTemplate_03_ft';
import { MoveTemplate_Intro_Marketplace } from './moveTemplate_04_marketplace';
import { MoveTemplate_Intro_Kiosk } from './moveTemplate_05_kiosk';
import { MoveTemplate_Intro_Flashloan } from './moveTemplate_06_flashloan';
import { MoveTemplate_Mysten_Basics } from './moveTemplate_07_basics';
import { MoveTemplate_Mysten_Coin } from './moveTemplate_08_coin';
import { MoveTemplate_Mysten_ColorObject } from './moveTemplate_09_color_object';
import { MoveTemplate_Mysten_DynamicFields } from './moveTemplate_10_dynamic_fields';
import { PTBTemplate_merge } from './PTBTemplate_merge';
import { PTBTemplate_split } from './PTBTemplate_split';
import { PTBTemplate_exchange_all_for_wal } from './PTBTemplate_exchange_all_for_wal';
import { PTBTemplate_exchange_all_for_sui } from './PTBTemplate_exchange_all_for_sui';
import { MoveTemplate_Mysten_EntryFunctions } from './moveTemplate_11_entry_functions';
import { MoveTemplate_Mysten_FirstPackage } from './moveTemplate_12_first_package';
import { MoveTemplate_Mysten_FlashLender } from './moveTemplate_13_flash_lender';
import { MoveTemplate_Mysten_Hero } from './moveTemplate_14_hero';
import { MoveTemplate_Mysten_LockedStake } from './moveTemplate_15_locked_stake';
import { MoveTemplate_Mysten_SoulboundNFT } from './moveTemplate_17_testnet_soulbound_nft';
import { MoveTemplate_Mysten_NFT } from './moveTemplate_18_testnet_nft';
import { MoveTemplate_Mysten_ObjectBound } from './moveTemplate_19_object_bound';
import { MoveTemplate_Mysten_Profiles } from './moveTemplate_20_profiles';
import { MoveTemplate_Mysten_ReviewsRating } from './moveTemplate_22_reviews_rating';
import { MoveTemplate_Mysten_SimpleWarrior } from './moveTemplate_23_simple_warrior';
import { MoveTemplate_Mysten_Token } from './moveTemplate_24_token';
import { MoveTemplate_Mysten_TrustedSwap } from './moveTemplate_26_trusted_swap';
import { MoveTemplate_Mysten_USDC_Usage } from './moveTemplate_27_usdc_usage';
import { MoveTemplate_Mysten_VDF_Lottery } from './moveTemplate_28_vdf';
import { MoveTemplate_Mysten_NFTRental } from './moveTemplate_16_nft-rental';
import { MoveTemplate_Mysten_Random_Raffles } from './moveTemplate_21_random_raffles';
import { MoveTemplate_Mysten_Random_NFT } from './moveTemplate_21_random_random_nft';
import { MoveTemplate_Mysten_Random_SlotMachine } from './moveTemplate_21_random_slot_machine';

export const moveTemplates: MoveTemplate[] = [
  MoveTemplate_Empty,
  MoveTemplate_Intro_HelloWorld,
  MoveTemplate_Intro_Transcript,
  MoveTemplate_Intro_FT,
  MoveTemplate_Intro_Marketplace,
  MoveTemplate_Intro_Kiosk,
  MoveTemplate_Intro_Flashloan,
  MoveTemplate_Mysten_Basics,
  MoveTemplate_Mysten_Coin,
  MoveTemplate_Mysten_ColorObject,
  MoveTemplate_Mysten_DynamicFields,
  MoveTemplate_Mysten_EntryFunctions,
  MoveTemplate_Mysten_FirstPackage,
  MoveTemplate_Mysten_FlashLender,
  MoveTemplate_Mysten_Hero,
  MoveTemplate_Mysten_LockedStake,
  MoveTemplate_Mysten_NFTRental,
  MoveTemplate_Mysten_SoulboundNFT,
  MoveTemplate_Mysten_NFT,
  MoveTemplate_Mysten_ObjectBound,
  MoveTemplate_Mysten_Profiles,
  MoveTemplate_Mysten_Random_Raffles,
  MoveTemplate_Mysten_Random_NFT,
  MoveTemplate_Mysten_Random_SlotMachine,
  MoveTemplate_Mysten_ReviewsRating,
  MoveTemplate_Mysten_SimpleWarrior,
  MoveTemplate_Mysten_Token,
  MoveTemplate_Mysten_TrustedSwap,
  MoveTemplate_Mysten_USDC_Usage,
  MoveTemplate_Mysten_VDF_Lottery,
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

export { workshopTemplates } from '../workshop';
