import { BACKEND } from './api';

// ── Timeframes ─────────────────────────────────────────────────────────────
export const TIMEFRAMES = {
  '5s':  { binance: '1m',  sec: 5,     simOnly: true  },
  '10s': { binance: '1m',  sec: 10,    simOnly: true  },
  '30s': { binance: '1m',  sec: 30,    simOnly: true  },
  '1m':  { binance: '1m',  sec: 60,    simOnly: false },
  '3m':  { binance: '3m',  sec: 180,   simOnly: false },
  '5m':  { binance: '5m',  sec: 300,   simOnly: false },
  '15m': { binance: '15m', sec: 900,   simOnly: false },
  '30m': { binance: '30m', sec: 1800,  simOnly: false },
  '1h':  { binance: '1h',  sec: 3600,  simOnly: false },
  '2h':  { binance: '2h',  sec: 7200,  simOnly: false },
  '4h':  { binance: '4h',  sec: 14400, simOnly: false },
  '6h':  { binance: '6h',  sec: 21600, simOnly: false },
  '8h':  { binance: '8h',  sec: 28800, simOnly: false },
  '12h': { binance: '12h', sec: 43200, simOnly: false },
  '1d':  { binance: '1d',  sec: 86400, simOnly: false },
} as const;

export type TF = keyof typeof TIMEFRAMES;

// Short timeframes that use simulated data (Binance doesn't support these natively)
export const SHORT_TFS: TF[] = ['5s', '10s', '30s'];

// Pairs pinned to the top of the markets list, in this exact order. Must
// mirror TRENDING_ORDER in the backend's prices.service.ts (that's what
// actually orders the data coming back from /api/market-data/live-markets —
// this copy is only used client-side to group them under a "Trending"
// header in the markets modal).
export const TRENDING_BASES: string[] = [
  'BTC', 'BNB', 'ETH', 'LTC', 'SOL', 'DOGE', 'TRX', 'XAUT',
  'DEXE', 'ZEC', 'RE', 'XRP', 'ZAMA', 'SUI', 'BANK', 'RIF',
];

export function getDecimals(price: number): number {
  if (price >= 10000) return 2;
  if (price >= 100)   return 2;
  if (price >= 10)    return 3;
  if (price >= 1)     return 4;
  if (price >= 0.1)   return 5;
  if (price >= 0.01)  return 6;
  return 8;
}

export function getCategory(base: string): 'Crypto' | 'Forex' | 'Gold' | 'Stocks' {
  const goldBases = ['PAXG', 'XAUT'];
  const forexBases = ['EUR','GBP','AUD','CAD','CHF','JPY','NZD','TRY','BRL','MXN','SGD','HKD','NOK','SEK','DKK','PLN','CZK'];
  if (goldBases.includes(base)) return 'Gold';
  if (forexBases.includes(base)) return 'Forex';
  return 'Crypto';
}

export function getFlagColor(base: string): string {
  const map: Record<string, string> = {
    'BTC':'#F7931A','ETH':'#627EEA','BNB':'#F0B90B','SOL':'#9945FF','XRP':'#346AA9',
    'ADA':'#0033AD','DOGE':'#C2A633','DOT':'#E6007A','MATIC':'#8247E5','LTC':'#BFBBBB',
    'TRX':'#FF0013','AVAX':'#E84142','LINK':'#2A5ADA','ATOM':'#2E3148','UNI':'#FF007A',
    'EUR':'#003399','GBP':'#012169','AUD':'#00008B','CAD':'#FF0000','JPY':'#BC002D',
    'PAXG':'#E2A23B','XAUT':'#D4AF37','TON':'#0088CC','SUI':'#4CA2FF','ARB':'#28A0F0',
    'OP':'#FF0420','INJ':'#00B2FF','APT':'#B3B3B3','NEAR':'#000000','FTM':'#1969FF',
    'SAND':'#04ADEF','MANA':'#FF2D55','AXS':'#0055D5','CHZ':'#CD0124','ENJ':'#7866D5',
    'VET':'#15BDFF','ALGO':'#000000','THETA':'#2AB8E6','FIL':'#0090FF','EGLD':'#23F7DD',
    'XLM':'#14B6E7','IOTA':'#131F37','ZEC':'#ECB244','XMR':'#FF6600','DASH':'#008CE7',
    // Newer/smaller-cap listings that don't have icon-CDN coverage yet —
    // still get a proper brand-tinted badge instead of a generic grey circle.
    'RE':'#14B8A6','GMX':'#2E6BF2','LISTA':'#FFC107','TURBO':'#7ED321','NEIRO':'#C68642',
    'MANTA':'#7B2FF7','SYN':'#7C3AED','ME':'#EB4D93',
  };
  return map[base] || '#2a3a5e';
}

