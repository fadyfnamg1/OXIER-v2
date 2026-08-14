/**
 * Recognizable vector marks for real-world payment methods — Egyptian
 * e-wallets and cryptocurrencies. These are hand-drawn SVG approximations
 * of each brand's actual (very simple/geometric) mark, in the correct
 * brand color, purely for identifying which real-world payment rail a
 * button represents — the same approach used by open icon sets across
 * countless finance apps. They are not pixel copies of any trademarked
 * artwork file.
 */

function IconWrap({ size, bg, children, radius = '30%' }: { size: number; bg: string; children: React.ReactNode; radius?: string }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius, background: bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0, overflow: 'hidden', position: 'relative',
      boxShadow: '0 1px 0 rgba(255,255,255,.25) inset, 0 3px 10px rgba(0,0,0,.28)',
    }}>
      {/* top-left glass sheen for a bit of depth */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(135deg, rgba(255,255,255,.22) 0%, rgba(255,255,255,0) 45%)',
      }} />
      {children}
    </div>
  );
}

// ── Egyptian e-wallets ──────────────────────────────────────────────────
export function WalletIcon({ id, size = 40 }: { id: string; size?: number }) {
  const s = size;
  switch (id) {
    case 'vodafone':
      return (
        <IconWrap size={s} bg="#E60000" radius="50%">
          <svg width={s * 0.62} height={s * 0.62} viewBox="0 0 24 24" fill="none">
            <path d="M14.5 3C9 3 5 8 5 13.5 5 18.7 8.8 22 13 22c1 0 2-.2 2.8-.6-4-.4-7-3.6-7-7.9 0-4.6 3.4-8.5 7.7-9.3C15.8 3.1 15.2 3 14.5 3z" fill="#fff"/>
            <path d="M15.5 9.2c-2.4 0-4.3 2-4.3 4.6 0 2.5 1.9 4.5 4.3 4.5s4.3-2 4.3-4.5c0-2.6-1.9-4.6-4.3-4.6z" fill="#E60000" opacity="0"/>
          </svg>
        </IconWrap>
      );
    case 'orange':
      return (
        <IconWrap size={s} bg="#FF6600" radius="28%">
          <span style={{ fontSize: s * 0.34, fontWeight: 800, color: '#fff', fontFamily: 'Georgia, serif', letterSpacing: -0.5 }}>orange</span>
        </IconWrap>
      );
    case 'etisalat':
      return (
        <IconWrap size={s} bg="#00A651" radius="28%">
          <svg width={s * 0.58} height={s * 0.58} viewBox="0 0 24 24" fill="none">
            <path d="M4 18c3-1 5-4 5-8 0-2.5-1-4.5-2.5-6C10 5 13 8 13 12.5c0 3-1.3 5.5-3.5 7C13 20 17 17.5 17 12c0-4-2.5-7.5-6-9 5 .5 9 5 9 10.5C20 19.5 15 24 9 24c-2 0-3.8-.5-5-1.2 1-.7 1.8-1.7 2.3-2.8-.9.2-1.8 0-2.3-1z" fill="#fff"/>
          </svg>
        </IconWrap>
      );
    case 'we':
      return (
        <IconWrap size={s} bg="#5B2D8E" radius="28%">
          <span style={{ fontSize: s * 0.4, fontWeight: 800, color: '#fff', fontFamily: 'Arial, sans-serif' }}>we</span>
        </IconWrap>
      );
    case 'instapay':
      return (
        <IconWrap size={s} bg="#0066CC" radius="28%">
          <svg width={s * 0.56} height={s * 0.56} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 7h8l-3-3M17 17H9l3 3"/>
          </svg>
        </IconWrap>
      );
    default:
      return (
        <IconWrap size={s} bg="var(--bg3)" radius="28%">
          <svg width={s * 0.5} height={s * 0.5} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
        </IconWrap>
      );
  }
}

