import { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { buildBinanceMarkets } from '../lib/markets';
import OxierLogo from '../components/OxierLogo';
import MarketBackground from '../components/MarketBackground';

export default function SplashScreen() {
  const setScreen        = useStore(s => s.setScreen);
  const setMarkets       = useStore(s => s.setMarkets);
  const setCurrentMarket = useStore(s => s.setCurrentMarket);
  const userInfo         = useStore(s => s.userInfo);
  const [progress, setProgress] = useState(0);
  const [status, setStatus]     = useState('Connecting to markets...');

  useEffect(() => {
    let p = 0;
    const iv = setInterval(() => {
      p = Math.min(p + Math.random() * 8 + 3, 88);
      setProgress(p);
    }, 100);

    async function load() {
      try {
        setStatus('Loading live Binance pairs...');
        // Payout comes straight from the backend (/api/market-data/live-markets),
        // which reads it from MarketSetting — the same value used to settle
        // trades — so every user sees the exact same percentage per pair.
        const markets = await buildBinanceMarkets();

        setStatus('Preparing platform...');
        setProgress(95);
        setMarkets(markets);
        setCurrentMarket(markets[0]);
        clearInterval(iv);
        await new Promise(r => setTimeout(r, 300));
        setProgress(100);
        await new Promise(r => setTimeout(r, 400));
        setScreen(userInfo ? 'trading' : 'landing');
      } catch {
        setStatus('Using demo data...');
        const markets = await buildBinanceMarkets();
        setMarkets(markets);
        setCurrentMarket(markets[0]);
        clearInterval(iv);
        setProgress(100);
        await new Promise(r => setTimeout(r, 300));
        setScreen(userInfo ? 'trading' : 'landing');
      }
    }

    load();
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="splash">
      <MarketBackground scrollRoot="" subtle />
      <div className="splash-bg" />
      <div className="splash-grid" />
      <div className="grain-overlay" />

      {/* Animated particle dots */}
      <div className="splash-particles">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="splash-particle" style={{ animationDelay: `${i * 0.2}s`, left: `${10 + i * 7}%` }} />
        ))}
      </div>

      <div className="splash-mark">
        <span className="splash-mark-ring" />
        <span className="splash-mark-ring r2" />
        <span className="splash-mark-core">X</span>
      </div>

      <div className="splash-logo-wrap">
        <OxierLogo size={30} className="splash-logo-wordmark" />
        <div className="splash-tagline">Professional Trading Platform</div>
      </div>

      <div className="splash-progress-wrap">
        <div className="splash-progress-bar">
          <div className="splash-progress-fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="splash-status-row">
          <div className="splash-status">{status}</div>
          <div className="splash-status-pct">{Math.round(progress)}%</div>
        </div>
      </div>

      <div className="splash-version">v3.0.0 · Powered by Binance</div>
    </div>
  );
}
