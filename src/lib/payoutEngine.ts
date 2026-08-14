import type { Market } from '../types';

// ── Dynamic payout engine ────────────────────────────────────────────────
// Pairs are ranked by payout (highest first) everywhere they're listed.
// BTC and ETH usually sit at the top of the range (87–90%), but every pair's
// payout gently drifts over time so the platform spreads load across
// different assets — completely normal broker behaviour. No pair ever goes
// below the platform floor of 72%.

const PAYOUT_MIN   = 72;
const PAYOUT_MAX   = 90;
const MAJOR_MIN    = 87; // BTC / ETH usual floor
const MAJOR_IDS    = new Set(['btc', 'eth']);

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/**
 * First-load payout assignment. Keeps the incoming order (trending pairs
 * first, then the rest by volume — set by the backend) instead of
 * re-sorting by payout, so that order stays consistent everywhere the
 * markets list is used (quick-scroll bar, markets modal, etc).
 */
export function assignInitialPayouts(markets: Market[]): Market[] {
  return markets.map((m, idx) => {
    let payout: number;
    if (MAJOR_IDS.has(m.id)) {
      payout = MAJOR_MIN + Math.random() * (PAYOUT_MAX - MAJOR_MIN); // 87–90
    } else {
      // Slight liquidity-based bias: assets earlier in the (curated/volume-
      // sorted) incoming list skew a little higher, long tail assets lower.
      const bias = Math.max(0, 1 - idx / Math.max(40, markets.length));
      payout = PAYOUT_MIN + Math.random() * 12 + bias * 6; // ~72–90
    }
    return { ...m, payout: Math.round(clamp(payout, PAYOUT_MIN, PAYOUT_MAX)) };
  });
}

/** Periodic drift — nudges every payout a little, keeps the existing order. */
export function driftPayouts(markets: Market[]): Market[] {
  return markets.map(m => {
    let payout = m.payout + (Math.random() - 0.5) * 5; // ± ~2.5
    if (MAJOR_IDS.has(m.id)) {
      // Usually stays high, but can occasionally dip to redistribute load.
      if (Math.random() < 0.8) payout = Math.max(payout, MAJOR_MIN);
      payout = clamp(payout, 80, PAYOUT_MAX);
    } else {
      payout = clamp(payout, PAYOUT_MIN, PAYOUT_MAX);
    }
    return { ...m, payout: Math.round(payout) };
  });
}
