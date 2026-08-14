import { useState, useEffect, useRef } from 'react';
import { useStore } from '../lib/store';
import { resumeAudio } from '../lib/sounds';
import { useI18n } from '../lib/i18n';
import { BACKEND } from '../lib/api';
import { buildBinanceMarkets, getDecimals } from '../lib/markets';
import LanguageSwitcher from '../components/LanguageSwitcher';
import OxierLogo from '../components/OxierLogo';
import MarketBackground from '../components/MarketBackground';

/* ─────────────────────────────────────────────
   Helpers
───────────────────────────────────────────── */
function go(setScreen: (s: any) => void, s: 'login' | 'register') {
  resumeAudio();
  setScreen(s);
}

const ANDROID_APK_URL = `${BACKEND}/api/download/android`;

/** Big Google-Play-style "Download for Android" badge — triggers the .apk download directly. */
function AndroidDownloadButton({ large = false }: { large?: boolean }) {
  return (
    <a
      href={ANDROID_APK_URL}
      download
      className={`lp-android-btn${large ? ' large' : ''}`}
      aria-label="Download OXIER for Android"
    >
      <svg width={large ? 30 : 26} height={large ? 30 : 26} viewBox="0 0 24 24" fill="none" className="lp-android-ico">
        <path d="M4 3.5v17a1 1 0 001.5.87l14-8.5a1 1 0 000-1.74l-14-8.5A1 1 0 004 3.5z" fill="url(#androidPlayGrad)"/>
        <defs>
          <linearGradient id="androidPlayGrad" x1="4" y1="3" x2="19" y2="12" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#00D68F"/>
            <stop offset="100%" stopColor="#F7931A"/>
          </linearGradient>
        </defs>
      </svg>
      <span className="lp-android-txt">
        <span className="lp-android-sub">Download for</span>
        <span className="lp-android-main">Android · APK</span>
      </span>
    </a>
  );
}

/** Scroll-reveal hook — returns ref + visible flag */
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setVisible(true); },
      { threshold }
    );
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, visible };
}

/** Scroll-scrub progress (0→1) for a section, driven by the .lp-root
 *  scroll container (not window — the landing page scrolls its own
 *  overflow div, see .lp-root { overflow-y:auto } in index.css).
 *  0 = section just entering the viewport, 1 = section centered. Used to
 *  "play" the trade-preview animation as the user scrolls through it,
 *  instead of firing once on reveal. */
function useScrollProgress(ref: { current: HTMLElement | null }) {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const container = document.querySelector('.lp-root') as HTMLElement | null;
    if (!container) return;
    let raf = 0;
    function measure() {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const start = vh * 0.92, end = vh * 0.32;
      const raw = (start - rect.top) / (start - end);
      setProgress(Math.min(1, Math.max(0, raw)));
    }
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(measure);
    }
    measure();
    container.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ref]);
  return progress;
}

