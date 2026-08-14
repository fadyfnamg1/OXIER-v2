import { useMemo, useState } from 'react';
import { COUNTRIES, flagEmoji } from '../lib/countries';
import { useI18n } from '../lib/i18n';

export default function CountryPicker({
  onSelect,
  current,
}: {
  onSelect: (country: string) => void;
  current?: string | null;
}) {
  const { t } = useI18n();
  const [q, setQ] = useState('');

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return COUNTRIES;
    return COUNTRIES.filter(c => c.name.toLowerCase().includes(query));
  }, [q]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--t1)', marginBottom: 4 }}>{t('cp.selectCountry')}</div>
        <div style={{ fontSize: 12.5, color: 'var(--t4)', lineHeight: 1.6 }}>
          {t('cp.determinesNote')}
        </div>
      </div>

      <div style={{ position: 'relative' }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="2"
          style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)' }}>
          <circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          className="auth-input"
          style={{ paddingLeft: 36 }}
          placeholder={t('cp.searchPlaceholder')}
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: '52vh', overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--t4)', fontSize: 13 }}>{t('cp.noMatch')} "{q}"</div>
        )}
        {filtered.map(c => {
          const active = current === c.name;
          return (
            <button
              key={c.code}
              type="button"
              onClick={() => onSelect(c.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px', borderRadius: 'var(--r2)', textAlign: 'left',
                background: active ? 'rgba(0,214,143,.08)' : 'var(--bg2)',
                border: `1.5px solid ${active ? 'var(--g0)' : 'var(--border)'}`,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all .15s',
              }}
            >
              <span style={{ fontSize: 20, lineHeight: 1 }}>{flagEmoji(c.code)}</span>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--t1)' }}>{c.name}</span>
              {active && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--g0)" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
