// Shared between DepositScreen and TransfersScreen (withdraw tab) so both
// flows always offer exactly the same methods — no more "Bank Wire" on
// withdraw with different options than deposit.

export const DEPOSIT_MIN_USD = 20;

// ── Egyptian e-wallets — only shown when the selected country is Egypt ─────
export const EGY_WALLETS = [
  { id: 'vodafone', name: 'Vodafone Cash', color: '#E60000', bg: 'rgba(230,0,0,.08)',   border: 'rgba(230,0,0,.25)',   phoneKey: 'vodafone_number' },
  { id: 'orange',   name: 'Orange Cash',   color: '#FF6600', bg: 'rgba(255,102,0,.08)', border: 'rgba(255,102,0,.25)', phoneKey: 'orange_number'   },
  { id: 'etisalat', name: 'Etisalat Cash', color: '#00A651', bg: 'rgba(0,166,81,.08)',  border: 'rgba(0,166,81,.25)',  phoneKey: 'etisalat_number' },
  { id: 'we',       name: 'We Cash',       color: '#5B2D8E', bg: 'rgba(91,45,142,.08)', border: 'rgba(91,45,142,.25)', phoneKey: 'we_number'       },
  { id: 'instapay', name: 'InstaPay',      color: '#0066CC', bg: 'rgba(0,102,204,.08)', border: 'rgba(0,102,204,.25)', phoneKey: 'instapay_number' },
];

// Platform deposit phone numbers (fallback until backend responds)
export const PLATFORM_PHONES: Record<string, string> = {
  vodafone: '+20 100 123 4567',
  orange:   '+20 112 123 4567',
  etisalat: '+20 111 123 4567',
  we:       '+20 115 123 4567',
  instapay: 'oxier@instapay',
};

// ── Crypto methods — available to every country, expanded with more coins ──
// `min` is in the coin's own unit and is roughly equivalent to the $20
// platform minimum at typical market prices.
export const CRYPTO_METHODS = [
  { id: 'usdt-trc20', name: 'USDT (TRC20)', symbol: 'USDT', network: 'Tron',              min: 20,     color: '#26A17B', address: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE' },
  { id: 'usdt-erc20', name: 'USDT (ERC20)', symbol: 'USDT', network: 'Ethereum',          min: 20,     color: '#26A17B', address: '0x742d35Cc6634C0532925a3b8D4C98A948e0e7fC2' },
  { id: 'usdt-bep20', name: 'USDT (BEP20)', symbol: 'USDT', network: 'BNB Smart Chain',   min: 20,     color: '#26A17B', address: '0x8f3Bc65E3F1c7A4a2C8e0d1e6f6a2b9e1c4d5e6f' },
  { id: 'usdc-erc20', name: 'USDC (ERC20)', symbol: 'USDC', network: 'Ethereum',          min: 20,     color: '#2775CA', address: '0x5aAeb6053f3E94C9b9A09f33669435E7Ef1BeAed' },
  { id: 'btc',        name: 'Bitcoin',      symbol: 'BTC',  network: 'Bitcoin',           min: 0.0003, color: '#F7931A', address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh' },
  { id: 'eth',        name: 'Ethereum',     symbol: 'ETH',  network: 'Ethereum (ERC20)',  min: 0.006,  color: '#627EEA', address: '0x742d35Cc6634C0532925a3b8D4C98A948e0e7fC2' },
  { id: 'bnb',        name: 'BNB',          symbol: 'BNB',  network: 'BNB Smart Chain',   min: 0.03,   color: '#F0B90B', address: 'bnb1grpf0955h0ykzq3ar5nmum7y6gdfl6lxfn46h2' },
  { id: 'sol',        name: 'Solana',       symbol: 'SOL',  network: 'Solana',            min: 0.12,   color: '#9945FF', address: '5FHwkrdxntdK24hgQU8qgBjn35Y1zwhz1GZBTeGubGxN' },
  { id: 'ton',        name: 'Toncoin',      symbol: 'TON',  network: 'The Open Network',  min: 3.5,    color: '#0088CC', address: 'UQAQ6l3zvNvV3jAlAvnRxJfrCWKrn5Zn0lQvJ7HW1uS6iesa' },
  { id: 'trx',        name: 'TRON',         symbol: 'TRX',  network: 'Tron',              min: 160,    color: '#FF0013', address: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE' },
  { id: 'ltc',        name: 'Litecoin',     symbol: 'LTC',  network: 'Litecoin',          min: 0.22,   color: '#BFBBBB', address: 'ltc1qw508d6qejxtdg4y5r3zarvary0c5xw7kygt080' },
  { id: 'xrp',        name: 'XRP',          symbol: 'XRP',  network: 'XRP Ledger',        min: 38,     color: '#346AA9', address: 'rEb8TK3gBgk5auZkwc6sHnwrGVJH8DuaLh' },
];

export function isEgypt(country: string | null | undefined) {
  return country === 'Egypt';
}

// ── Backend-driven crypto methods ───────────────────────────────────────────
// The actual list of methods (and their wallet addresses / min-max amounts)
// now comes from the backend (GET /api/wallet/methods), since the admin can
// add/remove/edit them at any time. This is purely cosmetic metadata (brand
// color + human-readable network label) keyed by the exact `name` the
// backend uses, so a known method still gets its brand color; anything the
// admin adds that isn't in this table falls back to a sensible default.
export const CRYPTO_META: Record<string, { color: string; network: string }> = {
  'USDT (TRC20)': { color: '#26A17B', network: 'Tron' },
  'USDT (ERC20)': { color: '#26A17B', network: 'Ethereum' },
  'USDT (BEP20)': { color: '#26A17B', network: 'BNB Smart Chain' },
  'USDC (ERC20)': { color: '#2775CA', network: 'Ethereum' },
  'Bitcoin':      { color: '#F7931A', network: 'Bitcoin' },
  'Ethereum':     { color: '#627EEA', network: 'Ethereum (ERC20)' },
  'BNB':          { color: '#F0B90B', network: 'BNB Smart Chain' },
  'Solana':       { color: '#9945FF', network: 'Solana' },
  'Toncoin':      { color: '#0088CC', network: 'The Open Network' },
  'TRON':         { color: '#FF0013', network: 'Tron' },
  'Litecoin':     { color: '#BFBBBB', network: 'Litecoin' },
  'XRP':          { color: '#346AA9', network: 'XRP Ledger' },
};

export function getCryptoMeta(name: string): { color: string; network: string } {
  return CRYPTO_META[name] || { color: '#00D68F', network: '' };
}

// Shape returned by GET /api/wallet/methods (public) — crypto-only.
export interface DepositMethodDTO {
  _id: string;
  name: string;
  type: 'wallet' | 'crypto';
  walletAddress?: string;
  isActive: boolean;
  minAmount: number;
  maxAmount: number;
  currency: string;
  defaultBonusPct?: number;
}