/** Number counter animation */
function Counter({ to, suffix = '', prefix = '' }: { to: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0);
  const { ref, visible } = useReveal(0.3);
  useEffect(() => {
    if (!visible) return;
    let cur = 0;
    const total = 1400;
    const step = to / (total / 16);
    const t = setInterval(() => {
      cur = Math.min(cur + step, to);
      setVal(Math.floor(cur));
      if (cur >= to) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [visible, to]);
  return <span ref={ref}>{prefix}{val.toLocaleString()}{suffix}</span>;
}

/* ─────────────────────────────────────────────
   Sub-components
───────────────────────────────────────────── */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`lp-faq-item${open ? ' open' : ''}`} onClick={() => setOpen(v => !v)}>
      <div className="lp-faq-q">
        <span>{q}</span>
        <div className={`lp-faq-icon${open ? ' open' : ''}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
      </div>
      {open && <div className="lp-faq-a">{a}</div>}
    </div>
  );
}

type Tick = { n: string; p: string; c: string; up: boolean };

const TICKER_BASES = ['BTC', 'ETH', 'XAUT', 'BNB', 'SOL', 'XRP', 'DOGE', 'TRX'];
const DEMO_TICKS: Tick[] = [
  { n: 'BTC/USDT', p: '—', c: '—', up: true },
  { n: 'ETH/USDT', p: '—', c: '—', up: true },
  { n: 'GOLD',     p: '—', c: '—', up: true },
  { n: 'BNB/USDT', p: '—', c: '—', up: true },
];

/** Real, live prices from our own Binance-backed market feed (the same
    endpoint the trading platform itself uses) — no more placeholder
    numbers in the marquee/hero ticker. Refreshes every 20s. */
function useLiveTicks(): Tick[] {
  const [ticks, setTicks] = useState<Tick[]>(DEMO_TICKS);
  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const markets = await buildBinanceMarkets();
        const picked = TICKER_BASES
          .map(base => markets.find((m: any) => m.base === base))
          .filter(Boolean);
        if (!picked.length || !alive) return;
        setTicks(picked.map((m: any) => ({
          n: m.base === 'XAUT' ? 'GOLD' : `${m.base}/USDT`,
          p: m.price.toLocaleString('en-US', { minimumFractionDigits: getDecimals(m.price), maximumFractionDigits: getDecimals(m.price) }),
          c: `${m.change >= 0 ? '+' : ''}${m.change.toFixed(2)}%`,
          up: m.change >= 0,
        })));
      } catch { /* keep last-known ticks on failure */ }
    }
    load();
    const iv = setInterval(load, 20000);
    return () => { alive = false; clearInterval(iv); };
  }, []);
  return ticks;
}

/** Infinite scrolling ticker tape — the "this is a live market" signal,
    placed right under the nav like a real exchange. Fed by useLiveTicks(). */
function TickerMarquee({ items }: { items: Tick[] }) {
  const row = (key: string) => (
    <div className="lp-marquee-row" key={key}>
      {items.map((tk, i) => (
        <span className="lp-marquee-item" key={i}>
          <b>{tk.n}</b> {tk.p}
          <em className={tk.up ? 'up' : 'down'}>{tk.up ? '▲' : '▼'} {tk.c}</em>
        </span>
      ))}
    </div>
  );
  return (
    <div className="lp-marquee" aria-hidden>
      <div className="lp-marquee-track">{row('a')}{row('b')}</div>
    </div>
  );
}

/** Animated mini chart for hero — a single glowing brand-orange price line */
function HeroChart() {
  return (
    <div className="lp-hero-chart" aria-hidden>
      <div className="lp-hero-scan" />
      <svg viewBox="0 0 360 140" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: '100%' }}>
        {[28, 56, 84, 112].map(y => (
          <line key={y} x1="0" y1={y} x2="360" y2={y} stroke="rgba(255,255,255,.04)" strokeWidth="1"/>
        ))}
        <defs>
          <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F7931A" stopOpacity="0.28"/>
            <stop offset="100%" stopColor="#F7931A" stopOpacity="0"/>
          </linearGradient>
          <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D9780A"/>
            <stop offset="100%" stopColor="#FFB648"/>
          </linearGradient>
          <filter id="chartGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3.2" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <path
          d="M0 110 L30 95 L60 100 L90 80 L120 85 L150 60 L180 70 L210 45 L240 55 L270 30 L300 40 L330 20 L360 28 L360 140 L0 140 Z"
          fill="url(#chartGrad)"
        />
        <path
          d="M0 110 L30 95 L60 100 L90 80 L120 85 L150 60 L180 70 L210 45 L240 55 L270 30 L300 40 L330 20 L360 28"
          stroke="url(#lineGrad)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#chartGlow)"
          className="lp-chart-line"
        />
        <circle cx="360" cy="28" r="4" fill="#FFB648" opacity="0.95"/>
        <circle cx="360" cy="28" r="9" fill="#F7931A" opacity="0.2" className="lp-chart-pulse"/>
        {[
          { x: 30, h: 30, t: 80, c: '#F7931A' },
          { x: 70, h: 25, t: 88, c: '#FF3A4E' },
          { x: 110, h: 28, t: 68, c: '#F7931A' },
          { x: 150, h: 32, t: 44, c: '#F7931A' },
          { x: 190, h: 22, t: 55, c: '#FF3A4E' },
          { x: 230, h: 30, t: 38, c: '#F7931A' },
          { x: 270, h: 26, t: 17, c: '#F7931A' },
        ].map((c, i) => (
          <g key={i}>
            <rect x={c.x - 5} y={c.t} width="10" height={c.h} rx="2" fill={c.c} opacity="0.32"/>
            <line x1={c.x} y1={c.t - 6} x2={c.x} y2={c.t + c.h + 6} stroke={c.c} strokeWidth="1.5" opacity="0.5"/>
          </g>
        ))}
      </svg>
    </div>
  );
}

/** Floating platform preview mockup */
/** The mock trading card — its chart, buy press and profit badge are
 *  scrubbed by `progress` (0→1) instead of firing once, so the whole
 *  "a trade plays out" moment happens in sync with the user's scroll,
 *  the way a scroll-driven product demo should. Falls back to fully
 *  drawn/settled (progress=1) for reduced-motion users. */
function PlatformPreview({ progress = 0 }: { progress?: number }) {
  const reducedMotion = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const p = reducedMotion ? 1 : progress;

  // Phase 1 (0 → .55): the price line draws itself in.
  const draw = Math.min(1, p / 0.55);
  // Phase 2 (.15 → .85, staggered): candles pop in behind the line.
  const candleAt = (i: number, n: number) => Math.min(1, Math.max(0, (p - (0.15 + i * (0.55 / n))) / 0.12));
  // Phase 3 (~.72): the Buy button gets pressed.
  const pressed = p > 0.72 && p < 0.93;
  // Phase 4 (.82 → 1): the profit badge settles in.
  const profitT = Math.min(1, Math.max(0, (p - 0.82) / 0.18));

  const greenCandles: [number, number, number][] = [[25,55,18],[75,43,16],[125,28,14],[175,16,14],[225,8,12]];
  const redCandles: [number, number, number][]   = [[50,62,12],[200,27,10]];

  return (
    <div className="lp-preview-frame">
      {/* Topbar */}
      <div className="lp-pv-topbar">
        <div className="lp-pv-logo">
          <OxierLogo size={12} />
        </div>
        <div className="lp-pv-balance">
          <div className="lp-pv-dot"/>
          <span>$10,245.80</span>
        </div>
      </div>
      {/* Asset strip */}
      <div className="lp-pv-assetbar">
        <div className="lp-pv-asset active">
          <span className="lp-pv-aname">BTC/USD</span>
          <span className="lp-pv-aprice up">65,420.10</span>
        </div>
        <div className="lp-pv-asset">
          <span className="lp-pv-aname">EUR/USD</span>
          <span className="lp-pv-aprice down">1.0842</span>
        </div>
        <div className="lp-pv-asset">
          <span className="lp-pv-aname">GOLD</span>
          <span className="lp-pv-aprice up">2,318.5</span>
        </div>
      </div>
      {/* Mini chart — line draws in and candles stagger on as you scroll */}
      <div className="lp-pv-chart">
        <svg viewBox="0 0 300 100" style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="pvGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00D68F" stopOpacity="0.2"/>
              <stop offset="100%" stopColor="#00D68F" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {[20, 40, 60, 80].map(y => (
            <line key={y} x1="0" y1={y} x2="300" y2={y} stroke="rgba(255,255,255,.05)" strokeWidth="1"/>
          ))}
          <path
            d="M0 80 L25 68 L50 72 L75 55 L100 60 L125 40 L150 48 L175 28 L200 35 L225 18 L250 25 L275 12 L300 16 L300 100 L0 100Z"
            fill="url(#pvGrad)" style={{ opacity: draw }}
          />
          <path
            d="M0 80 L25 68 L50 72 L75 55 L100 60 L125 40 L150 48 L175 28 L200 35 L225 18 L250 25 L275 12 L300 16"
            stroke="#00D68F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"
            pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw}
          />
          {/* A quiet dot riding the leading edge of the line while it draws */}
          {draw > 0.02 && draw < 1 && (
            <circle cx={300 * draw} cy={80 - 64 * draw} r="3.2" fill="#00D68F">
              <animate attributeName="r" values="3.2;4.4;3.2" dur="1s" repeatCount="indefinite" />
            </circle>
          )}
          {greenCandles.map(([x,y,h],i) => (
            <rect key={`g${i}`} x={x-4} y={y} width="8" height={h} rx="1.5" fill="#00D68F"
              style={{ opacity: 0.45 * candleAt(i, greenCandles.length), transform: `translateY(${(1-candleAt(i, greenCandles.length))*6}px)`, transformOrigin: `${x}px ${y+h}px`, transition: 'opacity .2s, transform .2s' }} />
          ))}
          {redCandles.map(([x,y,h],i) => (
            <rect key={`r${i}`} x={x-4} y={y} width="8" height={h} rx="1.5" fill="#FF3A4E"
              style={{ opacity: 0.45 * candleAt(i + 1, greenCandles.length), transition: 'opacity .2s' }} />
          ))}
        </svg>
      </div>
      {/* Trade controls */}
      <div className="lp-pv-controls">
        <div className="lp-pv-amount">
          <span className="lp-pv-albl">Amount</span>
          <span className="lp-pv-aval">$100</span>
        </div>
        <div className="lp-pv-time">
          <span className="lp-pv-albl">Duration</span>
          <span className="lp-pv-aval">5:00</span>
        </div>
      </div>
      <div className="lp-pv-btns">
        <button
          className="lp-pv-btn buy"
          style={{ transform: pressed ? 'scale(.94)' : 'scale(1)', boxShadow: pressed ? '0 2px 8px rgba(0,214,143,.35)' : undefined, transition: 'transform .18s var(--ease-spring, ease), box-shadow .18s' }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="18 15 12 9 6 15"/></svg>
          Buy
        </button>
        <button className="lp-pv-btn sell">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="6 9 12 15 18 9"/></svg>
          Sell
        </button>
      </div>
      {/* Floating profit badge — settles in once the "trade" resolves */}
      <div
        className="lp-pv-profit"
        style={{
          opacity: profitT,
          transform: `translateY(${(1 - profitT) * 10}px) scale(${0.85 + profitT * 0.15})`,
          animation: profitT >= 1 ? undefined : 'none',
        }}
      >
        +$82.00 <span>+82%</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Main component
───────────────────────────────────────────── */
export default function LandingScreen() {
  const setScreen = useStore(s => s.setScreen);
  const { t, dir, lang } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const liveTicks = useLiveTicks();

  // Scroll spy for nav highlight
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = document.querySelector('.lp-root') as HTMLElement | null;
    if (!el) return;
    const onScroll = () => setScrolled(el.scrollTop > 40);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // Reveal refs
  const trustReveal    = useReveal(0.2);
  const aboutReveal    = useReveal(0.15);
  const featReveal     = useReveal(0.1);
  const stepsReveal    = useReveal(0.1);
  const previewReveal  = useReveal(0.15);
  const previewProgress = useScrollProgress(previewReveal.ref);
  const faqReveal      = useReveal(0.1);
  const ctaReveal      = useReveal(0.2);

  // Scroll-driven parallax for the hero visual — as the user scrolls past
  // the hero, the mockup card sinks back and fades slightly, giving the
  // "trading platform" preview real depth tied to scroll (not just a
  // one-time load animation). Capped to the first ~420px of scroll so it
  // finishes settling well before the next section arrives.
  const [heroScroll, setHeroScroll] = useState(0);
  useEffect(() => {
    const el = document.querySelector('.lp-root') as HTMLElement | null;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setHeroScroll(Math.min(1, el!.scrollTop / 420)));
    }
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); cancelAnimationFrame(raf); };
  }, []);

  // 3D tilt for the hero visual card — tracks the pointer via CSS vars,
  // no re-renders. Touch devices get a separate finger-driven version
  // below (they never fire mousemove).
  const tiltRef = useRef<HTMLDivElement>(null);
  const [touchTilting, setTouchTilting] = useState(false);
  const noHover = typeof window !== 'undefined' && window.matchMedia?.('(hover: none)').matches;
  useEffect(() => {
    const el = tiltRef.current;
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    function onMove(e: MouseEvent) {
      const r = el!.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el!.style.setProperty('--rx', (py * -8).toFixed(2) + 'deg');
      el!.style.setProperty('--ry', (px * 10).toFixed(2) + 'deg');
    }
    function onLeave() {
      el!.style.setProperty('--rx', '0deg');
      el!.style.setProperty('--ry', '0deg');
    }
    el.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', onLeave);

    // Touch: a finger dragging across the card tilts it the same way the
    // mouse does. While actively touching, the idle auto-tilt CSS loop is
    // paused (via touchTilting → the .lp-idle-tilt class below) so the two
    // motions never fight; a short settle timeout after touchend eases it
    // back to flat before the idle loop resumes.
    let settleTimer: ReturnType<typeof setTimeout>;
    function onTouchStart() {
      clearTimeout(settleTimer);
      setTouchTilting(true);
    }
    function onTouchMove(e: TouchEvent) {
      const touch = e.touches[0];
      if (!touch) return;
      const r = el!.getBoundingClientRect();
      const px = (touch.clientX - r.left) / r.width - 0.5;
      const py = (touch.clientY - r.top) / r.height - 0.5;
      el!.style.setProperty('--rx', (py * -7).toFixed(2) + 'deg');
      el!.style.setProperty('--ry', (px * 9).toFixed(2) + 'deg');
    }
    function onTouchEnd() {
      el!.style.setProperty('--rx', '0deg');
      el!.style.setProperty('--ry', '0deg');
      settleTimer = setTimeout(() => setTouchTilting(false), 350);
    }
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener('mousemove', onMove);
      el.removeEventListener('mouseleave', onLeave);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      clearTimeout(settleTimer);
    };
  }, []);

  const FEATURES = [
    {
      color: '#00D68F', bg: 'rgba(0,214,143,.12)',
      icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>),
      title: t('features.f1.title'), desc: t('features.f1.desc'),
    },
    {
      color: '#3B82F6', bg: 'rgba(59,130,246,.12)',
      icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>),
      title: t('features.f2.title'), desc: t('features.f2.desc'),
    },
    {
      color: '#8B5CF6', bg: 'rgba(139,92,246,.12)',
      icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>),
      title: t('features.f3.title'), desc: t('features.f3.desc'),
    },
    {
      color: '#F59E0B', bg: 'rgba(245,158,11,.12)',
      icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>),
      title: t('features.f4.title'), desc: t('features.f4.desc'),
    },
    {
      color: '#EC4899', bg: 'rgba(236,72,153,.12)',
      icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>),
      title: t('features.f5.title'), desc: t('features.f5.desc'),
    },
    {
      color: '#10B981', bg: 'rgba(16,185,129,.12)',
      icon: (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>),
      title: t('features.f6.title'), desc: t('features.f6.desc'),
    },
  ];

  const STEPS = [
    { num: '01', title: t('how.s1.title'), desc: t('how.s1.desc'), color: '#00D68F' },
    { num: '02', title: t('how.s2.title'), desc: t('how.s2.desc'), color: '#3B82F6' },
    { num: '03', title: t('how.s3.title'), desc: t('how.s3.desc'), color: '#8B5CF6' },
    { num: '04', title: t('how.s4.title'), desc: t('how.s4.desc'), color: '#F59E0B' },
  ];

  const FAQS = [
    { q: t('faq.q1'), a: t('faq.a1') },
    { q: t('faq.q2'), a: t('faq.a2') },
    { q: t('faq.q3'), a: t('faq.a3') },
    { q: t('faq.q4'), a: t('faq.a4') },
    { q: t('faq.q5'), a: t('faq.a5') },
    { q: t('faq.q6'), a: t('faq.a6') },
  ];

  return (
    <div className="lp-root" dir={dir} lang={lang}>
      <MarketBackground />
      {/* ── Background ── */}
      <div className="lp-bg" aria-hidden/>
      <div className="lp-grid" aria-hidden/>
      <div className="grain-overlay" aria-hidden/>

      {/* ══════════════════════════════════
          NAV
      ══════════════════════════════════ */}
      <nav className={`lp-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="lp-nav-logo">
          <OxierLogo size={19} />
        </div>

        {/* Desktop links */}
        <div className="lp-nav-links">
          <a href="#about" className="lp-nav-link">{t('nav.about')}</a>
          <a href="#features" className="lp-nav-link">{t('nav.features')}</a>
          <a href="#how" className="lp-nav-link">{t('nav.how')}</a>
          <a href="#faq" className="lp-nav-link">{t('nav.faq')}</a>
        </div>

        <div className="lp-nav-actions">
          <LanguageSwitcher/>
          <a
            href="https://oxieraffiliate.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="lp-nav-affiliate"
          >
            {t('nav.affiliate')}
          </a>
          <button className="lp-nav-login" onClick={() => go(setScreen, 'login')}>{t('nav.login')}</button>
          <button className="lp-nav-register" onClick={() => go(setScreen, 'register')}>{t('nav.register')}</button>
        </div>

        {/* Mobile hamburger */}
        <button className="lp-hamburger" onClick={() => setMenuOpen(v => !v)} aria-label={t('nav.menu')}>
          <span className={`lp-ham-line${menuOpen ? ' open' : ''}`}/>
          <span className={`lp-ham-line${menuOpen ? ' open' : ''}`}/>
          <span className={`lp-ham-line${menuOpen ? ' open' : ''}`}/>
        </button>
      </nav>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="lp-mobile-menu">
          <a href="#about"    className="lp-mm-link" onClick={() => setMenuOpen(false)}>{t('nav.about')}</a>
          <a href="#features" className="lp-mm-link" onClick={() => setMenuOpen(false)}>{t('nav.features')}</a>
          <a href="#how"      className="lp-mm-link" onClick={() => setMenuOpen(false)}>{t('nav.how')}</a>
          <a href="#faq"      className="lp-mm-link" onClick={() => setMenuOpen(false)}>{t('nav.faq')}</a>
          <a
            href="https://oxieraffiliate.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="lp-mm-link lp-mm-affiliate"
            onClick={() => setMenuOpen(false)}
          >
            {t('nav.affiliate')}
          </a>
          <LanguageSwitcher className="mobile"/>
          <div className="lp-mm-btns">
            <button className="lp-nav-login full" onClick={() => { setMenuOpen(false); go(setScreen, 'login'); }}>{t('nav.login')}</button>
            <button className="lp-nav-register full" onClick={() => { setMenuOpen(false); go(setScreen, 'register'); }}>{t('nav.register')}</button>
          </div>
        </div>
      )}

      <TickerMarquee items={liveTicks}/>

      {/* ══════════════════════════════════
          HERO
      ══════════════════════════════════ */}
      <section className="lp-hero">
        <div className="lp-hero-content">
          <div className="lp-hero-badge">
            <span className="lp-badge-dot"/>
            {t('hero.badge')}
          </div>

          <h1 className="lp-hero-h1">
            {t('hero.h1a')}<br/>
            <span className="lp-accent lp-accent-shimmer">{t('hero.h1b')}</span>
          </h1>

          <p className="lp-hero-sub">{t('hero.sub')}</p>

          <div className="lp-hero-btns">
            <button className="lp-btn-primary" onClick={() => go(setScreen, 'register')}>
              {t('hero.cta1')}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>
            <button className="lp-btn-ghost" onClick={() => go(setScreen, 'login')}>
              {t('hero.cta2')}
            </button>
          </div>

          <div className="lp-hero-trust">
            <div className="lp-trust-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o-500)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {t('hero.trust1')}
            </div>
            <div className="lp-trust-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o-500)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {t('hero.trust2')}
            </div>
            <div className="lp-trust-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o-500)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {t('hero.trust3')}
            </div>
          </div>

          <AndroidDownloadButton large/>
        </div>

        <div
          className="lp-hero-visual-wrap"
          style={{
            transform: `translateY(${heroScroll * -26}px) scale(${1 - heroScroll * 0.05})`,
            opacity: 1 - heroScroll * 0.55,
          }}
        >
        <div className="lp-hero-visual lp-tilt" ref={tiltRef}>
          <div className={`lp-tilt-inner${noHover && !touchTilting ? ' lp-idle-tilt' : ''}`}>
            <HeroChart/>
            <div className="lp-hero-ticker-row">
              {liveTicks.slice(0, 4).map((tk, i) => (
                <div key={i} className="lp-ticker">
                  <span className="lp-ticker-name">{tk.n}</span>
                  <span className="lp-ticker-price">{tk.p}</span>
                  <span className={`lp-ticker-change ${tk.up ? 'up' : 'down'}`}>{tk.c}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="lp-tilt-badge lp-tilt-badge-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--o-500)" strokeWidth="2.4"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
            Live execution
          </div>
          <div className="lp-tilt-badge lp-tilt-badge-2">91%+ avg payout</div>
        </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          TRUST BAR
      ══════════════════════════════════ */}
      <div ref={trustReveal.ref} className={`lp-trustbar${trustReveal.visible ? ' revealed' : ''}`}>
        {[
          { val: 50000,  suffix: '+', label: t('trust.traders') },
          { val: 52,     suffix: '+', label: t('trust.assets') },
          { val: 91,     suffix: '%+', label: t('trust.payout') },
          { val: 2019,   suffix: '',  label: t('trust.founded') },
        ].map((s, i) => (
          <div key={i} className="lp-trustbar-item">
            <div className="lp-trustbar-val">
              {trustReveal.visible ? <Counter to={s.val} suffix={s.suffix}/> : '—'}
            </div>
            <div className="lp-trustbar-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ══════════════════════════════════
          ABOUT
      ══════════════════════════════════ */}
      <section id="about" ref={aboutReveal.ref} className={`lp-section lp-about${aboutReveal.visible ? ' revealed' : ''}`}>
        <div className="lp-section-inner">
          <div className="lp-about-text">
            <span className="lp-label-chip blue">{t('about.chip')}</span>
            <h2 className="lp-section-h2">{t('about.h2')}</h2>
            <p className="lp-section-p">{t('about.p1')}</p>
            <p className="lp-section-p">{t('about.p2')}</p>
            <div className="lp-cert-row">
              {[
                { icon: (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>), label: t('about.cert1') },
                { icon: (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>), label: t('about.cert2') },
                { icon: (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/></svg>), label: t('about.cert3') },
                { icon: (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>), label: t('about.cert4') },
                { icon: (<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg>), label: t('about.cert5') },
              ].map((c, i) => (
                <div key={i} className="lp-cert-badge">{c.icon} {c.label}</div>
              ))}
            </div>
          </div>

          <div className="lp-about-cards">
            {[
              { val: '99.9%', label: t('about.stat1'), color: '#00D68F' },
              { val: '<100ms', label: t('about.stat2'), color: '#F7931A' },
              { val: '24/7', label: t('about.stat3'), color: '#8B5CF6' },
              { val: '$1M+', label: t('about.stat4'), color: '#F59E0B' },
            ].map((c, i) => (
              <div key={i} className="lp-about-card" style={{ '--accent': c.color } as any}>
                <div className="lp-about-card-val" style={{ color: c.color }}>{c.val}</div>
                <div className="lp-about-card-lbl">{c.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          FEATURES
      ══════════════════════════════════ */}
      <section id="features" ref={featReveal.ref} className={`lp-section lp-features-sec${featReveal.visible ? ' revealed' : ''}`}>
        <div className="lp-section-header">
          <span className="lp-label-chip green">{t('features.chip')}</span>
          <h2 className="lp-section-h2">{t('features.h2')}</h2>
          <p className="lp-section-sub">{t('features.sub')}</p>
        </div>
        <div className="lp-features-grid">
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="lp-feature-card"
              style={{ animationDelay: `${i * 0.08}s` }}
            >
              <div className="lp-feature-ico" style={{ background: f.bg, color: f.color }}>
                {f.icon}
              </div>
              <h3 className="lp-feature-title">{f.title}</h3>
              <p className="lp-feature-desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════
          HOW IT WORKS
      ══════════════════════════════════ */}
      <section id="how" ref={stepsReveal.ref} className={`lp-section lp-how${stepsReveal.visible ? ' revealed' : ''}`}>
        <div className="lp-section-header">
          <span className="lp-label-chip purple">{t('how.chip')}</span>
          <h2 className="lp-section-h2">{t('how.h2')}</h2>
          <p className="lp-section-sub">{t('how.sub')}</p>
        </div>
        <div className="lp-steps">
          {STEPS.map((s, i) => (
            <div key={i} className="lp-step" style={{ animationDelay: `${i * 0.12}s` }}>
              <div className="lp-step-num" style={{ color: s.color, borderColor: s.color, boxShadow: `0 0 20px ${s.color}22` }}>
                {s.num}
              </div>
              {i < STEPS.length - 1 && <div className="lp-step-connector"/>}
              <h3 className="lp-step-title">{s.title}</h3>
              <p className="lp-step-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════════════════════════════
          PLATFORM PREVIEW
      ══════════════════════════════════ */}
      <section ref={previewReveal.ref} className={`lp-section lp-preview-sec${previewReveal.visible ? ' revealed' : ''}`}>
        <div className="lp-preview-inner">
          <div className="lp-preview-text">
            <span className="lp-label-chip green">{t('preview.chip')}</span>
            <h2 className="lp-section-h2">{t('preview.h2')}</h2>
            <p className="lp-section-p">{t('preview.p')}</p>
            <ul className="lp-preview-list">
              {[t('preview.li1'), t('preview.li2'), t('preview.li3'), t('preview.li4')].map((item, i) => (
                <li key={i} className="lp-preview-li">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00D68F" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  {item}
                </li>
              ))}
            </ul>
            <button className="lp-btn-primary" style={{ marginTop: 24 }} onClick={() => go(setScreen, 'register')}>
              {t('preview.cta')}
            </button>
          </div>
          <div className="lp-preview-mockup">
            <div className="lp-preview-glow" aria-hidden/>
            <PlatformPreview progress={previewProgress}/>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════
          FAQ
      ══════════════════════════════════ */}
      <section id="faq" ref={faqReveal.ref} className={`lp-section lp-faq-sec${faqReveal.visible ? ' revealed' : ''}`}>
        <div className="lp-section-header">
          <span className="lp-label-chip yellow">{t('faq.chip')}</span>
          <h2 className="lp-section-h2">{t('faq.h2')}</h2>
          <p className="lp-section-sub">{t('faq.sub')}</p>
        </div>
        <div className="lp-faq-list">
          {FAQS.map((f, i) => <FAQItem key={i} q={f.q} a={f.a}/>)}
        </div>
      </section>

      {/* ══════════════════════════════════
          FINAL CTA
      ══════════════════════════════════ */}
      <section ref={ctaReveal.ref} className={`lp-final-cta${ctaReveal.visible ? ' revealed' : ''}`}>
        <div className="lp-final-glow" aria-hidden/>
        <div className="lp-final-inner">
          <h2 className="lp-final-h2">{t('cta.h2')}</h2>
          <p className="lp-final-p">{t('cta.p')}</p>
          <div className="lp-final-btns">
            <button className="lp-btn-primary large" onClick={() => go(setScreen, 'register')}>
              {t('cta.btn1')}
            </button>
            <button className="lp-btn-ghost" onClick={() => go(setScreen, 'login')}>
              {t('cta.btn2')}
            </button>
          </div>
          <div style={{ marginTop: 18 }}>
            <AndroidDownloadButton/>
          </div>
          <p className="lp-final-note">{t('cta.note')}</p>
        </div>
      </section>

      {/* ══════════════════════════════════
          FOOTER
      ══════════════════════════════════ */}
      <footer className="lp-footer">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <div className="lp-footer-logo">
              <OxierLogo size={16} />
            </div>
            <p className="lp-footer-tagline">{t('footer.tagline')}</p>
            <div className="lp-footer-socials">
              {/* Telegram */}
              <a href="#" className="lp-social-btn" aria-label="Telegram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221l-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12l-6.871 4.326-2.962-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.833.941z"/></svg>
              </a>
              {/* Twitter / X */}
              <a href="#" className="lp-social-btn" aria-label="Twitter">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              </a>
              {/* Instagram */}
              <a href="#" className="lp-social-btn" aria-label="Instagram">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              </a>
            </div>
          </div>

          <div className="lp-footer-links-group">
            <h4 className="lp-footer-links-title">{t('footer.platform')}</h4>
            <a href="#" className="lp-footer-link" onClick={() => go(setScreen, 'register')}>{t('nav.register')}</a>
            <a href="#" className="lp-footer-link" onClick={() => go(setScreen, 'login')}>{t('nav.login')}</a>
            <a href="#features" className="lp-footer-link">{t('nav.features')}</a>
            <a href="#how" className="lp-footer-link">{t('nav.how')}</a>
            <a href="https://oxieraffiliate.com/" target="_blank" rel="noopener noreferrer" className="lp-footer-link">Affiliate Program</a>
          </div>

          <div className="lp-footer-links-group">
            <h4 className="lp-footer-links-title">{t('footer.company')}</h4>
            <a href="#about" className="lp-footer-link">{t('footer.about')}</a>
            <a href="#faq" className="lp-footer-link">{t('footer.faq')}</a>
            <a href="#" className="lp-footer-link">{t('footer.blog')}</a>
            <a href="#" className="lp-footer-link">{t('footer.contact')}</a>
          </div>

          <div className="lp-footer-links-group">
            <h4 className="lp-footer-links-title">{t('footer.legal')}</h4>
            <a href="#" className="lp-footer-link">{t('footer.privacy')}</a>
            <a href="#" className="lp-footer-link">{t('footer.terms')}</a>
            <a href="#" className="lp-footer-link">{t('footer.aml')}</a>
            <a href="#" className="lp-footer-link">{t('footer.risk')}</a>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <p>{t('footer.rights')}</p>
          <a
            href="https://oxieraffiliate.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="lp-footer-link"
            style={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          >
            Affiliate Program
          </a>
          <p className="lp-footer-risk">{t('footer.riskNote')}</p>
        </div>
      </footer>
    </div>
  );
}
