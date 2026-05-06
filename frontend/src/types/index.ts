export type KYCStatus = 'none' | 'pending' | 'verified' | 'failed';

export interface User {
  id: string;
  publicKey: string;
  kycStatus: KYCStatus;
  email?: string;
}

export interface Market {
  id: string;
  title: string;
  description: string;
  /** Official URL for resolution criteria (optional in list payloads). */
  resolutionSource?: string;
  /** Present when the market is linked to a category (UUID). */
  categoryId?: string;
  category?: Category;
  status: 'active' | 'locked' | 'resolved';
  contractAddress?: string | null;
  volume: string; // Decimal string
  endsAt: string; // ISO date
  liquidateAt?: string;
  outcomes: Outcome[];
  resolvedOutcomeId?: string;
}

export interface Outcome {
  id: string;
  name: string;
  price: string; // Decimal string (0-1 range typically, or USDC value)
}

export interface Trade {
  id: string;
  marketId: string;
  outcomeId: string;
  amount: string;
  price: string;
  txHash: string;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}
