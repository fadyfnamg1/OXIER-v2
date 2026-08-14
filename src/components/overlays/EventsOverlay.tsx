import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { apiFetch } from '../../lib/api';
import { useI18n } from '../../lib/i18n';

interface ApiEvent {
  _id: string;
  imageUrl: string;
  caption: string;
  createdAt: string;
  promoCode?: string;
  promoBonusPct?: number;
  promoLabel?: string;
}

export default function EventsOverlay() {
  const { t } = useI18n();
  const setOverlay = useStore(s => s.setOverlay);
  const setPendingPromoCode = useStore(s => s.setPendingPromoCode);

  const [events, setEvents] = useState<ApiEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('/api/events')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data?.events)) setEvents(data.events); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function useCode(ev: ApiEvent) {
    if (!ev.promoCode) return;
    setPendingPromoCode(ev.promoCode);
    setOverlay('deposit');
  }

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />
        <div className="overlay-header">
          <span className="overlay-title">{t('ev.title')}</span>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="overlay-body">
          {loading && (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 10px' }} />
            </div>
          )}

          {!loading && events.length === 0 && (
            <div style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--t4)' }}>
              <div style={{ fontSize: 34, marginBottom: 12, opacity: .6 }}>📭</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t3)', marginBottom: 4 }}>Nothing here yet</div>
              <div style={{ fontSize: 12.5 }}>Check back soon for news, promotions, and announcements.</div>
            </div>
          )}

          {!loading && events.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {events.map(ev => (
                <div key={ev._id} className="dep-glass" style={{ padding: 0, overflow: 'hidden' }}>
                  <img
                    src={ev.imageUrl}
                    alt={ev.caption || 'Event'}
                    style={{ width: '100%', display: 'block', maxHeight: 360, objectFit: 'cover' }}
                  />
                  {ev.caption && (
                    <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--t2)', lineHeight: 1.6 }}>
                      {ev.caption}
                    </div>
                  )}
                  {ev.promoCode && (
                    <div style={{ padding: '0 14px 14px' }}>
                      <button
                        onClick={() => useCode(ev)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          border: '1px solid rgba(214,175,90,.35)',
                          borderRadius: 16,
                          padding: '14px 16px',
                          cursor: 'pointer',
                          background: 'linear-gradient(160deg, #1C1C1C, #0A0A0A)',
                          boxShadow: '0 10px 28px -10px rgba(0,0,0,.6), inset 0 1px 0 rgba(255,255,255,.05)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 10,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                            <span
                              style={{
                                width: 26, height: 26, borderRadius: 999,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'linear-gradient(135deg, #F3D488, #B8863B)',
                                fontSize: 13, flexShrink: 0,
                              }}
                            >
                              🎁
                            </span>
                            <span style={{
                              fontWeight: 700, fontSize: 13, color: 'rgba(255,255,255,.9)',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {ev.promoLabel || 'Deposit Bonus'}
                            </span>
                          </span>

                          {typeof ev.promoBonusPct === 'number' && (
                            <span
                              style={{
                                fontSize: 20,
                                fontWeight: 900,
                                letterSpacing: '-.02em',
                                whiteSpace: 'nowrap',
                                background: 'linear-gradient(135deg, #F7E2A6, #C89A4C)',
                                WebkitBackgroundClip: 'text',
                                backgroundClip: 'text',
                                color: 'transparent',
                              }}
                            >
                              +{ev.promoBonusPct}%
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            border: '1px dashed rgba(214,175,90,.4)',
                            borderRadius: 10,
                            padding: '8px 12px',
                            background: 'rgba(214,175,90,.06)',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'JetBrains Mono, monospace',
                              fontSize: 13,
                              fontWeight: 700,
                              letterSpacing: '.06em',
                              color: '#E8CD8C',
                            }}
                          >
                            {ev.promoCode}
                          </span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.4)' }}>
                            Tap to apply
                          </span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
