import { useState, useRef, useEffect } from 'react';
import { useI18n, LANGUAGES } from '../lib/i18n';

export default function LanguageSwitcher({ className = '' }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  return (
    <div className={`lang-switcher ${className}`} ref={ref}>
      <button
        type="button"
        className="lang-switcher-btn"
        onClick={() => setOpen(v => !v)}
        aria-label={t('lang.choose')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
        </svg>
        <span>{current.native}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className={`lang-caret${open ? ' open' : ''}`}>
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>
      {open && (
        <div className="lang-switcher-menu">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              type="button"
              className={`lang-switcher-item${l.code === lang ? ' active' : ''}`}
              onClick={() => { setLang(l.code); setOpen(false); }}
            >
              <span className="lang-native">{l.native}</span>
              <span className="lang-english">{l.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
