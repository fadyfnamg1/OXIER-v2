import { useStore } from '../lib/store';
import { playClick, resumeAudio } from '../lib/sounds';
import { useI18n } from '../lib/i18n';

const NAV = [
  {
    id: 'chart', labelKey: 'app.nav.chart',
    icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="4" width="4" height="16" rx="1"/>
        <rect x="10" y="8" width="4" height="12" rx="1"/>
        <rect x="18" y="2" width="4" height="20" rx="1"/>
      </svg>
    ),
  },
  {
    id: 'history', labelKey: 'app.nav.history',
    icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
      </svg>
    ),
  },
  {
    id: 'signals', labelKey: 'app.nav.signals',
    icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 20h.01M7 20v-4M12 20v-8M17 20V8M22 4v16"/>
      </svg>
    ),
  },
  {
    id: 'indicators', labelKey: 'app.nav.indicators',
    icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/>
        <line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/>
        <line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/>
        <line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/>
      </svg>
    ),
  },
  {
    id: 'panel', labelKey: 'app.nav.account',
    icon: () => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>
    ),
  },
];

export default function NavBar() {
  const overlay   = useStore(s => s.overlay);
  const setOverlay = useStore(s => s.setOverlay);
  const trades    = useStore(s => s.trades);
  const openTrades = trades.filter(t => !t.resolved);
  const { t } = useI18n();

  function navPress(id: string) {
    resumeAudio(); playClick();
    if (id === 'chart') setOverlay('none');
    else setOverlay(id as any);
  }

  return (
    <nav className="navbar">
      {NAV.map(n => {
        const active = n.id === 'chart' ? overlay === 'none' : overlay === n.id;
        return (
          <div key={n.id} className={`nav-item ${active ? 'active' : ''}`} onClick={() => navPress(n.id)}>
            <span className="nav-icon">{n.icon()}</span>
            <span className="nav-label">{t(n.labelKey)}</span>
            {n.id === 'history' && openTrades.length > 0 && (
              <span className="nav-badge">{openTrades.length}</span>
            )}
          </div>
        );
      })}
    </nav>
  );
}
