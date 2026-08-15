import { useState, useEffect, useRef, useCallback } from 'react';
import { useStore } from '../../lib/store';
import { apiFetch } from '../../lib/api';
import { subscribeSignals } from '../../lib/liveSocket';
import { useI18n } from '../../lib/i18n';

type SignalDir = 'buy' | 'sell';
type SignalStrength = 'weak' | 'moderate' | 'strong';

interface Signal {
  id: string;
  symbol: string;
  dir: SignalDir;
  timeframe: '1m' | '3m' | '5m';
  strength: SignalStrength;
  rsi: number;
  macd: number;
  macdSignal: number;
  entryPrice: number;
  generatedAt: number;
  expiresAt: number;
}

const STRENGTH_PCT: Record<SignalStrength, number> = { weak: 55, moderate: 75, strong: 92 };
const REFRESH_SEC = 20;
// How many signal cards are actually rendered in the list at once. The
// backend/socket can still deliver up to 50 active signals — this just
// caps what the user sees so the list doesn't feel overwhelming. Bump
// this up if you want more shown again.
const MAX_DISPLAYED = 50;

function normalizeSignal(raw: any): Signal | null {
  if (!raw?.symbol || !raw?.direction) return null;
  return {
    id: raw._id || raw.id || `${raw.symbol}_${raw.direction}_${raw.generatedAt || Date.now()}`,
    symbol: raw.symbol,
    dir: raw.direction,
    timeframe: raw.timeframe || '1m',
    strength: raw.strength || 'moderate',
    rsi: typeof raw.rsi === 'number' ? raw.rsi : 50,
    macd: typeof raw.macd === 'number' ? raw.macd : 0,
    macdSignal: typeof raw.macdSignal === 'number' ? raw.macdSignal : 0,
    entryPrice: typeof raw.entryPrice === 'number' ? raw.entryPrice : 0,
    generatedAt: raw.generatedAt ? new Date(raw.generatedAt).getTime() : Date.now(),
    expiresAt: raw.expiresAt ? new Date(raw.expiresAt).getTime() : Date.now() + 5 * 60 * 1000,
  };
}

