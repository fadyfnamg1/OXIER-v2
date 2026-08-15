import { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { getFlagUrls, getFlagColor, fmt, TRENDING_BASES } from '../lib/markets';
import { subscribeTrade } from '../lib/liveSocket';
import { playClick, resumeAudio } from '../lib/sounds';
import type { Market } from '../types';

function AssetIcon({ market, size = 24 }: { market: Market; size?: number }) {
  const urls = getFlagUrls(market.base);
  const [idx, setIdx] = useState(0);

  // Reset back to the first candidate URL whenever the asset itself changes
  // (this component instance gets reused across market switches, e.g. the
  // current-asset icon in the top bar) — otherwise it'd get stuck showing
  // initials for a coin whose logo actually does exist.
  useEffect(() => { setIdx(0); }, [market.base]);

  if (idx >= urls.length) {
    const c = getFlagColor(market.base);
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%',
        background: `linear-gradient(135deg, ${c}, ${c}cc)`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: size * 0.35, fontWeight: 800, color: '#fff',
        flexShrink: 0, border: '1px solid rgba(255,255,255,.12)',
        textShadow: '0 1px 2px rgba(0,0,0,.35)',
      }}>
        {market.base.slice(0, 2)}
      </div>
    );
  }
  return (
    <img
      key={`${market.base}-${idx}`}
      src={urls[idx]}
      width={size} height={size}
      style={{ borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
      onError={() => setIdx(i => i + 1)}
    />
  );
}

function MarketTicket({ m, active, onClick }: { m: Market; active: boolean; onClick: () => void }) {
  const up = m.change >= 0;

  return (
    <div className={`market-ticket ${active ? 'active' : ''}`} onClick={onClick}>
      <div className="market-ticket-top">
        <AssetIcon market={m} size={36} />
        <div className="market-ticket-info">
          <div className="market-ticket-name-row">
            <span className="market-ticket-name">{m.base}/USDT</span>
          </div>
          <div className="market-ticket-sub">{m.category}</div>
        </div>
        <div className="market-ticket-payout-col">
          <span className="market-ticket-payout">{m.payout}%</span>
        </div>
        <div className="market-ticket-right">
          <div className="market-ticket-price">{fmt(m.price, m.dec)}</div>
          <div className={`market-ticket-change ${up ? 'up' : 'down'}`}>
            {up ? '+' : ''}{m.change.toFixed(2)}%
          </div>
        </div>
      </div>
    </div>
  );
}

function MarketsModal({ onClose, onPick }: { onClose: () => void; onPick?: (m: Market) => void }) {
  const markets         = useStore(s => s.markets);
  const currentMarket   = useStore(s => s.currentMarket);
  const setCurrentMarket = useStore(s => s.setCurrentMarket);

  const [search, setSearch] = useState('');
  const [cat, setCat]       = useState('All');
  const cats = ['All', 'Crypto', 'Gold'];

  const filtered = markets.filter(m => {
    const matchCat    = cat === 'All' || m.category === cat;
    const matchSearch = !search
      || m.name.toLowerCase().includes(search.toLowerCase())
      || m.base.toLowerCase().includes(search.toLowerCase())
      || m.symbol.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  // Pin the trending pairs into their own section at the top, only when
  // browsing unfiltered — a search or category pick should just show a
  // flat matching list. Order within each section comes straight from the
  // backend (ranked by 24h % change, biggest movers first) — we only use
  // TRENDING_BASES here to decide *membership*, not order.
  const showTrendingSection = cat === 'All' && !search;
  const trendingSet = new Set(TRENDING_BASES);
  const trendingList = showTrendingSection ? filtered.filter(m => trendingSet.has(m.base)) : [];
  const restList = showTrendingSection
    ? filtered.filter(m => !trendingSet.has(m.base))
    : filtered;

  return (
    <div className="markets-modal">
      <div className="markets-header">
        <button className="markets-back" onClick={onClose}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="markets-title">Markets</span>
        <span style={{ fontSize: 11, color: 'var(--t4)', marginLeft: 'auto', fontWeight: 600 }}>
          {filtered.length} pairs
        </span>
      </div>

      <div className="markets-search-wrap">
        <div className="markets-search-wrap-inner">
          <svg className="markets-search-ico" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            className="markets-search"
            placeholder="Search markets..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      <div className="markets-cats">
        {cats.map(c => (
          <div key={c} className={`markets-cat ${cat === c ? 'active' : ''}`} onClick={() => setCat(c)}>
            {c}
          </div>
        ))}
      </div>

      {/* Column header row — matches the reference table layout */}
      <div className="markets-col-head">
        <span style={{ flex: 1.4 + 0.9 }}>Asset</span>
        <span style={{ flex: 0.7, textAlign: 'center' }}>Payout</span>
        <span style={{ flex: 1, textAlign: 'right' }}>Price</span>
      </div>

      <div className="markets-list">
        {showTrendingSection && trendingList.length > 0 && (
          <>
            <div style={{ padding: '10px 16px 6px', fontSize: 11, fontWeight: 800, color: 'var(--g0)', letterSpacing: 0.4, textTransform: 'uppercase' }}>
              🔥 Trending
            </div>
            {trendingList.map(m => (
              <MarketTicket
                key={m.id}
                m={m}
                active={currentMarket?.id === m.id}
                onClick={() => { playClick(); if (onPick) onPick(m); else setCurrentMarket(m); onClose(); }}
              />
            ))}
            <div style={{ padding: '12px 16px 6px', fontSize: 11, fontWeight: 800, color: 'var(--t4)', letterSpacing: 0.4, textTransform: 'uppercase' }}>
              All Markets
            </div>
          </>
        )}
        {restList.map(m => (
          <MarketTicket
            key={m.id}
            m={m}
            active={currentMarket?.id === m.id}
            onClick={() => { playClick(); if (onPick) onPick(m); else setCurrentMarket(m); onClose(); }}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--t4)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No markets found</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Try a different search term</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AssetBar() {
  const markets          = useStore(s => s.markets);
  const currentMarket    = useStore(s => s.currentMarket);
  const setCurrentMarket = useStore(s => s.setCurrentMarket);
  const trades           = useStore(s => s.trades);
  const expMin           = useStore(s => s.expMin);
  const setLivePrice     = useStore(s => s.setLivePrice);
  const setOverlay       = useStore(s => s.setOverlay);
  const liveGlobalPrice  = useStore(s => s.livePrice);

  const [showMarkets, setShowMarkets] = useState(false);
  const [addingPair, setAddingPair] = useState(false);
  // Pairs the trader has explicitly opened as tabs (starts with just the
  // current one). The "+" button adds another pair alongside it instead of
  // replacing it; once there are more than fit on screen the row scrolls
  // horizontally so the hidden ones stay reachable.
  const [openTabIds, setOpenTabIds] = useState<string[]>(() => currentMarket ? [currentMarket.id] : []);
  useEffect(() => {
    if (currentMarket && !openTabIds.includes(currentMarket.id)) {
      setOpenTabIds(ids => [...ids, currentMarket.id]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentMarket?.id]);
  const [livePrice, setLivePriceLocal] = useState<number | null>(null);
  const [prevPrice, setPrevPrice]     = useState<number | null>(null);
  const [tradeLivePrices, setTradeLivePrices] = useState<Record<string, number>>({});
  const countdown = useRef<NodeJS.Timeout | null>(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [, forceTick] = useState(0);

  // All open trades
  const openTrades = trades.filter(t => !t.resolved);
  const activeTrade = openTrades.length > 0
    ? openTrades.reduce((a, b) => a.expiryAt < b.expiryAt ? a : b)
    : null;

  // Countdown for active trade
  useEffect(() => {
    if (activeTrade) {
      const update = () => {
        const left = Math.max(0, Math.floor((activeTrade.expiryAt - Date.now()) / 1000));
        setTimeLeft(left);
      };
      update();
      countdown.current = setInterval(update, 1000);
      return () => { if (countdown.current) clearInterval(countdown.current); };
    } else {
      setTimeLeft(expMin * 60);
    }
  }, [activeTrade?.id, expMin]);

  // Force re-render for live P&L
  useEffect(() => {
    if (!activeTrade) return;
    const iv = setInterval(() => forceTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, [activeTrade?.id]);

  // Live price, relayed through our own backend instead of connecting
  // straight to Binance's @trade stream (see lib/liveSocket.ts).
  useEffect(() => {
    if (!currentMarket) return;
    const symbol = currentMarket.symbol;

    setLivePriceLocal(null);
    useStore.getState().setLivePrice(null);

    const unsubscribe = subscribeTrade(symbol, (p) => {
      setLivePriceLocal(prev => { setPrevPrice(prev); return p; });
      setLivePrice(p);
    });

    return () => { unsubscribe(); };
  }, [currentMarket?.symbol]);

  // Live prices for *every* open trade's market — not just the one on
  // screen — so the aggregate P&L strip below stays accurate even when
  // trades are spread across different pairs.
  const openTradeSymbols = Array.from(new Set(
    openTrades.map(t => markets.find(m => m.id === t.mktId)?.symbol).filter((s): s is string => !!s)
  )).sort().join(',');

  useEffect(() => {
    const symbols = openTradeSymbols ? openTradeSymbols.split(',') : [];
    const unsubs = symbols.map(sym =>
      subscribeTrade(sym, (p) =>
        setTradeLivePrices(prev => (prev[sym] === p ? prev : { ...prev, [sym]: p }))
      )
    );
    return () => { unsubs.forEach(u => u()); };
  }, [openTradeSymbols]);

  if (!currentMarket) return <div className="assetbar" />;

  const price    = livePrice ?? currentMarket.price;
  const priceDir = livePrice !== null && prevPrice !== null
    ? (livePrice > prevPrice ? 'up' : livePrice < prevPrice ? 'down' : '')
    : '';

  // Live net P&L across ALL open trades (not just the nearest-expiry one):
  // sum up the payout profit of every trade currently winning, sum up the
  // stake of every trade currently losing, and show the net difference —
  // positive if winners are ahead, negative if losers are ahead. Works the
  // same whether there's 1 open trade or 50.
  const currentPrice = liveGlobalPrice ?? price;
  const priceForTrade = (t: typeof openTrades[number]): number => {
    const sym = markets.find(m => m.id === t.mktId)?.symbol;
    if (sym === currentMarket.symbol) return currentPrice;
    if (sym && tradeLivePrices[sym] !== undefined) return tradeLivePrices[sym];
    return markets.find(m => m.id === t.mktId)?.price ?? t.entry;
  };

  let totalWinProfit = 0;
  let totalLossStake = 0;
  for (const t of openTrades) {
    const cp = priceForTrade(t);
    const winning = t.side === 'buy' ? cp > t.entry : cp < t.entry;
    if (winning) totalWinProfit += t.amount * (t.payout / 100);
    else totalLossStake += t.amount;
  }
  const netPnl = totalWinProfit - totalLossStake;
  const pnlPositive = netPnl >= 0;

  // Only the pairs the trader has opened as tabs (not every market in the
  // app) — scrollable — the horizontal scroller (.asset-mini-scroll,
  // overflow-x: auto) handles any number of them; nothing here is limited
  // to a fixed count anymore.
  const topMarkets = openTabIds
    .filter(id => id !== currentMarket.id)
    .map(id => markets.find(m => m.id === id))
    .filter((m): m is Market => !!m);

  const [favorites, setFavorites] = useState<string[]>([]);

  return (
    <>
      <div className="assetbar-wrap">
        <div className="assetbar">
          {/* Current asset — matches the reference exactly: icon, name,
              dropdown chevron, "Category · Payout%" subtitle */}
          <div className="asset-pick-btn" onClick={() => { resumeAudio(); playClick(); setShowMarkets(true); }}>
            <AssetIcon market={currentMarket} size={24} />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span className="asset-pick-name">{currentMarket.base}/USDT</span>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--g0)" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>
              <div className="asset-pick-sub-row">
                <span className="asset-pick-cat">{currentMarket.category}</span>
                <span className="asset-pick-payout">{currentMarket.payout}%</span>
              </div>
            </div>
          </div>

          {/* Add-pair button — opens a new tab alongside the current one */}
          <button
            className="asset-add-btn"
            onClick={() => { resumeAudio(); playClick(); setAddingPair(true); }}
            title="Add pair"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>

          <div style={{ flex: 1 }} />

          {/* Notifications — badge shows the number of currently open
              trades; tapping jumps to History */}
          <button
            className="asset-bell-btn"
            onClick={() => { resumeAudio(); playClick(); setOverlay('history'); }}
            title="Open trades"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            {openTrades.length > 0 && <span className="asset-bell-badge">{openTrades.length}</span>}
          </button>
        </div>

        {/* Live price / change for the current pair (kept — genuinely
            useful data the reference screenshot doesn't happen to show) */}
        <div className="asset-price-row">
          <span className={`asset-pick-price ${priceDir}`}>{fmt(price, currentMarket.dec)}</span>
          <span className={`asset-pick-change ${currentMarket.change >= 0 ? 'up' : 'down'}`}>
            {currentMarket.change >= 0 ? '+' : ''}{currentMarket.change.toFixed(2)}%
          </span>
          <button
            className={`asset-fav-btn ${favorites.includes(currentMarket.id) ? 'active' : ''}`}
            onClick={() => { resumeAudio(); playClick(); setFavorites(f => f.includes(currentMarket.id) ? f.filter(id => id !== currentMarket.id) : [...f, currentMarket.id]); }}
            title={favorites.includes(currentMarket.id) ? 'Remove from favorites' : 'Add to favorites'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill={favorites.includes(currentMarket.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
          </button>
        </div>

        {/* Open pair tabs — only shown once a second pair has been added;
            drag/scroll horizontally once there are more than fit on screen */}
        {topMarkets.length > 0 && (
          <div className="asset-mini-scroll">
            {topMarkets.map(m => (
              <div
                key={m.id}
                className={`asset-mini ${currentMarket.id === m.id ? 'active' : ''}`}
                onClick={() => { playClick(); setCurrentMarket(m); }}
              >
                <AssetIcon market={m} size={17} />
                <div>
                  <div className="asset-mini-name">{m.base}</div>
                  <div className="asset-mini-price">{fmt(m.price, m.dec)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Active trade interactive strip ────────────────────────────── */}
        {activeTrade && (
          <div
            className="trade-strip"
            onClick={() => setOverlay('history')}
            style={{ borderTop: `1px solid ${pnlPositive ? 'rgba(0,214,143,.15)' : 'rgba(255,58,78,.15)'}` }}
          >
            {/* Direction badge */}
            <div className={`trade-strip-badge ${activeTrade.side}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                {activeTrade.side === 'buy'
                  ? <polyline points="18 15 12 9 6 15"/>
                  : <polyline points="6 9 12 15 18 9"/>
                }
              </svg>
              {activeTrade.side === 'buy' ? 'BUY' : 'SELL'}
            </div>

            {/* Market */}
            <div style={{ fontSize:11, fontWeight:700, color:'var(--t2)', flex:1 }}>
              {activeTrade.mktName || currentMarket.base}
            </div>

            {/* Live P&L — net across all open trades */}
            <div style={{ fontSize:12, fontWeight:800, fontFamily:'JetBrains Mono', color: pnlPositive ? 'var(--g0)' : 'var(--red)', marginRight:8 }}>
              {pnlPositive ? `+${netPnl.toFixed(2)}` : `-${Math.abs(netPnl).toFixed(2)}`}
            </div>

            {/* Pulse dot */}
            <div style={{ width:6, height:6, borderRadius:'50%', background: pnlPositive ? 'var(--g0)' : 'var(--red)', boxShadow:`0 0 6px ${pnlPositive ? 'var(--g0)' : 'var(--red)'}`, animation:'pulseDot 1.2s infinite', marginRight:6 }} />

            {/* Live clock — so the client always knows exactly when the
                current candle/expiry cycle will land, not just a countdown. */}
            <div style={{ fontSize:11, fontWeight:700, fontFamily:'JetBrains Mono', color:'var(--t4)', whiteSpace:'nowrap', marginRight:8 }}>
              {new Date().toLocaleTimeString('en-GB', { hour12: false })}
            </div>

            {/* Time */}
            <div style={{ fontSize:11, fontWeight:700, fontFamily:'JetBrains Mono', color:'var(--t3)', whiteSpace:'nowrap' }}>
              {Math.floor(timeLeft/60)}:{String(timeLeft%60).padStart(2,'0')}
            </div>

            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2" style={{ marginLeft:4, flexShrink:0 }}>
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        )}
      </div>

      {showMarkets && <MarketsModal onClose={() => setShowMarkets(false)} />}
      {addingPair && (
        <MarketsModal
          onClose={() => setAddingPair(false)}
          onPick={(m) => {
            setOpenTabIds(ids => ids.includes(m.id) ? ids : [...ids, m.id]);
            setCurrentMarket(m);
          }}
        />
      )}
    </>
  );
}
