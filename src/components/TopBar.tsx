import { useState, useRef, useEffect } from 'react';
import { useStore } from '../lib/store';
import { playClick, resumeAudio } from '../lib/sounds';
import { apiFetch } from '../lib/api';
import { useI18n } from '../lib/i18n';
import OxierLogo from './OxierLogo';

export default function TopBar() {
  const walType       = useStore(s => s.walType);
  const setWalType    = useStore(s => s.setWalType);
  const demoBalance   = useStore(s => s.demoBalance);
  const realBalance   = useStore(s => s.realBalance);
  const bonusBalance  = useStore(s => s.bonusBalance);
  const activeChallenge = useStore(s => s.activeChallenge);
  const setOverlay    = useStore(s => s.setOverlay);
  const soundEnabled  = useStore(s => s.soundEnabled);
  const setSoundEnabled = useStore(s => s.setSoundEnabled);
  const balanceHidden = useStore(s => s.balanceHidden);
  const setBalanceHidden = useStore(s => s.setBalanceHidden);

  const [dropOpen, setDropOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();

  // Mirrors the fix in store.ts's balance(): the real wallet's usable total
  // is realBalance + bonusBalance, since the backend spends real funds
  // first and only draws on bonus once real runs out. Showing realBalance
  // alone here made bonus funds look like they'd vanished.
  const bal = walType === 'demo' ? demoBalance : walType === 'challenge' ? (activeChallenge?.challengeBalance ?? 0) : (realBalance + bonusBalance);

  // When the person hides their balance, show the account type word
  // ("DEMO"/"REAL"/"CHALLENGE") instead of the number, everywhere a balance
  // would otherwise appear.
  function displayBal(amount: number, _type: 'demo' | 'real' | 'challenge') {
    if (!balanceHidden) return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return '••••••';
  }

  useEffect(() => {
    function close(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setDropOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  function switchWallet(type: 'demo' | 'real' | 'challenge') {
    resumeAudio(); playClick();
    setWalType(type); setDropOpen(false);
    // Tell the backend too — it's the source of truth for which balance a
    // trade actually debits (this matters most for "challenge", where real
    // money is on the line).
    apiFetch('/api/trade/switch-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletType: type }),
    }).catch(() => {});
  }

  return (
    <div className="topbar">
      {/* Logo — OXIER wordmark, orange X, no icon mark */}
      <div className="tb-logo">
        <OxierLogo size={16} />
      </div>

      <div className="tb-center" />

      <div className="tb-right">
        {/* Wallet selector */}
        <div style={{ position: 'relative' }} ref={dropRef}>
          <div
            className={`tb-wallet ${dropOpen ? 'open' : ''}`}
            onClick={() => { resumeAudio(); playClick(); setDropOpen(v => !v); }}
          >
            <div className={`tb-wallet-dot ${balanceHidden ? 'hidden' : walType}`} />
            <div style={{ display: 'flex', alignItems: 'baseline' }}>
              <span className="tb-wallet-label">
                {balanceHidden ? 'Balance' : (walType === 'demo' ? t('app.wallet.demo') : walType === 'challenge' ? 'Challenge' : t('app.wallet.real'))}
              </span>
              <span className="tb-balance">
                {displayBal(bal, walType)}
              </span>
            </div>
            <svg className="tb-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </div>

          {dropOpen && (
            <div className="acc-drop">
              <div className={`acc-opt ${walType === 'demo' ? 'active' : ''}`} onClick={() => switchWallet('demo')}>
                <div className="acc-opt-dot demo" />
                <div style={{ flex: 1 }}>
                  <div className="acc-opt-name">Demo Account</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)' }}>Practice trading</div>
                </div>
                <span className="acc-opt-bal">{displayBal(demoBalance, 'demo')}</span>
              </div>
              <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />
              <div className={`acc-opt ${walType === 'real' ? 'active' : ''}`} onClick={() => switchWallet('real')}>
                <div className="acc-opt-dot real" />
                <div style={{ flex: 1 }}>
                  <div className="acc-opt-name">Real Account</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)' }}>
                    {bonusBalance > 0
                      ? `${displayBal(realBalance, 'real')} real + ${displayBal(bonusBalance, 'real')} bonus`
                      : 'Live trading'}
                  </div>
                </div>
                <span className="acc-opt-bal">{displayBal(realBalance + bonusBalance, 'real')}</span>
              </div>
              {activeChallenge && activeChallenge.status === 'active' && (
                <>
                  <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />
                  <div className={`acc-opt ${walType === 'challenge' ? 'active' : ''}`} onClick={() => switchWallet('challenge')}>
                    <div className="acc-opt-dot" style={{ background: '#A855F7', boxShadow: '0 0 6px #A855F7' }} />
                    <div style={{ flex: 1 }}>
                      <div className="acc-opt-name">Challenge Account</div>
                      <div style={{ fontSize: 10, color: 'var(--t4)' }}>Day {activeChallenge.currentDay || 1} of {activeChallenge.durationDays}</div>
                    </div>
                    <span className="acc-opt-bal">{displayBal(activeChallenge.challengeBalance, 'challenge')}</span>
                  </div>
                </>
              )}
              <div style={{ height: 1, background: 'var(--border)', margin: '0 12px' }} />
              <div className="acc-opt" onClick={() => { setOverlay('deposit'); setDropOpen(false); }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--g0)', boxShadow: '0 0 6px var(--g0)' }} />
                <div style={{ flex: 1 }}>
                  <div className="acc-opt-name" style={{ color: 'var(--g0)' }}>Deposit Funds</div>
                  <div style={{ fontSize: 10, color: 'var(--t4)' }}>Add balance to trade</div>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--g0)" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </div>
            </div>
          )}
        </div>

        {/* Balance show/hide toggle */}
        <button
          className={`tb-icon-btn ${balanceHidden ? 'active' : ''}`}
          onClick={() => { resumeAudio(); playClick(); setBalanceHidden(!balanceHidden); }}
          title={balanceHidden ? 'Show balance' : 'Hide balance'}
        >
          {balanceHidden
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a20.4 20.4 0 015.06-6.06M9.9 4.24A10.94 10.94 0 0112 4c7 0 11 8 11 8a20.3 20.3 0 01-2.16 3.19M14.12 14.12a3 3 0 11-4.24-4.24"/>
                <line x1="1" y1="1" x2="23" y2="23"/>
              </svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
          }
        </button>

        {/* Sound toggle */}
        <button
          className={`tb-icon-btn ${soundEnabled ? 'active' : ''}`}
          onClick={() => { resumeAudio(); setSoundEnabled(!soundEnabled); }}
          title="Toggle Sound"
        >
          {soundEnabled
            ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>
              </svg>
            : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/>
                <line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
          }
        </button>

      </div>
    </div>
  );
}
