export const SUPPORTED_CHAINS = [
    { id: 'eth', label: 'Ethereum' },
    { id: 'bsc', label: 'BNB Chain' },
    { id: 'base', label: 'Base' },
] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]['id'];
