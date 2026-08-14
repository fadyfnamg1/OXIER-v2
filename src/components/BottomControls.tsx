import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { playOpen, playWin, playLoss, resumeAudio } from '../lib/sounds';
import { fmt } from '../lib/markets';
import { apiFetch } from '../lib/api';
import { subscribeTradeResults, subscribeTrade } from '../lib/liveSocket';
import { useI18n } from '../lib/i18n';

// Mirrors SIGNAL_ENTRY_TOLERANCE_PCT in the backend's trade.service.ts —
// keep these two in sync. A trade opened from a signal must fill within
// this tight band of the signal's own entryPrice; anything further off and
// the trade is cancelled rather than opened at a price the signal never
// actually pointed to. This is deliberately tighter than ordinary
// round-trip slippage tolerance because a signal can sit on screen (and be
// tapped) well after it first fired.
const SIGNAL_ENTRY_TOLERANCE_PCT = 0.001; // 0.1%

// Maps the backend's language-independent error `code` (see trade.routes.ts)
// to this app's own translation key, so a signal-precision rejection is
// always shown in the app's currently selected language — never the raw
// English string the server happens to log/return for debugging.
const SIGNAL_ERROR_I18N_KEY: Record<string, string> = {
  signal_drift: 'sig.entryDrifted',
  signal_expired: 'sig.entryExpired',
  signal_mismatch: 'sig.entryMismatch',
  signal_not_found: 'sig.entryUnavailable',
  invalid_signal: 'sig.entryUnavailable',
};

