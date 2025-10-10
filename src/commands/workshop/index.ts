export interface WorkshopTemplate {
  id: string;
  label: string;
  description: string;
  detail?: string;
  zipPath: string;
  defaultProjectName: string;
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
  },
  {
    id: 'mysten-react-e2e-counter',
    label: 'Mysten: Distributed Counter (Fullstack)',
    description: 'End-to-end example with React frontend and Move backend',
    detail:
      'A decentralized counter anyone can increment, but only the owner can reset. Includes Move code and a React + Vite + @mysten/dapp-kit frontend.',
    zipPath: 'mysten/react-e2e-counter.zip',
    defaultProjectName: 'distributed-counter',
  },
];
