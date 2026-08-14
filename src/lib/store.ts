import { create } from 'zustand';
import type { Market, Trade, Transaction, Screen, ActiveOverlay, Theme, ChallengeConfig, UserChallenge } from '../types';
import type { TF } from './markets';
import { apiFetch } from './api';

const DEMO_BAL_KEY   = 'ox_demo_bal';
const REAL_BAL_KEY   = 'ox_real_bal';
const BONUS_BAL_KEY  = 'ox_bonus_bal';
const TRADES_KEY     = 'ox_trades';
const THEME_KEY      = 'ox_theme';
const TX_KEY         = 'ox_transactions';

interface UserInfo { email: string; name: string; token: string; }
interface IndicatorSettings { [id: string]: Record<string, number>; }

interface StoreState {
  screen: Screen;
  setScreen: (s: Screen) => void;

  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;

  walType: 'demo' | 'real' | 'challenge';
  setWalType: (t: 'demo' | 'real' | 'challenge') => void;

  demoBalance: number;
  realBalance: number;
  bonusBalance: number;
  setDemoBalance: (n: number) => void;
  setRealBalance: (n: number) => void;
  setBonusBalance: (n: number) => void;
  balance: () => number;
  adjustBalance: (delta: number, type?: 'demo' | 'real' | 'challenge') => void;

  // ── Trading Challenge ────────────────────────────────────────────────────
  challengeConfig: ChallengeConfig | null;
  activeChallenge: (UserChallenge & { currentDay?: number }) | null;
  challengeLoading: boolean;
  fetchChallengeConfig: () => Promise<void>;
  fetchActiveChallenge: () => Promise<void>;
  joinChallenge: () => Promise<{ ok: boolean; error?: string }>;

  markets: Market[];
  setMarkets: (m: Market[]) => void;
  currentMarket: Market | null;
  setCurrentMarket: (m: Market) => void;

  currentTF: TF;
  setCurrentTF: (tf: TF) => void;

  amount: number;
  setAmount: (n: number) => void;
  expMin: number;
  expDisp: string;
  setExpiry: (min: number, disp: string) => void;

  trades: Trade[];
  addTrade: (t: Trade) => void;
  // Optimistic-UI support: a trade is shown locally the instant the user
  // taps buy/sell (using a temporary id), then swapped for the server's
  // confirmed record (replaceTrade) or removed entirely if the open
  // request failed (removeTrade) — so the UI never waits on the network
  // round-trip to feel responsive, without ever faking a real result.
  replaceTrade: (tempId: string, real: Trade) => void;
  removeTrade: (id: string) => void;
  resolveTrade: (id: string, exit: number, won: boolean, profit?: number) => void;
  saveTrades: () => void;

  transactions: Transaction[];
  addTransaction: (t: Transaction) => void;
  updateTransactionStatus: (id: string, status: Transaction['status']) => void;

  overlay: ActiveOverlay;
  setOverlay: (o: ActiveOverlay) => void;

  // A promo code the user tapped "Use Code" on from an Event — carried
  // over into DepositScreen so it opens pre-filled. Cleared once consumed.
  pendingPromoCode: string | null;
  setPendingPromoCode: (code: string | null) => void;

  // Which tab the Transfers screen should open on (used by the panel's
  // dedicated Withdrawal shortcut so it jumps straight to the withdraw form).
  transfersTab: 'history' | 'withdraw';
  setTransfersTab: (t: 'history' | 'withdraw') => void;

  // Country the user picked for deposit/withdrawal (determines whether the
  // Egyptian e-wallets show up alongside crypto, or crypto-only).
  userCountry: string | null;
  setUserCountry: (c: string | null) => void;

  toast: string;
  showToast: (msg: string) => void;

  confirm: { title: string; body: string; onConfirm: () => void } | null;
  showConfirm: (title: string, body: string, onConfirm: () => void) => void;
  closeConfirm: () => void;

  userInfo: UserInfo | null;
  setUserInfo: (u: UserInfo | null) => void;
  // Starts a brand-new "try without registering" Demo session: always resets
  // demo balance/trades/transactions first, so it never resumes whatever
  // was left over from a previous guest visit.
  startGuestDemoSession: () => void;
  syncBalances: () => void;
  // Re-fetches open positions + recent history from the server and merges
  // them into local state. Extracted out of setUserInfo (below) so it can
  // also run once on app boot for an already-logged-in session — see the
  // bootstrap call right after the store is created.
  syncActiveTrades: () => void;

