import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { playClick, resumeAudio } from '../../lib/sounds';
import LanguageSwitcher from '../LanguageSwitcher';
import { useI18n } from '../../lib/i18n';
import { BACKEND } from '../../lib/api';

const DEFAULT_SUPPORT_URL = 'https://t.me/oxiersupport';

function IconDeposit() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>;
}
function IconWithdraw() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>;
}
function IconHistory() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function IconProfile() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>;
}
function IconSignals() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>;
}
function IconEvents() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>;
}
function IconSupport() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3v5zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3v5z"/></svg>;
}
function IconTrophy() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 01-10 0V4z"/><path d="M17 5h3a2 2 0 01-2 4h-1M7 5H4a2 2 0 002 4h1"/></svg>;
}
function IconLogout() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>;
}

export default function PanelOverlay() {
  const { t } = useI18n();
  const setOverlay  = useStore(s => s.setOverlay);
  const userInfo    = useStore(s => s.userInfo);
  const setUserInfo = useStore(s => s.setUserInfo);
  const setScreen   = useStore(s => s.setScreen);
  const demoBalance = useStore(s => s.demoBalance);
  const realBalance = useStore(s => s.realBalance);
  const trades      = useStore(s => s.trades);
  const showConfirm = useStore(s => s.showConfirm);
  const theme       = useStore(s => s.theme);
  const setTheme    = useStore(s => s.setTheme);
  const setTransfersTab = useStore(s => s.setTransfersTab);

  const resolved    = trades.filter(t => t.resolved);
  const wins        = resolved.filter(t => t.won);
  const totalProfit = wins.reduce((a, t) => a + (t.profit || 0), 0);
  const winRate     = resolved.length ? ((wins.length / resolved.length) * 100).toFixed(0) : '0';
  const name        = userInfo?.name || 'Trader';
  const email       = userInfo?.email || '';
  const initials    = name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  // Stable, deterministic pseudo-UID derived from the account email so it
  // stays the same across sessions (purely a display convenience — not a
  // backend-issued identifier).
  const uid = (() => {
    let h = 0;
    for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
    return String(100000000 + (h % 900000000));
  })();
  const [supportUrl, setSupportUrl] = useState(DEFAULT_SUPPORT_URL);
  useEffect(() => {
    fetch(`${BACKEND}/api/settings`)
      .then(r => r.json())
      .then(data => { if (data?.supportTelegramUrl) setSupportUrl(data.supportTelegramUrl); })
      .catch(() => {});
  }, []);

  const [copied, setCopied] = useState(false);
  function copyUid() {
    navigator.clipboard?.writeText(uid).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function go(ov: string) { resumeAudio(); playClick(); setOverlay(ov as any); }
  function goWithdraw() { resumeAudio(); playClick(); setTransfersTab('withdraw'); setOverlay('transfers'); }
  function logout() {
    showConfirm(t('app.panel.signOut'), 'Are you sure you want to sign out?', () => {
      setUserInfo(null); setScreen('landing');
    });
  }

  const MENU: { icon: JSX.Element; color: string; bg: string; title: string; sub: string; action: () => void; badge?: string }[] = [
    { icon: <IconDeposit />,    color: '#00D68F', bg: 'rgba(0,214,143,.12)',  title: t('app.panel.deposit'),    sub: t('app.panel.depositSub'),    action: () => go('deposit') },
    { icon: <IconWithdraw />,   color: '#3B82F6', bg: 'rgba(59,130,246,.12)', title: t('app.panel.withdrawal'), sub: t('app.panel.withdrawalSub'), action: goWithdraw },
    { icon: <IconHistory />,    color: '#F59E0B', bg: 'rgba(245,158,11,.12)', title: t('app.panel.history'),    sub: t('app.panel.historySub'),    action: () => go('history') },
    { icon: <IconProfile />,    color: '#8B5CF6', bg: 'rgba(139,92,246,.12)', title: t('app.panel.profile'),    sub: t('app.panel.profileSub'),    action: () => go('profile') },
    { icon: <IconSignals />,    color: '#EC4899', bg: 'rgba(236,72,153,.12)', title: t('app.panel.signals'),    sub: t('app.panel.signalsSub'),    action: () => go('signals'), badge: 'LIVE' },
    { icon: <IconTrophy />,     color: '#A855F7', bg: 'rgba(168,85,247,.12)', title: 'Challenge',               sub: 'Win up to $1,000',           action: () => go('challenge') },
    { icon: <IconEvents />,     color: '#F97316', bg: 'rgba(249,115,22,.12)', title: t('app.panel.events'),     sub: t('app.panel.eventsSub'),     action: () => go('events') },
    { icon: <IconSupport />,    color: '#10B981', bg: 'rgba(16,185,129,.12)', title: t('app.panel.support'),    sub: t('app.panel.supportSub'),    action: () => window.open(supportUrl, '_blank', 'noopener,noreferrer') },
  ];

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '92vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />

        {/* Header */}
        <div className="overlay-header">
          <span className="overlay-title">{t('app.panel.title')}</span>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="overlay-body">
          {/* ── Avatar + name + UID ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, paddingTop: 4 }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%', flexShrink: 0,
              background: 'conic-gradient(from 200deg, #00D68F 0%, #00D68F 35%, #F7931A 75%, #00D68F 100%)',
              padding: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 20px rgba(247,147,26,.25), 0 0 20px rgba(0,214,143,.2)',
            }}>
              <div style={{
                width: '100%', height: '100%', borderRadius: '50%',
                background: 'var(--bg1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 21, fontWeight: 900, color: '#fff',
                letterSpacing: -1, userSelect: 'none',
              }}>{initials}</div>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--t1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{name}</div>
              <div style={{ fontSize: 11.5, color: 'var(--t4)', fontWeight: 500, marginTop: 1 }}>{email}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 5 }}>
                <span style={{ fontSize: 11, color: 'var(--t4)', fontFamily: 'JetBrains Mono' }}>UID: {uid}</span>
                <button
                  onClick={copyUid}
                  style={{ background: 'none', border: 'none', padding: 2, cursor: 'pointer', color: copied ? 'var(--g0)' : 'var(--t4)', display: 'flex' }}
                >
                  {copied
                    ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                  }
                </button>
              </div>
              <span className="panel-verified-chip">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                Verified
              </span>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 0, marginBottom: 20, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', overflow: 'hidden', width: '100%' }}>
            {[
              { val: resolved.length, lbl: t('app.panel.trades') },
              { val: `${winRate}%`,   lbl: t('app.panel.winRate') },
              { val: `${totalProfit >= 0 ? '+' : ''}$${Math.abs(totalProfit).toFixed(0)}`, lbl: t('app.panel.pnl'), color: totalProfit >= 0 ? 'var(--g0)' : 'var(--red)' },
            ].map((s, i) => (
              <div key={i} style={{
                flex: 1, padding: '12px 4px', textAlign: 'center',
                borderRight: i < 2 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: (s as any).color || 'var(--t1)', fontFamily: 'JetBrains Mono' }}>{s.val}</div>
                <div style={{ fontSize: 9, color: 'var(--t4)', fontWeight: 600, marginTop: 3, textTransform: 'uppercase', letterSpacing: .5 }}>{s.lbl}</div>
              </div>
            ))}
          </div>

          {/* ── Balance cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
            <div style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,.1) 0%, rgba(245,158,11,.05) 100%)',
              border: '1px solid rgba(245,158,11,.2)', borderRadius: 'var(--r2)', padding: '14px 16px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#F59E0B', letterSpacing: .5, marginBottom: 4, textTransform: 'uppercase' }}>{t('app.panel.demoBalance')}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: '#F59E0B', fontFamily: 'JetBrains Mono' }}>${demoBalance.toFixed(2)}</div>
            </div>
            <div style={{
              background: 'linear-gradient(135deg, rgba(0,214,143,.1) 0%, rgba(0,214,143,.05) 100%)',
              border: '1px solid rgba(0,214,143,.2)', borderRadius: 'var(--r2)', padding: '14px 16px',
            }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--g0)', letterSpacing: .5, marginBottom: 4, textTransform: 'uppercase' }}>{t('app.panel.realBalance')}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--g0)', fontFamily: 'JetBrains Mono' }}>${realBalance.toFixed(2)}</div>
            </div>
          </div>

          {/* ── Menu — quick-tile grid ── */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t4)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>{t('app.panel.quickActions')}</div>
          <div className="panel-tile-grid">
            {MENU.map((item, i) => (
              <div key={i} className="panel-tile" onClick={item.action} style={{ animationDelay: `${i * 0.04}s` }}>
                <div className="panel-tile-ico" style={{ background: item.bg, color: item.color }}>{item.icon}</div>
                <div className="panel-tile-text">
                  <div className="panel-tile-title-row">
                    <span className="panel-tile-title">{item.title}</span>
                    {item.badge && <span className="panel-tile-badge">{item.badge}</span>}
                  </div>
                  <div className="panel-tile-sub">{item.sub}</div>
                </div>
                <svg className="panel-tile-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
              </div>
            ))}
          </div>

          {/* ── Preferences ── */}
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--t4)', letterSpacing: 1, textTransform: 'uppercase', margin: '18px 0 8px' }}>{t('app.panel.preferences')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)',
              padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(139,92,246,.12)', color: '#8B5CF6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="2" y1="12" x2="22" y2="12"/>
                    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
                  </svg>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)' }}>{t('app.panel.language')}</div>
              </div>
              <LanguageSwitcher className="panel" />
            </div>
          </div>

          {/* ── Logout ── */}
          <button
            onClick={logout}
            style={{
              width: '100%', marginTop: 8, padding: '13px',
              background: 'rgba(255,58,78,.07)', border: '1px solid rgba(255,58,78,.18)',
              borderRadius: 'var(--r2)', color: 'var(--red)',
              fontWeight: 700, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'inherit', transition: 'background .2s',
            }}
          >
            <IconLogout /> {t('app.panel.signOut')}
          </button>
        </div>
      </div>
    </div>
  );
}