// ── Cryptocurrencies ────────────────────────────────────────────────────
export function CryptoIcon({ symbol, size = 40 }: { symbol: string; size?: number }) {
  const s = size;
  switch (symbol) {
    case 'USDT':
      return (
        <IconWrap size={s} bg="#26A17B" radius="50%">
          <svg width={s * 0.6} height={s * 0.6} viewBox="0 0 32 32" fill="#fff">
            <path d="M17.5 17.3v-.01c-.15.01-.9.06-2.55.06-1.32 0-2.26-.04-2.6-.06v.02c-4.3-.19-7.5-.94-7.5-1.84 0-.9 3.2-1.65 7.5-1.84v2.93c.34.02 1.3.08 2.62.08 1.62 0 2.43-.07 2.53-.08v-2.93c4.29.19 7.48.94 7.48 1.83 0 .9-3.19 1.65-7.48 1.84M17.5 13.2v-2.64h5.98V6.4H8.55v4.16h5.98v2.64c-4.87.23-8.53 1.19-8.53 2.35s3.66 2.12 8.53 2.35v8.4h2.97v-8.4c4.86-.23 8.51-1.19 8.51-2.35s-3.65-2.12-8.51-2.35"/>
          </svg>
        </IconWrap>
      );
    case 'USDC':
      return (
        <IconWrap size={s} bg="#2775CA" radius="50%">
          <span style={{ fontSize: s * 0.42, fontWeight: 800, color: '#fff' }}>$</span>
        </IconWrap>
      );
    case 'BTC':
      return (
        <IconWrap size={s} bg="#F7931A" radius="50%">
          <svg width={s * 0.55} height={s * 0.55} viewBox="0 0 24 24" fill="#fff">
            <path d="M15.9 10.6c.4-1.6-.6-2.4-2.1-3l.4-1.7-1.1-.3-.4 1.6c-.3-.1-.6-.1-.9-.2l.4-1.7-1.1-.3-.4 1.7c-.2-.1-.5-.1-.7-.2l-1.5-.4-.3 1.2s.8.2.8.2c.4.1.5.4.5.6l-1.2 4.9c0 .1-.1.2-.3.2h.1l-1.7 6.8c-.1.2-.3.5-.7.4 0 0-.8-.2-.8-.2l-.5 1.3 1.5.4c.3.1.5.1.8.2l-.4 1.7 1.1.3.4-1.7c.3.1.6.2.9.2l-.4 1.7 1.1.3.4-1.7c1.9.4 3.3.2 3.9-1.5.5-1.4 0-2.2-1-2.7.7-.2 1.3-.6 1.4-1.7zm-2.5 5.2c-.3 1.4-2.8.6-3.6.4l.7-2.7c.8.2 3.3.6 2.9 2.3zm.3-5.2c-.3 1.3-2.3.6-3 .5l.6-2.5c.6.2 2.8.5 2.4 2z"/>
          </svg>
        </IconWrap>
      );
    case 'ETH':
      return (
        <IconWrap size={s} bg="#627EEA" radius="50%">
          <svg width={s * 0.42} height={s * 0.62} viewBox="0 0 16 26" fill="#fff">
            <path d="M8 0L7.8.7v16.5l.2.2L16 12.9z" opacity=".65"/>
            <path d="M8 0L0 12.9l8 4.5V9.2z"/>
            <path d="M8 19.1l-.1.1v6.3l.1.3L16 14.4z" opacity=".65"/>
            <path d="M8 25.8v-6.7L0 14.4z"/>
            <path d="M8 17.4l8-4.5-8-3.7z" opacity=".45"/>
            <path d="M0 12.9l8 4.5V9.2z" opacity=".8"/>
          </svg>
        </IconWrap>
      );
    case 'BNB':
      return (
        <IconWrap size={s} bg="#F0B90B" radius="50%">
          <svg width={s * 0.5} height={s * 0.5} viewBox="0 0 24 24" fill="#fff">
            <path d="M12 2l2.8 2.8L9.2 10.4 6.4 7.6zM6.4 9.2L9.2 12l-2.8 2.8L3.6 12zM12 13.6l2.8 2.8L9.2 22l-2.8-2.8zM17.6 9.2L20.4 12l-2.8 2.8L14.8 12zM12 10.4l1.6 1.6-1.6 1.6-1.6-1.6z"/>
          </svg>
        </IconWrap>
      );
    case 'SOL':
      return (
        <IconWrap size={s} bg="linear-gradient(135deg, #9945FF, #14F195)" radius="50%">
          <svg width={s * 0.56} height={s * 0.56} viewBox="0 0 32 24" fill="#fff">
            <path d="M4.5 18.6a1 1 0 01.7-.3h25.5a.5.5 0 01.35.85l-4.7 4.7a1 1 0 01-.7.3H.15a.5.5 0 01-.35-.85z"/>
            <path d="M4.5.3a1 1 0 01.7-.3h25.5a.5.5 0 01.35.85l-4.7 4.7a1 1 0 01-.7.3H.15A.5.5 0 01-.2 5z"/>
            <path d="M27.3 9.4a1 1 0 00-.7-.3H1.1a.5.5 0 00-.35.85l4.7 4.7a1 1 0 00.7.3h25.5a.5.5 0 00.35-.85z"/>
          </svg>
        </IconWrap>
      );
    case 'TRX':
      return (
        <IconWrap size={s} bg="#FF0013" radius="50%">
          <svg width={s * 0.56} height={s * 0.56} viewBox="0 0 24 24" fill="#fff">
            <path d="M3 5.2L13.6 3l7.7 1.8-3.9 12.7L9.8 21z" opacity="0"/>
            <path d="M3.2 5.3l6 2.2 4.9 12.9-.4.4-9.9-11z"/>
            <path d="M9.2 7.5L20 5.3l-5.2 12.6z" opacity=".55"/>
            <path d="M20 5.3l1 1.4-6.7 6.1z" opacity=".8"/>
            <path d="M3.2 5.3L13.4 3.2l1 1.3-5.2 3z"/>
          </svg>
        </IconWrap>
      );
    case 'LTC':
      return (
        <IconWrap size={s} bg="#BFBBBB" radius="50%">
          <span style={{ fontSize: s * 0.42, fontWeight: 800, color: '#fff' }}>Ł</span>
        </IconWrap>
      );
    case 'XRP':
      return (
        <IconWrap size={s} bg="#346AA9" radius="50%">
          <svg width={s * 0.6} height={s * 0.6} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
            <path d="M4 5c2 3 4 5 8 5s6-2 8-5M4 19c2-3 4-5 8-5s6 2 8 5"/>
          </svg>
        </IconWrap>
      );
    case 'TON':
      return (
        <IconWrap size={s} bg="#0088CC" radius="50%">
          <svg width={s * 0.52} height={s * 0.52} viewBox="0 0 24 24" fill="#fff">
            <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm3.6 6.4l-3 8.6c-.1.3-.5.3-.6 0l-3-8.6c-.1-.2 0-.5.3-.5h6c.3 0 .4.3.3.5z"/>
          </svg>
        </IconWrap>
      );
    default:
      return (
        <IconWrap size={s} bg="#2a3a5e" radius="50%">
          <span style={{ fontSize: s * 0.38, fontWeight: 800, color: '#fff' }}>{symbol.slice(0, 1)}</span>
        </IconWrap>
      );
  }
}