const overrides: Record<string, string> = {
  'ton':    'https://i.ibb.co/S4RSYZjM/image.png',
  'xlm':    'https://i.ibb.co/k2v65TWY/image.png',
  'hmstr':  'https://i.ibb.co/3ynGyxFd/image.png',
  'jto':    'https://i.ibb.co/xSmTQrKx/image.png',
  // Newer/smaller-cap listings CoinCap and spothq don't carry — pulled
  // directly from CoinGecko's asset CDN so they get a real logo instead
  // of the initials badge.
  'syn':    'https://assets.coingecko.com/coins/images/18024/standard/synapse_social_icon.png?1696517540',
  'manta':  'https://assets.coingecko.com/coins/images/34289/standard/manta.jpg?1704468717',
  'gmx':    'https://assets.coingecko.com/coins/images/18323/standard/arbit.png?1696517814',
  're':     'https://assets.coingecko.com/coins/images/102173708/standard/RE-Token.png?1781031591',
};

export function getFlagUrl(base: string): string {
  const lower = base.toLowerCase();
  if (overrides[lower]) return overrides[lower];
  return `https://assets.coincap.io/assets/icons/${lower}@2x.png`;
}

// Coin logos come from more than one place because no single free CDN has
// every ticker (especially newer/smaller alts). AssetIcon tries these in
// order and only falls back to a plain initials badge if all of them 404.
export function getFlagUrls(base: string): string[] {
  const lower = base.toLowerCase();
  const upper = base.toUpperCase();
  const urls: string[] = [];
  if (overrides[lower]) urls.push(overrides[lower]);
  // Primary: CoinCap (broad coverage, what the platform has always used).
  urls.push(`https://assets.coincap.io/assets/icons/${lower}@2x.png`);
  // Secondary: Binance's own logo CDN. Since every pair on this platform is
  // sourced from Binance (see fetchBinanceKlines below), this covers newer/
  // smaller-cap listings — e.g. ME, TURBO, LISTA, NEIRO — that CoinCap and
  // spothq don't carry yet.
  urls.push(`https://bin.bnbstatic.com/static/assets/logos/${upper}.png`);
  // Tertiary: spothq's open-source icon set (great coverage of established
  // majors/DeFi/L1s, very reliable for hotlinking since it's raw GitHub).
  urls.push(`https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/${lower}.png`);
  return urls;
}

export function fmt(n: number, d = 2): string {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtP(n: number, d = 3): string {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// Wraps fetch with a hard timeout (so a hanging connection can't leave the
// caller waiting forever) and forwards an optional caller-provided
// AbortSignal (e.g. so switching market/timeframe can cancel in-flight
// requests instead of racing them).
async function fetchWithTimeout(url: string, externalSignal?: AbortSignal, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort);
  }
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) externalSignal.removeEventListener('abort', onExternalAbort);
  }
}