  // Held only in memory (never persisted) while the login OTP step is in
  // progress — needed so LoginVerifyScreen can call verify-otp / resend-otp.
  pendingLogin: { email: string; password: string } | null;
  setPendingLogin: (p: { email: string; password: string } | null) => void;

  activeInds: string[];
  toggleInd: (id: string) => void;

  indicatorSettings: IndicatorSettings;
  setIndicatorParam: (id: string, key: string, value: number) => void;

  chartExpanded: boolean;
  setChartExpanded: (v: boolean) => void;

  pendingDeposit: { method: string; wallet: any; amount: string } | null;
  setPendingDeposit: (d: { method: string; wallet: any; amount: string } | null) => void;

  soundEnabled: boolean;
  setSoundEnabled: (v: boolean) => void;
  balanceHidden: boolean;
  setBalanceHidden: (v: boolean) => void;

  openTradePriceLine: { id: string; entry: number; side: 'buy'|'sell' } | null;
  setOpenTradePriceLine: (v: { id: string; entry: number; side: 'buy'|'sell' } | null) => void;

  // Single source of truth for "current price" — fed by the live ticker
  // stream so the price used to open a trade always matches what's
  // displayed on screen (and the last candle tick on the chart).
  livePrice: number | null;
  setLivePrice: (v: number | null) => void;