export default function BottomControls() {
  const { t } = useI18n();
  const amount        = useStore(s => s.amount);
  const setAmount     = useStore(s => s.setAmount);
  const expMin        = useStore(s => s.expMin);
  const expDisp       = useStore(s => s.expDisp);
  const walType       = useStore(s => s.walType);
  const balance       = useStore(s => s.balance);
  const adjustBalance = useStore(s => s.adjustBalance);
  const currentMarket = useStore(s => s.currentMarket);
  const addTrade      = useStore(s => s.addTrade);
  const resolveTrade  = useStore(s => s.resolveTrade);
  const setOverlay    = useStore(s => s.setOverlay);
  const showToast     = useStore(s => s.showToast);
  const soundEnabled  = useStore(s => s.soundEnabled);
  const trades        = useStore(s => s.trades);
  const livePrice     = useStore(s => s.livePrice);
  const userInfo      = useStore(s => s.userInfo);
  const fetchActiveChallenge = useStore(s => s.fetchActiveChallenge);
  const balanceHidden = useStore(s => s.balanceHidden);
  const activeSignal  = useStore(s => s.activeSignal);
  const setActiveSignal = useStore(s => s.setActiveSignal);

  // A "guest" session is the unauthenticated Demo button on the login
  // screen (no real account, placeholder token === 'demo'). It never has a
  // real JWT, so it must never call the authenticated backend.
  const isGuest = userInfo?.token === 'demo';

  // Every DEMO-wallet trade — guest or logged-in — is opened, tracked, and
  // settled fully client-side (never calls the backend at all). This is
  // intentional: demo trading generates by far the most order volume, and
  // none of it needs to touch the server since no real money moves. Real
  // and Challenge trades are unaffected and still go through the backend
  // exactly as before, since real cash/rewards are actually on the line.
  const isClientSideDemo = isGuest || walType === 'demo';

  const [lastResult, setLastResult] = useState<{ won: boolean; profit: number; market: string } | null>(null);
  const [resultLeaving, setResultLeaving] = useState(false);
  const [, forceTick] = useState(0);
  // Purely visual: shows a brief spinner on whichever button was just
  // tapped so a tap never feels ignored, without drawing anything on the
  // chart (and therefore without risking a wrong-looking entry price) until
  // the server actually confirms the trade. Multiple rapid taps just
  // restart/overlap this — it's not used for any logic, only the icon.
  const [placingCount, setPlacingCount] = useState<Record<'buy' | 'sell', number>>({ buy: 0, sell: 0 });

  // Auto-hide the trade result card after 3s instead of leaving it stuck
  // under the chart — a short fade-out plays just before it's removed.
  useEffect(() => {
    if (!lastResult) return;
    setResultLeaving(false);
    const fadeTimer   = setTimeout(() => setResultLeaving(true), 2700);
    const removeTimer = setTimeout(() => setLastResult(null), 3000);
    return () => { clearTimeout(fadeTimer); clearTimeout(removeTimer); };
  }, [lastResult]);

  const openTrades = trades.filter(t => !t.resolved);
  const openDemoTrades = openTrades.filter(t => t.walType === 'demo');

  // ── Accurate settlement price for client-side demo trades ─────────────
  // `livePrice` in the store only tracks whichever market is currently on
  // screen. A demo trade stays open (up to 24h) even if the person
  // switches markets or closes the app, so settling it accurately needs
  // its OWN live tick — not whatever happens to be on screen when the
  // timer fires. This keeps a direct exchange-fed subscription (the same
  // real Binance tick stream the server itself uses) open for every
  // symbol that currently has an unresolved demo trade on it, so
  // settlement is exact rather than approximated.
  const demoTickPrices = useRef<Map<string, number>>(new Map());
  const demoSymbolsKey = openDemoTrades
    .map(t => useStore.getState().markets.find(m => m.id === t.mktId)?.symbol)
    .filter(Boolean)
    .sort()
    .join(',');

  useEffect(() => {
    const symbols = new Set(
      openDemoTrades
        .map(t => useStore.getState().markets.find(m => m.id === t.mktId)?.symbol)
        .filter((s): s is string => !!s)
    );
    const unsubs: Array<() => void> = [];
    symbols.forEach(sym => {
      unsubs.push(subscribeTrade(sym, (price) => { demoTickPrices.current.set(sym, price); }));
    });
    return () => { unsubs.forEach(u => u()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoSymbolsKey]);

  // Every trade is now opened for real on the backend (see openTrade below)
  // — win/loss comes back over the websocket once the server's own timer
  // settles it, rather than being decided client-side.
  useEffect(() => {
    const unsub = subscribeTradeResults((result) => {
      const tradeId = result?.tradeId;
      if (!tradeId) return;
      const local = useStore.getState().trades.find(t => t.id === tradeId && !t.resolved);
      if (!local) return;

      const won = result.result === 'won';
      resolveTrade(tradeId, result.exitPrice, won, result.profit);
      if (won) adjustBalance(local.amount + result.profit, local.walType);
      if (useStore.getState().soundEnabled) { if (won) playWin(); else playLoss(); }
      setLastResult({ won, profit: result.profit, market: local.mktName });
      showToast(won ? `WIN +${Math.abs(result.profit).toFixed(2)}` : `LOSS -${Math.abs(result.profit).toFixed(2)}`);
      if (local.walType === 'challenge') fetchActiveChallenge();
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const settleDemoTrade = useCallback((tradeId: string) => {
    const state = useStore.getState();
    const trade = state.trades.find(t => t.id === tradeId && !t.resolved);
    if (!trade) return;

    const market = state.markets.find(m => m.id === trade.mktId);
    const symbol = market?.symbol;
    // Accuracy priority: (1) this trade's own live exchange tick — exact,
    // regardless of what's currently on screen; (2) the on-screen live
    // price, if this happens to be the currently-viewed market; (3) the
    // market list's periodically-refreshed price. Only if genuinely none
    // of those exist (feed never connected at all) do we fall back to a
    // tiny random walk around the entry price, purely so a trade can never
    // get stuck unresolved — this path should essentially never trigger.
    const accuratePrice =
      (symbol && demoTickPrices.current.get(symbol)) ??
      (state.currentMarket?.id === trade.mktId ? state.livePrice : null) ??
      market?.price ?? null;
    const exitPrice = accuratePrice ?? (trade.entry * (1 + (Math.random() - 0.5) * 0.004));

    const priceWentUp = exitPrice > trade.entry;
    const won = (trade.side === 'buy' && priceWentUp) || (trade.side === 'sell' && !priceWentUp);
    const profit = won ? trade.amount * (trade.payout / 100) : -trade.amount;

    resolveTrade(tradeId, exitPrice, won, profit);
    if (won) adjustBalance(trade.amount + profit, trade.walType);
    if (state.soundEnabled) { if (won) playWin(); else playLoss(); }
    setLastResult({ won, profit, market: trade.mktName });
    showToast(won ? `WIN +${Math.abs(profit).toFixed(2)}` : `LOSS -${Math.abs(profit).toFixed(2)}`);
  }, [resolveTrade, adjustBalance, showToast]);

  // Tick every second so the nearest-expiry countdown below stays live
  // instead of only updating when something else re-renders the component.
  // This is also what settles a DEMO trade once its expiry passes (there is
  // no server timer watching demo trades anymore — see isClientSideDemo
  // above), so results still resolve correctly even after a page refresh.
  // Real/Challenge trades are untouched here; those still settle via the
  // subscribeTradeResults socket handler above.
  useEffect(() => {
    if (openTrades.length === 0) return;
    const iv = setInterval(() => {
      forceTick(t => t + 1);
      const now = Date.now();
      useStore.getState().trades
        .filter(t => !t.resolved && t.walType === 'demo' && t.expiryAt <= now)
        .forEach(t => settleDemoTrade(t.id));
    }, 1000);
    return () => clearInterval(iv);
  }, [openTrades.length, settleDemoTrade]);

  const payout     = currentMarket?.payout || 82;
  const profit     = (amount * payout / 100).toFixed(2);
  const bal        = balance();

  const openTrade = useCallback(async (side: 'buy' | 'sell') => {
    resumeAudio();
    if (!currentMarket) { showToast('Select a market first'); return; }

    // GUARD: right after the market switches (e.g. tapping a signal jumps
    // straight to a new pair), the live price feed for that new symbol
    // hasn't delivered its first tick yet — `livePrice` is briefly null
    // during that window (see AssetBar's reset-on-symbol-change effect).
    // Without this check, a fast tap here would silently fall back to the
    // market's last cached REST price (which can be stale by several
    // seconds) while the *server* fills at its own fresh live price —
    // making the executed entry look like it came from nowhere relative
    // to what was on screen. Block real/challenge trades until the fresh
    // tick lands; demo trades below use their own always-current tick map
    // so they're unaffected.
    if (!isClientSideDemo && livePrice === null) {
      showToast('Fetching live price — try again in a moment');
      return;
    }

    // Weekend market-hours check: Forex and Gold close Sat & Sun
    const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
    if ((dayOfWeek === 0 || dayOfWeek === 6) && currentMarket.category !== 'Crypto') {
      showToast(`${currentMarket.name} is closed on weekends`);
      return;
    }

    if (amount <= 0) { showToast('Enter a valid amount'); return; }
    if (amount > bal) {
      showToast(walType === 'demo' ? 'Insufficient demo balance' : walType === 'challenge' ? 'Insufficient challenge balance' : 'Add funds to continue');
      if (walType === 'real') setTimeout(() => setOverlay('deposit'), 500);
      return;
    }
    setLastResult(null);
    setPlacingCount(c => ({ ...c, [side]: c[side] + 1 }));

    // ── Signal-precision check ─────────────────────────────────────────────
    // If this tap corresponds to a signal the person tapped into (same
    // market, matching direction, not yet expired), the trade is only
    // allowed to open if the price is still essentially where that signal
    // said it was. Covers both the demo path (below) and the server path
    // further down. The matched signal is a one-shot reference — it's
    // cleared after this attempt either way, so it never silently applies
    // to a later, unrelated trade.
    const matchedSignal = (
      activeSignal &&
      activeSignal.symbol === currentMarket.symbol &&
      activeSignal.direction === side &&
      activeSignal.expiresAt > Date.now()
    ) ? activeSignal : null;

    // ── DEMO wallet (guest or logged-in): never call the backend ──────────
    // A guest session has no real JWT (would fail auth anyway), and a
    // logged-in demo trade simply doesn't need the server — no real money
    // moves, so it's opened, tracked, and settled entirely on this device.
    // Entry price prefers this exact symbol's own live exchange tick (see
    // demoTickPrices above) over the more general on-screen livePrice, for
    // the same reason settlement does: it's the accurate one regardless of
    // any UI lag.
    if (isClientSideDemo) {
      const entryPrice = demoTickPrices.current.get(currentMarket.symbol) ?? livePrice ?? currentMarket.price;

      // Demo trades never reach the backend, so this is the only place
      // that can enforce signal precision for them — no fill, no balance
      // touched, if the price has drifted off the signal's entry.
      if (matchedSignal) {
        const drift = Math.abs(entryPrice - matchedSignal.entryPrice) / matchedSignal.entryPrice;
        if (drift > SIGNAL_ENTRY_TOLERANCE_PCT) {
          setActiveSignal(null);
          showToast(t('sig.entryDrifted'));
          setPlacingCount(c => ({ ...c, [side]: Math.max(0, c[side] - 1) }));
          return;
        }
      }

      const trade = {
        id: `demo_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        mktId: currentMarket.id, mktName: currentMarket.name,
        side, amount, entry: entryPrice,
        dec: currentMarket.dec, payout,
        walType, openedAt: Date.now(),
        expiryAt: Date.now() + expMin * 60 * 1000,
        resolved: false,
      };
      addTrade(trade);
      adjustBalance(-amount);
      if (soundEnabled) playOpen();
      showToast(`${side === 'buy' ? '▲ BUY' : '▼ SELL'} opened · ${expDisp} · $${amount}`);
      if (matchedSignal) setActiveSignal(null);
      setPlacingCount(c => ({ ...c, [side]: Math.max(0, c[side] - 1) }));
      return;
    }

    // Fast client-side pre-check for the server path — the same drift the
    // demo branch checks above, using the best price this device currently
    // has. This just avoids a pointless round-trip when it's obviously off;
    // the SERVER'S own check (against its own live feed, using signalId
    // below) is what's actually authoritative here, since this device's
    // price can itself be a moment stale.
    if (matchedSignal) {
      const refPrice = livePrice ?? currentMarket.price;
      const drift = Math.abs(refPrice - matchedSignal.entryPrice) / matchedSignal.entryPrice;
      if (drift > SIGNAL_ENTRY_TOLERANCE_PCT) {
        setActiveSignal(null);
        showToast(t('sig.entryDrifted'));
        setPlacingCount(c => ({ ...c, [side]: Math.max(0, c[side] - 1) }));
        return;
      }
    }

    // ── Wait for the server's real record before showing anything ─────────
    // Previously this drew the trade on the chart immediately using the
    // last websocket price on the device, then swapped it for the server's
    // real entryPrice once the response came back — which meant the marker
    // visibly jumped whenever the market moved (or the round-trip took
    // longer) between those two moments. Now the marker is only ever drawn
    // once with the server's authoritative entryPrice, so there's nothing
    // to correct afterwards. The button's brief spinner (placingCount) is
    // what covers the round-trip visually instead — it's not a price, so
    // it can never be "wrong".
    try {
      const res = await apiFetch('/api/trade/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketSymbol: currentMarket.symbol,
          side, amount,
          expirySeconds: expMin * 60,
          clientPrice: livePrice ?? currentMarket.price,
          ...(matchedSignal ? { signalId: matchedSignal.id } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.trade) {
        const i18nKey = data.code ? SIGNAL_ERROR_I18N_KEY[data.code] : undefined;
        showToast(i18nKey ? t(i18nKey) : (data.error || 'Could not open trade'));
        if (matchedSignal) setActiveSignal(null);
        return;
      }

      const trade = {
        id: data.trade._id, mktId: currentMarket.id, mktName: currentMarket.name,
        side, amount, entry: data.trade.entryPrice,
        dec: currentMarket.dec, payout,
        walType, openedAt: Date.now(),
        expiryAt: Date.now() + expMin * 60 * 1000,
        resolved: false,
      };
      addTrade(trade);
      adjustBalance(-amount);
      if (soundEnabled) playOpen();
      showToast(`${side === 'buy' ? '▲ BUY' : '▼ SELL'} opened · ${expDisp} · $${amount}`);
      if (matchedSignal) setActiveSignal(null);
    } catch {
      showToast('Connection error — trade not opened');
    } finally {
      setPlacingCount(c => ({ ...c, [side]: Math.max(0, c[side] - 1) }));
    }
  }, [currentMarket, amount, bal, walType, expMin, expDisp, payout, soundEnabled, isClientSideDemo, livePrice, activeSignal, setActiveSignal, t]);

  function addRipple(e: React.MouseEvent<HTMLButtonElement>) {
    const btn = e.currentTarget;
    const rip = document.createElement('span');
    const rect = btn.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    rip.className = 'rip';
    rip.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size/2}px;top:${e.clientY - rect.top - size/2}px`;
    btn.appendChild(rip);
    setTimeout(() => rip.remove(), 600);
  }

  return (
    <div className="bottom-area">
      {/* Trade result card */}
      {lastResult && (
        <div className={`tr-result-card ${lastResult.won ? 'win' : 'loss'}${resultLeaving ? ' leaving' : ''}`}>
          <div className="tr-result-header">
            <div className="tr-result-icon">
              {lastResult.won
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              }
            </div>
            <div>
              <div className="tr-result-label">{lastResult.won ? '✓ TRADE WON' : '✗ TRADE LOST'}</div>
              <div className="tr-result-sub">{lastResult.market}</div>
            </div>
          </div>
          <div className={`tr-result-amount ${lastResult.won ? 'win' : 'loss'}`}>
            {lastResult.won ? '+' : '-'}${Math.abs(lastResult.profit).toFixed(2)}
          </div>
        </div>
      )}

      {/* Amount + Expiry */}
      <div className="amount-row">
        <div className="amount-display" onClick={() => setOverlay('expiry' as any)}>
          <div>
            <div className="amount-label">{t('app.trade.amount')}</div>
            <div className="amount-val">${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>

        {/* Quick amount buttons */}
        <div style={{ display:'flex', gap:4 }}>
          {[25,50,100].map(v => (
            <button
              key={v}
              onClick={() => setAmount(v)}
              style={{
                padding:'0 8px', height:'100%', minHeight:48,
                background: amount === v ? 'rgba(0,230,118,.1)' : 'var(--bg2)',
                border:`1px solid ${amount === v ? 'rgba(0,230,118,.3)' : 'var(--border2)'}`,
                borderRadius:'var(--r3)', color: amount === v ? 'var(--g0)' : 'var(--t4)',
                fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                transition:'all .15s',
              }}
            >${v}</button>
          ))}
        </div>

        <div className="expiry-display" onClick={() => setOverlay('expiry' as any)}>
          <div>
            <div className="expiry-label">{t('app.trade.expiry')}</div>
            <div className="expiry-val">{expDisp}</div>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </div>

      {/* Payout info strip */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'4px 2px', marginBottom:8,
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, color:'var(--t4)' }}>{t('app.trade.payout')}</span>
          <span style={{ fontSize:12, fontWeight:800, color:'var(--g0)' }}>{payout}%</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, color:'var(--t4)' }}>{t('app.trade.profit')}</span>
          <span style={{ fontSize:12, fontWeight:800, color:'var(--g0)', fontFamily:'JetBrains Mono, monospace' }}>+${profit}</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:10, color:'var(--t4)' }}>{t('app.trade.balance')}</span>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--t2)', fontFamily:'JetBrains Mono, monospace' }}>
            {balanceHidden ? '••••••' : `$${bal.toFixed(2)}`}
          </span>
        </div>
      </div>

      {/* Trade buttons */}
      <div className="trade-btns">
        <button
          className="trade-btn buy"
          disabled={placingCount.buy > 0}
          onClick={(e) => { addRipple(e); openTrade('buy'); }}
        >
          <span className="trade-btn-icon-chip">
            {placingCount.buy > 0 ? (
              <svg className="trade-btn-icon" style={{ animation: 'spin .7s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M21 12a9 9 0 1 1-9-9" strokeLinecap="round" />
              </svg>
            ) : (
              <svg className="trade-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="18 15 12 9 6 15"/>
              </svg>
            )}
          </span>
          <div>
            <div className="trade-btn-label">
              {placingCount.buy > 0 ? t('app.trade.placing') || 'Placing…' : t('app.trade.buyUp')}
            </div>
            <div className="trade-btn-sub">+${profit}</div>
          </div>
        </button>
        <button
          className="trade-btn sell"
          disabled={placingCount.sell > 0}
          onClick={(e) => { addRipple(e); openTrade('sell'); }}
        >
          <div>
            <div className="trade-btn-label">
              {placingCount.sell > 0 ? t('app.trade.placing') || 'Placing…' : t('app.trade.sellDown')}
            </div>
            <div className="trade-btn-sub">+${profit}</div>
          </div>
          <span className="trade-btn-icon-chip">
          {placingCount.sell > 0 ? (
            <svg className="trade-btn-icon" style={{ animation: 'spin .7s linear infinite' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M21 12a9 9 0 1 1-9-9" strokeLinecap="round" />
            </svg>
          ) : (
            <svg className="trade-btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          )}
          </span>
        </button>
      </div>

    </div>
  );
}