// Fetches candle history through our own backend instead of calling
// Binance directly from the browser. The backend does the pagination
// (walking Binance's endTime cursor for limit > 1000), so from here it's
// always a single request no matter how much history is requested — and
// bursts of users opening the same pair/timeframe share one cached
// upstream fetch on the server instead of each hitting Binance themselves.
export async function fetchBinanceKlines(symbol: string, interval: string, limit = 1000, signal?: AbortSignal) {
  const res = await fetchWithTimeout(
    `${BACKEND}/api/market-data/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    signal,
  );
  if (!res.ok) throw new Error('Klines API: ' + res.status);
  const { bars } = await res.json();
  return bars as { time: number; open: number; high: number; low: number; close: number; volume: number }[];
}

// ── Deterministic PRNG ───────────────────────────────────────────────────────
// genSimData/genShortTFData used plain Math.random(), so every user browsing
// the same pair saw a completely different fake chart — a dead giveaway that
// it's not real data. Seeding the RNG from the symbol (and, for short-TF
// subdivision, the real bar's own timestamp) makes the simulated sequence
// identical for every user looking at the same pair.
function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Generate high-quality simulated candle data for any timeframe
export function genSimData(symbol: string, price: number, tf: TF, count = 2000) {
  const bars: any[] = [];
  let p = price || 1000;
  const now = Math.floor(Date.now() / 1000);
  const step = TIMEFRAMES[tf].sec;
  const volatility = step <= 10 ? 0.003 : step <= 60 ? 0.006 : step <= 300 ? 0.010 : 0.018;
  const rng = mulberry32(hashString(`${symbol}:${tf}`));

  for (let i = count - 1; i >= 0; i--) {
    const t = now - i * step;
    const open = p;
    const chg = (rng() - 0.48) * p * volatility;
    const close = Math.max(p * 0.001, p + chg);
    const range = Math.abs(chg) * (0.3 + rng() * 0.7);
    const high = Math.max(open, close) + range * 0.5;
    const low  = Math.min(open, close) - range * 0.5;
    bars.push({ time: t, open, high, low, close, volume: rng() * 1e6 * (price / 1000) });
    p = close;
  }
  return bars;
}

// Generate short-timeframe data by sub-dividing 1m candles
export function genShortTFData(baseBars: any[], tfSec: number, symbol = '') {
  const result: any[] = [];
  const stepsPerMinute = Math.floor(60 / tfSec);

  for (const bar of baseBars) {
    const priceRange = bar.high - bar.low;
    let p = bar.open;
    // Seeded per real base bar (Binance's own timestamp), so the sub-division
    // is identical for everyone regardless of when they loaded the chart.
    const rng = mulberry32(hashString(`${symbol}:${tfSec}:${bar.time}`));

    for (let i = 0; i < stepsPerMinute; i++) {
      const t = bar.time + i * tfSec;
      const isLast = i === stepsPerMinute - 1;
      const close = isLast ? bar.close : p + (rng() - 0.47) * priceRange * 0.3;
      const high = Math.max(p, close) + rng() * priceRange * 0.1;
      const low = Math.min(p, close) - rng() * priceRange * 0.1;
      result.push({ time: t, open: p, high: Math.min(high, bar.high), low: Math.max(low, bar.low), close, volume: bar.volume / stepsPerMinute });
      p = close;
    }
  }
  return result;
}

// ── Indicator calculations ─────────────────────────────────────────────────

export function calcRSI(bars: any[], period = 14): any[] {
  const closes = bars.map(b => b.close);
  const result: any[] = [];
  for (let i = period; i < closes.length; i++) {
    let gains = 0, losses = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const d = closes[j] - closes[j - 1];
      if (d > 0) gains += d; else losses += Math.abs(d);
    }
    const rs = losses === 0 ? 100 : gains / losses;
    result.push({ time: bars[i].time, value: 100 - 100 / (1 + rs) });
  }
  return result;
}

export function calcMACD(bars: any[]): { macd: any[]; signal: any[]; hist: any[] } {
  const closes = bars.map(b => b.close);
  function ema(data: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const result = [data[0]];
    for (let i = 1; i < data.length; i++) result.push(data[i] * k + result[i - 1] * (1 - k));
    return result;
  }
  const e12 = ema(closes, 12);
  const e26 = ema(closes, 26);
  const macdLine = e12.map((v, i) => v - e26[i]);
  const signalLine = ema(macdLine.slice(26), 9);
  const macd: any[] = [], signal: any[] = [], hist: any[] = [];
  for (let i = 26; i < bars.length; i++) {
    const si = i - 26;
    macd.push({ time: bars[i].time, value: macdLine[i] });
    if (si >= 9) {
      const sv = signalLine[si - 9];
      signal.push({ time: bars[i].time, value: sv });
      hist.push({ time: bars[i].time, value: macdLine[i] - sv, color: macdLine[i] - sv >= 0 ? '#00E676' : '#FF3D57' });
    }
  }
  return { macd, signal, hist };
}

export function calcBB(bars: any[], period = 20, mult = 2): { upper: any[]; lower: any[]; mid: any[] } {
  const upper: any[] = [], lower: any[] = [], mid: any[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1).map(b => b.close);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const std = Math.sqrt(slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
    upper.push({ time: bars[i].time, value: mean + mult * std });
    lower.push({ time: bars[i].time, value: mean - mult * std });
    mid.push({ time: bars[i].time, value: mean });
  }
  return { upper, lower, mid };
}

export function calcEMA(bars: any[], period = 20): any[] {
  const k = 2 / (period + 1);
  const result: any[] = [{ time: bars[0].time, value: bars[0].close }];
  for (let i = 1; i < bars.length; i++) {
    result.push({ time: bars[i].time, value: bars[i].close * k + result[i - 1].value * (1 - k) });
  }
  return result.slice(period);
}

export function calcSMA(bars: any[], period = 20): any[] {
  const result: any[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    result.push({ time: bars[i].time, value: slice.reduce((a, b) => a + b.close, 0) / period });
  }
  return result;
}

export function calcCCI(bars: any[], period = 14): any[] {
  const result: any[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    const tp = slice.map(b => (b.high + b.low + b.close) / 3);
    const mean = tp.reduce((a, b) => a + b, 0) / period;
    const mad = tp.reduce((a, b) => a + Math.abs(b - mean), 0) / period;
    result.push({ time: bars[i].time, value: mad === 0 ? 0 : (tp[tp.length - 1] - mean) / (0.015 * mad) });
  }
  return result;
}

export function calcATR(bars: any[], period = 14): any[] {
  const result: any[] = [];
  for (let i = 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    );
    result.push({ time: bars[i].time, value: tr });
  }
  const atr: any[] = [{ time: result[0].time, value: result[0].value }];
  const k = 1 / period;
  for (let i = 1; i < result.length; i++) {
    atr.push({ time: result[i].time, value: result[i].value * k + atr[i - 1].value * (1 - k) });
  }
  return atr.slice(period);
}

export function calcStoch(bars: any[], period = 14): { k: any[]; d: any[] } {
  const k: any[] = [], d: any[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    const low = Math.min(...slice.map(b => b.low));
    const high = Math.max(...slice.map(b => b.high));
    k.push({ time: bars[i].time, value: high === low ? 50 : ((bars[i].close - low) / (high - low)) * 100 });
  }
  for (let i = 2; i < k.length; i++) {
    d.push({ time: k[i].time, value: (k[i].value + k[i - 1].value + k[i - 2].value) / 3 });
  }
  return { k, d };
}

export function calcWilliams(bars: any[], period = 14): any[] {
  const result: any[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    const high = Math.max(...slice.map(b => b.high));
    const low  = Math.min(...slice.map(b => b.low));
    result.push({ time: bars[i].time, value: high === low ? -50 : ((high - bars[i].close) / (high - low)) * -100 });
  }
  return result;
}

export function calcVolume(bars: any[]): any[] {
  return bars.map(b => ({ time: b.time, value: b.volume, color: b.close >= b.open ? 'rgba(0,230,118,.6)' : 'rgba(255,61,87,.6)' }));
}

export function calcVWAP(bars: any[]): any[] {
  const result: any[] = [];
  let cumPV = 0, cumVol = 0;
  for (const b of bars) {
    const tp = (b.high + b.low + b.close) / 3;
    cumPV += tp * b.volume;
    cumVol += b.volume;
    result.push({ time: b.time, value: cumVol === 0 ? tp : cumPV / cumVol });
  }
  return result;
}

export function calcWMA(bars: any[], period = 20): any[] {
  const result: any[] = [];
  const denom = (period * (period + 1)) / 2;
  for (let i = period - 1; i < bars.length; i++) {
    let sum = 0;
    for (let j = 0; j < period; j++) sum += bars[i - period + 1 + j].close * (j + 1);
    result.push({ time: bars[i].time, value: sum / denom });
  }
  return result;
}

export function calcDonchian(bars: any[], period = 20): { upper: any[]; lower: any[] } {
  const upper: any[] = [], lower: any[] = [];
  for (let i = period - 1; i < bars.length; i++) {
    const slice = bars.slice(i - period + 1, i + 1);
    upper.push({ time: bars[i].time, value: Math.max(...slice.map(b => b.high)) });
    lower.push({ time: bars[i].time, value: Math.min(...slice.map(b => b.low)) });
  }
  return { upper, lower };
}

export function calcMomentum(bars: any[], period = 10): any[] {
  const result: any[] = [];
  for (let i = period; i < bars.length; i++) {
    result.push({ time: bars[i].time, value: bars[i].close - bars[i - period].close });
  }
  return result;
}

export function calcMFI(bars: any[], period = 14): any[] {
  const tp = bars.map(b => (b.high + b.low + b.close) / 3);
  const rawFlow = bars.map((b, i) => tp[i] * b.volume);
  const result: any[] = [];
  for (let i = period; i < bars.length; i++) {
    let pos = 0, neg = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (tp[j] > tp[j - 1]) pos += rawFlow[j];
      else if (tp[j] < tp[j - 1]) neg += rawFlow[j];
    }
    const ratio = neg === 0 ? 100 : pos / neg;
    result.push({ time: bars[i].time, value: neg === 0 ? 100 : 100 - 100 / (1 + ratio) });
  }
  return result;
}

export function calcADX(bars: any[], period = 14): any[] {
  const len = bars.length;
  const plusDM: number[] = [0], minusDM: number[] = [0], tr: number[] = [0];
  for (let i = 1; i < len; i++) {
    const upMove = bars[i].high - bars[i - 1].high;
    const downMove = bars[i - 1].low - bars[i].low;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    tr.push(Math.max(
      bars[i].high - bars[i].low,
      Math.abs(bars[i].high - bars[i - 1].close),
      Math.abs(bars[i].low - bars[i - 1].close)
    ));
  }
  // Wilder smoothing
  function smooth(vals: number[]): number[] {
    const out: number[] = [];
    let sum = 0;
    for (let i = 1; i <= period; i++) sum += vals[i] || 0;
    out[period] = sum;
    for (let i = period + 1; i < vals.length; i++) out[i] = out[i - 1] - out[i - 1] / period + vals[i];
    return out;
  }
  const trS = smooth(tr), plusS = smooth(plusDM), minusS = smooth(minusDM);
  const dx: number[] = [];
  for (let i = period; i < len; i++) {
    const plusDI = trS[i] === 0 ? 0 : (100 * plusS[i]) / trS[i];
    const minusDI = trS[i] === 0 ? 0 : (100 * minusS[i]) / trS[i];
    const sum = plusDI + minusDI;
    dx[i] = sum === 0 ? 0 : (100 * Math.abs(plusDI - minusDI)) / sum;
  }
  const result: any[] = [];
  let adx = 0, count = 0;
  for (let i = period; i < len; i++) {
    if (count < period) { adx += dx[i] || 0; count++; if (count === period) adx /= period; else continue; }
    else adx = (adx * (period - 1) + (dx[i] || 0)) / period;
    result.push({ time: bars[i].time, value: adx });
  }
  return result;
}

// ── Extended markets list ──────────────────────────────────────────────────
export const DEFAULT_MARKETS = [
  // ── Crypto – Major ────────────────────────────────────────────────────
  { id:'btc',   symbol:'BTCUSDT',   base:'BTC',   name:'Bitcoin',        category:'Crypto', payout:82, price:67500, dec:2 },
  { id:'eth',   symbol:'ETHUSDT',   base:'ETH',   name:'Ethereum',       category:'Crypto', payout:82, price:3500,  dec:2 },
  { id:'bnb',   symbol:'BNBUSDT',   base:'BNB',   name:'BNB',            category:'Crypto', payout:80, price:605,   dec:2 },
  { id:'sol',   symbol:'SOLUSDT',   base:'SOL',   name:'Solana',         category:'Crypto', payout:84, price:172,   dec:2 },
  { id:'xrp',   symbol:'XRPUSDT',   base:'XRP',   name:'XRP',            category:'Crypto', payout:82, price:0.52,  dec:4 },
  { id:'ada',   symbol:'ADAUSDT',   base:'ADA',   name:'Cardano',        category:'Crypto', payout:80, price:0.44,  dec:4 },
  { id:'doge',  symbol:'DOGEUSDT',  base:'DOGE',  name:'Dogecoin',       category:'Crypto', payout:80, price:0.165, dec:4 },
  { id:'dot',   symbol:'DOTUSDT',   base:'DOT',   name:'Polkadot',       category:'Crypto', payout:80, price:7.2,   dec:3 },
  { id:'link',  symbol:'LINKUSDT',  base:'LINK',  name:'Chainlink',      category:'Crypto', payout:82, price:14.5,  dec:3 },
  { id:'avax',  symbol:'AVAXUSDT',  base:'AVAX',  name:'Avalanche',      category:'Crypto', payout:82, price:38,    dec:3 },
  { id:'atom',  symbol:'ATOMUSDT',  base:'ATOM',  name:'Cosmos',         category:'Crypto', payout:80, price:9.2,   dec:3 },
  { id:'uni',   symbol:'UNIUSDT',   base:'UNI',   name:'Uniswap',        category:'Crypto', payout:80, price:7.8,   dec:3 },
  { id:'ltc',   symbol:'LTCUSDT',   base:'LTC',   name:'Litecoin',       category:'Crypto', payout:80, price:84,    dec:2 },
  { id:'trx',   symbol:'TRXUSDT',   base:'TRX',   name:'TRON',           category:'Crypto', payout:80, price:0.125, dec:4 },
  { id:'matic', symbol:'MATICUSDT', base:'MATIC', name:'Polygon',        category:'Crypto', payout:82, price:0.72,  dec:4 },

  // ── Crypto – Mid Cap ──────────────────────────────────────────────────
  { id:'sui',   symbol:'SUIUSDT',   base:'SUI',   name:'Sui',            category:'Crypto', payout:84, price:4.2,   dec:4 },
  { id:'arb',   symbol:'ARBUSDT',   base:'ARB',   name:'Arbitrum',       category:'Crypto', payout:82, price:1.15,  dec:4 },
  { id:'op',    symbol:'OPUSDT',    base:'OP',    name:'Optimism',       category:'Crypto', payout:82, price:2.1,   dec:4 },
  { id:'inj',   symbol:'INJUSDT',   base:'INJ',   name:'Injective',      category:'Crypto', payout:84, price:28,    dec:3 },
  { id:'apt',   symbol:'APTUSDT',   base:'APT',   name:'Aptos',          category:'Crypto', payout:82, price:10.5,  dec:3 },
  { id:'near',  symbol:'NEARUSDT',  base:'NEAR',  name:'NEAR Protocol',  category:'Crypto', payout:82, price:5.8,   dec:3 },
  { id:'ftm',   symbol:'FTMUSDT',   base:'FTM',   name:'Fantom',         category:'Crypto', payout:82, price:0.72,  dec:4 },
  { id:'sand',  symbol:'SANDUSDT',  base:'SAND',  name:'The Sandbox',    category:'Crypto', payout:80, price:0.48,  dec:4 },
  { id:'mana',  symbol:'MANAUSDT',  base:'MANA',  name:'Decentraland',   category:'Crypto', payout:80, price:0.42,  dec:4 },
  { id:'axs',   symbol:'AXSUSDT',   base:'AXS',   name:'Axie Infinity',  category:'Crypto', payout:82, price:8.5,   dec:3 },
  { id:'chz',   symbol:'CHZUSDT',   base:'CHZ',   name:'Chiliz',         category:'Crypto', payout:80, price:0.082, dec:4 },
  { id:'enj',   symbol:'ENJUSDT',   base:'ENJ',   name:'Enjin Coin',     category:'Crypto', payout:80, price:0.35,  dec:4 },
  { id:'ton',   symbol:'TONUSDT',   base:'TON',   name:'Toncoin',        category:'Crypto', payout:82, price:5.5,   dec:3 },
  { id:'xlm',   symbol:'XLMUSDT',   base:'XLM',   name:'Stellar',        category:'Crypto', payout:80, price:0.115, dec:4 },
  { id:'vet',   symbol:'VETUSDT',   base:'VET',   name:'VeChain',        category:'Crypto', payout:80, price:0.033, dec:5 },
  { id:'algo',  symbol:'ALGOUSDT',  base:'ALGO',  name:'Algorand',       category:'Crypto', payout:80, price:0.175, dec:4 },
  { id:'fil',   symbol:'FILUSDT',   base:'FIL',   name:'Filecoin',       category:'Crypto', payout:82, price:5.8,   dec:3 },
  { id:'egld',  symbol:'EGLDUSDT',  base:'EGLD',  name:'MultiversX',     category:'Crypto', payout:82, price:40,    dec:3 },
  { id:'theta', symbol:'THETAUSDT', base:'THETA', name:'Theta Network',  category:'Crypto', payout:80, price:2.1,   dec:3 },
  { id:'icp',   symbol:'ICPUSDT',   base:'ICP',   name:'Internet Comp.', category:'Crypto', payout:82, price:12.5,  dec:3 },
  { id:'xmr',   symbol:'XMRUSDT',   base:'XMR',   name:'Monero',         category:'Crypto', payout:80, price:155,   dec:2 },
  { id:'aave',  symbol:'AAVEUSDT',  base:'AAVE',  name:'Aave',           category:'Crypto', payout:82, price:92,    dec:2 },
  { id:'mkr',   symbol:'MKRUSDT',   base:'MKR',   name:'Maker',          category:'Crypto', payout:82, price:2200,  dec:2 },

  // ── Gold ──────────────────────────────────────────────────────────────
  { id:'paxg',  symbol:'PAXGUSDT',  base:'PAXG', name:'Gold (PAXG)', category:'Gold', payout:76, price:2340, dec:2 },
  { id:'xaut',  symbol:'XAUTUSDT',  base:'XAUT', name:'Gold (XAUT)', category:'Gold', payout:76, price:2340, dec:2 },
];

// Friendly display names for well-known coins, used when building the full
// live pair list from Binance so recognizable assets don't just show their
// raw ticker symbol.
export const COIN_NAMES: Record<string, string> = Object.fromEntries(
  DEFAULT_MARKETS.map(m => [m.base, m.name.replace(/\s*\((PAXG|XAUT)\)/, '')])
);

// Pairs explicitly excluded from the platform (requested removal) — these
// stay out of the list even though Binance still lists them.
const EXCLUDED_BASES = new Set([
  'SENT','ZK','ETHFI','AEVO','IO','AR','FLOKI','CGPT','PHA','JASMY','PYTH',
  'TNSR','GMT','PEOPLE','ROSE','AGLD','BONK','SHELL','MOVE','CVX','XTZ',
  'RENDER','BB','SAGA','TIA','LUNC',
]);

/**
 * Fetches every live, tradable USDT pair through our own backend (which in
 * turn talks to Binance's exchangeInfo + ticker/24hr and caches the result
 * briefly) and returns a fully-formed Market[] — hundreds of real assets,
 * no placeholders. Falls back to DEFAULT_MARKETS (randomized 24h stats) only
 * if the backend itself is unreachable, so the platform never breaks offline.
 */
export async function buildBinanceMarkets(): Promise<any[]> {
  try {
    const res = await fetchWithTimeout(`${BACKEND}/api/market-data/live-markets`);
    if (!res.ok) throw new Error('live-markets API: ' + res.status);
    const { markets } = await res.json();
    if (!Array.isArray(markets) || markets.length === 0) throw new Error('No live pairs returned');
    // The backend returns generic `name` fields (just the base ticker);
    // fill in the friendlier display names we already have client-side.
    return markets
      .filter((m: any) => !EXCLUDED_BASES.has(m.base))
      .map((m: any) => ({ ...m, name: COIN_NAMES[m.base] || m.name }));
  } catch {
    // Backend unreachable fallback — still real Binance symbols, just without live pricing.
    return DEFAULT_MARKETS
      .filter(m => !EXCLUDED_BASES.has(m.base))
      .map(m => ({
        ...m,
        change:   (Math.random() - 0.5) * 4,
        high24:   m.price * 1.02,
        low24:    m.price * 0.98,
        volume24: Math.random() * 1e7,
        volume:   Math.random() * 1e8,
      }));
  }
}