function timeframeToMin(tf: string): number {
  const n = parseInt(tf, 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

function describeSignal(sig: Signal): string {
  const crossover = sig.macd >= sig.macdSignal ? 'bullish MACD crossover' : 'bearish MACD crossover';
  const rsiNote =
    sig.rsi >= 70 ? 'overbought territory' :
    sig.rsi <= 30 ? 'oversold territory' :
    'neutral momentum';
  const conviction = sig.strength === 'strong' ? 'High-conviction' : sig.strength === 'moderate' ? 'Balanced' : 'Early-stage';
  return `${conviction} setup — RSI ${sig.rsi.toFixed(1)} (${rsiNote}), confirmed by a ${crossover}.`;
}

export default function SignalsOverlay() {
  const { t } = useI18n();
  const setOverlay       = useStore(s => s.setOverlay);
  const markets          = useStore(s => s.markets);
  const setCurrentMarket = useStore(s => s.setCurrentMarket);
  const setExpiry        = useStore(s => s.setExpiry);
  const showToast        = useStore(s => s.showToast);
  const setActiveSignal  = useStore(s => s.setActiveSignal);

  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState<'all' | 'buy' | 'sell'>('all');
  const [refreshIn, setRefreshIn] = useState(REFRESH_SEC);
  const [, forceTick] = useState(0);

  const marketsRef = useRef(markets);
  marketsRef.current = markets;

  const loadSignals = useCallback(() => {
    apiFetch('/api/signals/latest')
      .then(r => r.json())
      .then(data => {
        const list: Signal[] = Array.isArray(data?.signals)
          ? data.signals.map(normalizeSignal).filter(Boolean) as Signal[]
          : [];
        setSignals(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSignals();
    setRefreshIn(REFRESH_SEC);
    const genIv = setInterval(() => { loadSignals(); setRefreshIn(REFRESH_SEC); }, REFRESH_SEC * 1000);
    const tickIv = setInterval(() => setRefreshIn(s => Math.max(0, s - 1)), 1000);
    // Live push — a freshly generated signal appears instantly instead of
    // waiting for the next poll.
    const unsub = subscribeSignals((raw) => {
      const sig = normalizeSignal(raw);
      if (!sig) return;
      setSignals(prev => [sig, ...prev.filter(s => s.id !== sig.id)].slice(0, 50));
    });
    // Re-render periodically so "expires in" / "time ago" labels stay fresh.
    const uiIv = setInterval(() => forceTick(n => n + 1), 5000);
    return () => { clearInterval(genIv); clearInterval(tickIv); clearInterval(uiIv); unsub(); };
  }, [loadSignals]);

  // Drop any signal for a symbol that isn't (or is no longer) tradable on
  // the platform — showing it invited a tap that would just fail with
  // "market not available". The backend already filters /latest this way,
  // but live-pushed signals arrive over the socket unfiltered, so this
  // guard covers both paths.
  const active = signals.filter(s => s.expiresAt > Date.now() && marketsRef.current.some(m => m.symbol === s.symbol));
  const filtered = active.filter(s => filter === 'all' || s.dir === filter);
  // Cap what's actually shown — the freshest signals first, so trimming
  // the list never hides something newer in favor of something older.
  const displayed = [...filtered].sort((a, b) => b.generatedAt - a.generatedAt).slice(0, MAX_DISPLAYED);
  const hiddenCount = filtered.length - displayed.length;

  // Tapping a signal jumps straight to that pair's chart with the matching
  // trade duration pre-selected — no extra taps needed to line the trade up.
  function enterSignal(sig: Signal) {
    const market = marketsRef.current.find(m => m.symbol === sig.symbol);
    if (!market) { showToast('That market isn\'t available right now'); return; }
    const expiryMin = timeframeToMin(sig.timeframe);
    setCurrentMarket(market);
    setExpiry(expiryMin, sig.timeframe);
    // Precision requirement: remember exactly which signal this was so the
    // trade buttons can confirm the fill still matches its entryPrice (or
    // cancel the trade instead of opening it somewhere else) — see
    // BottomControls.openTrade. Skipped if the signal has no usable
    // entryPrice (guards a divide-by-zero in the drift check below).
    if (sig.entryPrice > 0) {
      setActiveSignal({ id: sig.id, symbol: sig.symbol, direction: sig.dir, entryPrice: sig.entryPrice, expiresAt: sig.expiresAt });
    }
    setOverlay('none');
    showToast(`${sig.dir === 'buy' ? '▲ ' + t('sig.tapUp') : '▼ ' + t('sig.tapDown')} on ${market.base} · ${sig.timeframe} ${t('sig.expiryReady')}`);
  }

  function timeAgo(ts: number) {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 5) return t('sig.justNow');
    if (secs < 60) return `${secs}s ${t('sig.ago')}`;
    return `${Math.floor(secs / 60)}m ${t('sig.ago')}`;
  }

  function expiresIn(ts: number) {
    const secs = Math.floor((ts - Date.now()) / 1000);
    if (secs <= 0) return '0s';
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m`;
  }

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />
        <div className="overlay-header">
          <span className="overlay-title">{t('sig.title')}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 8 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--g0)', display: 'inline-block', boxShadow: '0 0 6px var(--g0)', animation: 'pulseDot 2s infinite' }} />
            <span style={{ fontSize: 11, color: 'var(--g0)', fontWeight: 700 }}>{t('sig.live')}</span>
          </div>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div style={{ padding: '8px 16px 0' }}>
          <div style={{ fontSize: 11, color: 'var(--t4)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/></svg>
            {t('sig.durationNote')} · {t('sig.refreshingIn')} {refreshIn}s
          </div>
          <div className="signal-filter-row">
            {(['all','buy','sell'] as const).map(f => (
              <div key={f} className={`signal-filter ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
                {f === 'all' ? t('wd.all') : f === 'buy' ? t('sig.buy') : t('sig.sell')}
              </div>
            ))}
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--t4)', alignSelf: 'center' }}>
              {displayed.length} {t('sig.signalsCount')}
            </div>
          </div>
        </div>

        <div className="overlay-body">
          {loading && (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 10px' }} />
              <div style={{ fontSize: 12, color: 'var(--t4)' }}>Analyzing markets…</div>
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--t4)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t3)', marginBottom: 4 }}>No live signals right now</div>
              <div style={{ fontSize: 12 }}>Our engine is watching the market — new signals appear here the moment they fire.</div>
            </div>
          )}

          {displayed.map(sig => {
            const market = marketsRef.current.find(m => m.symbol === sig.symbol);
            const base = market?.base || sig.symbol.replace(/USDT$/, '');
            const strengthPct = STRENGTH_PCT[sig.strength];
            return (
              <div
                key={sig.id}
                className={`signal-card ${sig.strength === 'strong' ? 'strong' : ''}`}
                onClick={() => enterSignal(sig)}
                style={{ cursor: 'pointer' }}
              >
                <div className="signal-header-row1">
                  <span className={`signal-dir ${sig.dir}`}>
                    {sig.dir === 'buy' ? '▲ ' : '▼ '}{sig.dir.toUpperCase()}
                  </span>
                  <span className="signal-market">{base}</span>
                  <span style={{ fontSize: 11, color: 'var(--t4)', marginLeft: 'auto' }}>{timeAgo(sig.generatedAt)}</span>
                </div>
                <div className="signal-header-row2">
                  <span className="signal-tf" title={t('sig.recommendedDuration')}>{sig.timeframe} {t('sig.expirySuffix')}</span>
                  {sig.strength === 'strong' && <span className="signal-badge-strong">{t('sig.premium')}</span>}
                </div>

                <div style={{ fontSize: 13.5, color: 'var(--t3)', marginBottom: 4, lineHeight: 1.5 }}>
                  {describeSignal(sig)}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--t4)', fontWeight: 600 }}>{t('sig.strength')} {strengthPct}%</span>
                  <span style={{ fontSize: 11.5, color: 'var(--t4)' }}>{t('app.trade.expiry')} {expiresIn(sig.expiresAt)}</span>
                </div>
                <div className="signal-strength-bar">
                  <div className={`signal-strength-fill ${sig.dir}`} style={{ width: `${strengthPct}%` }} />
                </div>

                <div className="signal-metrics">
                  <div className="signal-metric">
                    <div className="signal-metric-label">RSI</div>
                    <div className="signal-metric-val">{sig.rsi.toFixed(1)}</div>
                  </div>
                  <div className="signal-metric">
                    <div className="signal-metric-label">MACD</div>
                    <div className="signal-metric-val">{sig.macd.toFixed(4)}</div>
                  </div>
                  <div className="signal-metric">
                    <div className="signal-metric-label">Entry</div>
                    <div className="signal-metric-val">{sig.entryPrice ? sig.entryPrice.toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'}</div>
                  </div>
                </div>

                <button
                  className={`signal-btn ${sig.dir === 'buy' ? 'buy' : 'sell'}`}
                  style={{ width: '100%', marginTop: 10 }}
                  onClick={e => { e.stopPropagation(); enterSignal(sig); }}
                >
                  <span>{t('sig.enterTrade')} — {sig.dir === 'buy' ? t('app.trade.buyUp') : t('app.trade.sellDown')} {base} · {sig.timeframe}</span>
                  <span className="signal-btn-chevron">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                      {sig.dir === 'buy' ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
                    </svg>
                  </span>
                </button>
              </div>
            );
          })}

          {hiddenCount > 0 && (
            <div style={{ padding: '4px 0 8px', textAlign: 'center', fontSize: 11, color: 'var(--t4)' }}>
              +{hiddenCount} more signals — refine with the filters above
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
