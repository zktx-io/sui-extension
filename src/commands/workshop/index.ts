export interface WorkshopTemplate {
  id: string;
  label: string;
  description: string;
  detail?: string;
  zipPath: string;
  defaultProjectName: string;
  sourceUrl?: string; // 🔹 new field for GitHub source
}

export const workshopTemplates: WorkshopTemplate[] = [
  {
    id: 'suijapan-nft-mint-sample',
    label: 'SuiJapan: Create NFT Mint Sample',
    description: 'Mint and display NFTs on Sui Testnet',
    detail:
      'React + @mysten/dapp-kit frontend with a pre-deployed Move contract. Experience Testnet NFT minting without deployment.',
    zipPath: 'sui-japan/nft-mint-sample-main.zip',
    defaultProjectName: 'nft-mint-sample',
    sourceUrl: 'https://github.com/SuiJapan/nft-mint-sample',
  },
  {
    id: 'mysten-react-e2e-counter',
    label: 'Mysten Labs: Distributed Counter (Fullstack)',
    description: 'End-to-end example with React frontend and Move backend',
    detail:
      'A decentralized counter anyone can increment, but only the owner can reset. Includes Move code and a React + Vite + @mysten/dapp-kit frontend.',
    zipPath: 'mysten/react-e2e-counter.zip',
    defaultProjectName: 'distributed-counter',
    sourceUrl:
      'https://github.com/MystenLabs/ts-sdks/tree/main/packages/create-dapp/templates/react-e2e-counter',
  },
  {
    id: 'mysten-coffee-club',
    label: 'Mysten Labs: Coffee Club System',
    description:
      'Fullstack Sui dApp connecting Move smart contracts, React frontend, and IoT coffee machines',
    detail:
      'A decentralized coffee ordering system built by Mysten Labs. Includes NFT memberships, blockchain event listeners, and BLE-based coffee machine control.',
    zipPath: 'mysten/coffee-club-main.zip',
    defaultProjectName: 'coffee-club-system',
    sourceUrl: 'https://github.com/MystenLabs/coffee-club',
  },
];