  // ── Signal the user last tapped "Enter Trade" on ────────────────────────
  // Set by SignalsOverlay when a signal card is tapped, consumed by
  // BottomControls.openTrade: a trade is only allowed to open at (or
  // extremely near) this signal's own entryPrice — if the market has moved
  // on by the time Buy/Sell is actually tapped, the trade is cancelled
  // instead of filling somewhere the signal never pointed to. Cleared after
  // it's used (or expired), so it never silently applies to a later,
  // unrelated trade.
  activeSignal: { id: string; symbol: string; direction: 'buy' | 'sell'; entryPrice: number; expiresAt: number } | null;
  setActiveSignal: (v: { id: string; symbol: string; direction: 'buy' | 'sell'; entryPrice: number; expiresAt: number } | null) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

// Light Mode has been fully removed from the app — Dark Mode only.
// Any previously saved 'light' preference is ignored and cleared.
localStorage.removeItem(THEME_KEY);
document.documentElement.classList.remove('light');

function loadTx(): Transaction[] {
  try { return JSON.parse(localStorage.getItem(TX_KEY) || '[]'); } catch { return []; }
}
function saveTxToLS(txs: Transaction[]) {
  localStorage.setItem(TX_KEY, JSON.stringify(txs));
}

export const useStore = create<StoreState>((set, get) => ({
  screen: 'splash',
  setScreen: (screen) => set({ screen }),

  theme: 'dark',
  setTheme: () => {
    // Light Mode removed — app is Dark Mode only, this is now a no-op.
    document.documentElement.classList.remove('light');
    set({ theme: 'dark' });
  },
  toggleTheme: () => {
    // Light Mode removed — nothing to toggle.
  },

  walType: 'demo',
  setWalType: (walType) => set({ walType }),

  demoBalance: parseFloat(localStorage.getItem(DEMO_BAL_KEY) || '10000'),
  realBalance: parseFloat(localStorage.getItem(REAL_BAL_KEY) || '0'),
  bonusBalance: parseFloat(localStorage.getItem(BONUS_BAL_KEY) || '0'),
  setDemoBalance: (demoBalance) => { localStorage.setItem(DEMO_BAL_KEY, String(demoBalance)); set({ demoBalance }); },
  setRealBalance: (realBalance) => { localStorage.setItem(REAL_BAL_KEY, String(realBalance)); set({ realBalance }); },
  setBonusBalance: (bonusBalance) => { localStorage.setItem(BONUS_BAL_KEY, String(bonusBalance)); set({ bonusBalance }); },
  balance: () => {
    const s = get();
    if (s.walType === 'demo') return s.demoBalance;
    if (s.walType === 'challenge') return s.activeChallenge?.challengeBalance ?? 0;
    // The backend spends realBalance first and only falls back to
    // bonusBalance once realBalance is exhausted (see trade.service.ts),
    // so the tradable "real" balance the UI checks against — and shows —
    // must be the sum of both. Returning realBalance alone here made bonus
    // funds invisible and effectively untradeable: BottomControls compares
    // the requested trade amount against this value and blocks/redirects
    // to Deposit the moment it exceeds realBalance, even when bonusBalance
    // could have covered the rest.
    return s.realBalance + s.bonusBalance;
  },
  adjustBalance: (delta, type) => {
    const t = type || get().walType;
    if (t === 'demo') get().setDemoBalance(Math.max(0, get().demoBalance + delta));
    else if (t === 'challenge') {
      const c = get().activeChallenge;
      if (c) set({ activeChallenge: { ...c, challengeBalance: Math.max(0, c.challengeBalance + delta) } });
    } else get().setRealBalance(Math.max(0, get().realBalance + delta));
  },

  challengeConfig: null,
  activeChallenge: null,
  challengeLoading: false,
  fetchChallengeConfig: async () => {
    try {
      const res = await apiFetch('/api/challenge/info');
      const data = await res.json();
      if (data?.config) set({ challengeConfig: data.config });
    } catch { /* keep last known config */ }
  },
  fetchActiveChallenge: async () => {
    const userInfo = get().userInfo;
    if (!userInfo?.token || userInfo.token === 'demo') { set({ activeChallenge: null }); return; }
    set({ challengeLoading: true });
    try {
      const res = await apiFetch('/api/challenge/active');
      const data = await res.json();
      const prevStatus = get().activeChallenge?.status;
      const nextChallenge = data?.challenge ? { ...data.challenge, currentDay: data.currentDay } : null;
      set({ activeChallenge: nextChallenge });
      // If the challenge just concluded, drop back to the real wallet so the
      // user isn't stuck viewing a balance that no longer exists.
      if (prevStatus === 'active' && nextChallenge === null && get().walType === 'challenge') {
        get().setWalType('real');
      }
    } catch { /* keep last known state */ }
    finally { set({ challengeLoading: false }); }
  },
  joinChallenge: async () => {
    try {
      const res = await apiFetch('/api/challenge/join', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return { ok: false, error: data.error || 'Failed to join the challenge' };
      set({ activeChallenge: { ...data.challenge, currentDay: 1 } });
      await get().fetchActiveChallenge();
      return { ok: true };
    } catch {
      return { ok: false, error: 'Connection error — please try again' };
    }
  },

  markets: [],
  setMarkets: (markets) => set({ markets }),
  currentMarket: null,
  setCurrentMarket: (currentMarket) => set({ currentMarket }),

  currentTF: '1m',
  setCurrentTF: (currentTF) => set({ currentTF }),

  amount: 10,
  setAmount: (amount) => set({ amount }),
  expMin: 1,
  expDisp: '1m',
  setExpiry: (expMin, expDisp) => set({ expMin, expDisp }),

  trades: (() => { try { return JSON.parse(localStorage.getItem(TRADES_KEY) || '[]'); } catch { return []; } })(),
  addTrade: (t) => { set(s => ({ trades: [...s.trades, t] })); get().saveTrades(); },
  replaceTrade: (tempId, real) => {
    set(s => ({ trades: s.trades.map(t => t.id === tempId ? real : t) }));
    get().saveTrades();
  },
  removeTrade: (id) => {
    set(s => ({ trades: s.trades.filter(t => t.id !== id) }));
    get().saveTrades();
  },
  resolveTrade: (id, exit, won, profit) => {
    set(s => ({
      trades: s.trades.map(t => t.id === id
        ? { ...t, resolved: true, exit, won, profit: profit ?? (won ? t.amount * (t.payout / 100) : -t.amount), resolvedAt: Date.now() }
        : t),
    }));
    get().saveTrades();
  },
  saveTrades: () => {
    const recent = get().trades.filter(t => !t.resolved || (Date.now() - (t.resolvedAt || 0)) < 86400000 * 7);
    localStorage.setItem(TRADES_KEY, JSON.stringify(recent));
  },

  transactions: loadTx(),
  addTransaction: (tx) => {
    set(s => { const txs = [tx, ...s.transactions]; saveTxToLS(txs); return { transactions: txs }; });
  },
  updateTransactionStatus: (id, status) => {
    set(s => {
      const txs = s.transactions.map(t => t.id === id ? { ...t, status } : t);
      saveTxToLS(txs);
      return { transactions: txs };
    });
  },

  overlay: 'none',
  setOverlay: (overlay) => set({ overlay }),

  pendingPromoCode: null,
  setPendingPromoCode: (pendingPromoCode) => set({ pendingPromoCode }),

  transfersTab: 'history',
  setTransfersTab: (transfersTab) => set({ transfersTab }),

  userCountry: null,
  setUserCountry: (userCountry) => set({ userCountry }),

  toast: '',
  showToast: (msg) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toast: msg });
    toastTimer = setTimeout(() => set({ toast: '' }), 2800);
  },

  confirm: null,
  showConfirm: (title, body, onConfirm) => set({ confirm: { title, body, onConfirm } }),
  closeConfirm: () => set({ confirm: null }),

  userInfo: (() => { try { return JSON.parse(localStorage.getItem('ox_user') || 'null'); } catch { return null; } })(),
  syncBalances: () => {
    const token = get().userInfo?.token;
    if (!token || token === 'demo') return;
    apiFetch('/api/trade/balance').then(r => r.json()).then(data => {
      // Demo balance is intentionally NOT synced from the server anymore —
      // demo trades are now opened and settled entirely client-side (never
      // hit the backend at all, to keep server load down), so the local
      // balance is the only source of truth for it. Pulling the server's
      // (now-stale/frozen) demoBalance in here would silently overwrite
      // every demo win/loss the moment this 45s poll fires.
      if (data && typeof data.realBalance === 'number') {
        localStorage.setItem('ox_real_bal', String(data.realBalance));
        set({ realBalance: data.realBalance });
      }
      if (data && typeof data.bonusBalance === 'number') {
        localStorage.setItem('ox_bonus_bal', String(data.bonusBalance));
        set({ bonusBalance: data.bonusBalance });
      }
    }).catch(() => {});
  },
  setUserInfo: (userInfo) => {
    // ox_transactions / ox_trades / ox_real_bal / ox_bonus_bal are stored
    // under fixed, non-namespaced localStorage keys — they were never
    // scoped per account and were never cleared on logout. On a shared
    // device/browser, logging into Account B right after Account A left
    // every deposit/withdrawal/trade/balance from Account A sitting in
    // localStorage, where it then got MERGED (never replaced) with
    // Account B's own data as soon as a fresh fetch came in — so two (or
    // three) different accounts ended up showing the exact same history.
    // Any identity change — logout, switching to a different real
    // account, or swapping into/out of the shared demo identity — must
    // wipe the previous account's cached data first.
    const prevEmail = get().userInfo?.email ?? null;
    const nextEmail = userInfo?.email ?? null;
    if (prevEmail !== nextEmail) {
      localStorage.removeItem(TX_KEY);
      localStorage.removeItem(TRADES_KEY);
      localStorage.removeItem(REAL_BAL_KEY);
      localStorage.removeItem(BONUS_BAL_KEY);
      set({ transactions: [], trades: [], realBalance: 0, bonusBalance: 0 });
    }

    localStorage.setItem('ox_user', JSON.stringify(userInfo));
    set({ userInfo });
    if (userInfo?.token && userInfo.token !== 'demo') {
      get().syncBalances();
      get().syncActiveTrades();
      get().fetchChallengeConfig();
      get().fetchActiveChallenge();
    }
  },

  syncActiveTrades: () => {
    const mapBackendTrade = (t: any): Trade => {
      const market = get().markets.find(m => m.symbol === t.marketSymbol);
      return {
        id: t._id,
        mktId: market?.id || t.marketSymbol || '',
        mktName: t.marketName || market?.name || t.marketSymbol || '',
        side: (t.side || 'buy') as 'buy' | 'sell',
        amount: t.amount,
        entry: t.entryPrice ?? 0,
        exit: t.exitPrice,
        payout: t.payoutPct ?? 80,
        dec: market?.dec ?? 2,
        expiryAt: t.expiryAt ? new Date(t.expiryAt).getTime() : Date.now(),
        openedAt: t.openedAt ? new Date(t.openedAt).getTime() : Date.now(),
        resolvedAt: t.resolvedAt ? new Date(t.resolvedAt).getTime() : undefined,
        resolved: t.status !== 'open',
        won: t.status === 'won',
        earlyClosed: t.status === 'closed_early',
        profit: t.profit,
        walType: (t.walletType || 'real') as 'demo' | 'real' | 'challenge',
      };
    };

    // Pull both open positions (in case the app was closed mid-trade, so a
    // trade that expired and was settled server-side while we were gone
    // never showed up as anything but "active" locally) and recent
    // history, then merge them into whatever's already loaded locally
    // without duplicating anything by id.
    Promise.all([
      apiFetch('/api/trade/active').then(r => r.json()).catch(() => null),
      apiFetch('/api/trade/history').then(r => r.json()).catch(() => null),
    ]).then(([activeData, historyData]) => {
      const remote: Trade[] = [];
      if (Array.isArray(activeData?.trades)) remote.push(...activeData.trades.map(mapBackendTrade));
      if (Array.isArray(historyData?.trades)) remote.push(...historyData.trades.map(mapBackendTrade));
      if (remote.length === 0) return;

      set(s => {
        const knownIds = new Set(remote.map(t => t.id));
        const localOnly = s.trades.filter(t => !knownIds.has(t.id));
        const merged = [...remote, ...localOnly];
        localStorage.setItem(TRADES_KEY, JSON.stringify(merged));
        return { trades: merged };
      });
    }).catch(() => {});
  },

  startGuestDemoSession: () => {
    localStorage.removeItem(TRADES_KEY);
    localStorage.removeItem(TX_KEY);
    localStorage.setItem(DEMO_BAL_KEY, '10000');
    set({ trades: [], transactions: [], demoBalance: 10000, walType: 'demo' });
    get().setUserInfo({ email: 'demo@oxier.com', name: 'Demo Trader', token: 'demo' });
  },

  pendingLogin: null,
  setPendingLogin: (pendingLogin) => set({ pendingLogin }),

  activeInds: [],
  toggleInd: (id) => set(s => ({
    activeInds: s.activeInds.includes(id) ? s.activeInds.filter(x => x !== id) : [...s.activeInds, id],
  })),

  indicatorSettings: {},
  setIndicatorParam: (id, key, value) => set(s => ({
    indicatorSettings: { ...s.indicatorSettings, [id]: { ...(s.indicatorSettings[id] || {}), [key]: value } },
  })),

  chartExpanded: false,
  setChartExpanded: (chartExpanded) => set({ chartExpanded }),

  pendingDeposit: null,
  setPendingDeposit: (pendingDeposit) => set({ pendingDeposit }),

  soundEnabled: true,
  setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
  balanceHidden: localStorage.getItem('ox_balance_hidden') === '1',
  setBalanceHidden: (balanceHidden) => { localStorage.setItem('ox_balance_hidden', balanceHidden ? '1' : '0'); set({ balanceHidden }); },

  openTradePriceLine: null,
  setOpenTradePriceLine: (openTradePriceLine) => set({ openTradePriceLine }),

  livePrice: null,
  setLivePrice: (livePrice) => set({ livePrice }),

  activeSignal: null,
  setActiveSignal: (activeSignal) => set({ activeSignal }),
}));

// ── Boot-time resync ─────────────────────────────────────────────────────
// userInfo above is hydrated straight from localStorage, so a returning
// user with an existing session never goes through setUserInfo() (that
// only runs on an actual login action) — this app previously only ever
// learned about a trade being settled via the live websocket push at the
// moment it resolved. If the tab was closed when that happened, the trade
// had already been settled correctly server-side, but the client never
// found out: it just kept showing the same stale "active" trade forever,
// with nothing left to update it. Running the same sync used after login
// once here as well means a returning session always reconciles against
// the server's actual state before relying on live pushes for anything
// after that.
{
  const bootUser = useStore.getState().userInfo;
  if (bootUser?.token && bootUser.token !== 'demo') {
    useStore.getState().syncBalances();
    useStore.getState().syncActiveTrades();
  }
}
