// ── Screens ──────────────────────────────────────────────────────────────────
export type Screen = 'splash' | 'landing' | 'login' | 'login-verify' | 'register' | 'verify' | 'pin' | 'trading';

// ── Theme ─────────────────────────────────────────────────────────────────────
export type Theme = 'dark' | 'light';

// ── Overlays ──────────────────────────────────────────────────────────────────
export type ActiveOverlay =
  | 'none'
  | 'panel'
  | 'history'
  | 'signals'
  | 'indicators'
  | 'expiry'
  | 'events'
  | 'deposit'
  | 'profile'
  | 'transfers'
  | 'challenge';

// ── Market ────────────────────────────────────────────────────────────────────
export interface Market {
  id: string;
  name: string;
  base: string;
  symbol: string;
  category: 'Crypto' | 'Forex' | 'Gold';
  price: number;
  change: number;
  high24: number;
  low24: number;
  volume24: number;
  volume: number;
  dec: number;
  payout: number;
}

// ── Trade ─────────────────────────────────────────────────────────────────────
export interface Trade {
  id: string;
  mktId: string;
  mktName: string;
  side: 'buy' | 'sell';
  amount: number;
  entry: number;
  exit?: number;
  payout: number;
  dec: number;
  expiryAt: number;
  openedAt: number;
  resolvedAt?: number;
  resolved: boolean;
  won?: boolean;
  profit?: number;
  walType: 'demo' | 'real' | 'challenge';
  earlyClosed?: boolean;
}

// ── Transaction ───────────────────────────────────────────────────────────────
export interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  desc: string;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'rejected';
  date: number;
  method?: string;
  currency?: string;
}

// ── Trading Challenge ─────────────────────────────────────────────────────────
export interface ChallengeDay {
  dayNumber: number;
  trades: number;
  wins: number;
  losses: number;
  result: 'pending' | 'complete' | 'failed';
}

export interface RewardTier { successDays: number; reward: number; }

export interface ChallengeConfig {
  isActive: boolean;
  title: string;
  description: string;
  entryFee: number;
  startingBalance: number;
  durationDays: number;
  dailyTradesRequired: number;
  dailyWinsRequired: number;
  dailyMaxLosses: number;
  minSuccessDaysForReward: number;
  rewardTiers: RewardTier[];
}

export interface UserChallenge {
  _id: string;
  status: 'active' | 'completed' | 'failed';
  entryFee: number;
  startingBalance: number;
  durationDays: number;
  dailyTradesRequired: number;
  dailyWinsRequired: number;
  dailyMaxLosses: number;
  minSuccessDaysForReward: number;
  rewardTiers: RewardTier[];
  challengeBalance: number;
  startedAt: string;
  endsAt: string;
  days: ChallengeDay[];
  successfulDays: number;
  rewardAmount: number;
  completedAt?: string;
}
