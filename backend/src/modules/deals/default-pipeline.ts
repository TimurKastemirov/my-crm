/** Default pipeline + stages, created when an organization registers. */
export const DEFAULT_PIPELINE = {
  name: 'Default pipeline',
  stages: [
    { name: 'New', probability: 10, isWon: false, isLost: false },
    { name: 'Qualification', probability: 25, isWon: false, isLost: false },
    { name: 'Proposal', probability: 50, isWon: false, isLost: false },
    { name: 'Negotiation', probability: 75, isWon: false, isLost: false },
    { name: 'Won', probability: 100, isWon: true, isLost: false },
    { name: 'Lost', probability: 0, isWon: false, isLost: true },
  ],
} as const;
