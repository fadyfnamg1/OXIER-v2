import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { BACKEND } from '../../lib/api';
import MarketBackground from '../../components/MarketBackground';

const OTP_LEN = 6;
const RESEND_COOLDOWN = 30;

export default function LoginVerifyScreen() {
  const setScreen = useStore(s => s.setScreen);
  const setUserInfo = useStore(s => s.setUserInfo);
  const showToast = useStore(s => s.showToast);
  const pendingLogin = useStore(s => s.pendingLogin);
  const setPendingLogin = useStore(s => s.setPendingLogin);

  const email = pendingLogin?.email || '';

  const [digits, setDigits] = useState<string[]>(Array(OTP_LEN).fill(''));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [shake, setShake] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function handleKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      const nd = [...digits];
      if (nd[i]) { nd[i] = ''; setDigits(nd); }
      else if (i > 0) { refs.current[i - 1]?.focus(); }
    }
  }

  function handleChange(i: number, val: string) {
    const ch = val.replace(/\D/g, '').slice(-1);
    const nd = [...digits]; nd[i] = ch; setDigits(nd);
    if (ch && i < OTP_LEN - 1) refs.current[i + 1]?.focus();
  }

  function handlePaste(e: React.ClipboardEvent) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, OTP_LEN);
    if (text.length === OTP_LEN) { setDigits(text.split('')); refs.current[OTP_LEN - 1]?.focus(); }
  }

  async function handleVerify() {
    const code = digits.join('');
    if (code.length < OTP_LEN) { showToast('Enter the complete OTP code'); return; }
    if (!email) { showToast('Session expired — please sign in again'); setScreen('login'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/login/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.token) {
        const name = data.user?.firstName
          ? `${data.user.firstName} ${data.user.lastName || ''}`.trim()
          : email.split('@')[0];
        setUserInfo({ email, name, token: data.token });
        setPendingLogin(null);
        setScreen('trading');
      } else {
        showToast(data.error || data.message || 'Invalid OTP code');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setDigits(Array(OTP_LEN).fill(''));
        refs.current[0]?.focus();
      }
    } catch {
      showToast('Connection error');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    if (!pendingLogin) { showToast('Session expired — please sign in again'); setScreen('login'); return; }
    if (cooldown > 0) return;
    setResending(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/login/resend-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: pendingLogin.email, password: pendingLogin.password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) { showToast('OTP resent to ' + email); setCooldown(RESEND_COOLDOWN); }
      else showToast(data.error || 'Could not resend OTP');
    } catch {
      showToast('Could not resend OTP');
    } finally {
      setResending(false);
    }
  }

  function backToLogin() {
    setPendingLogin(null);
    setScreen('login');
  }

  const ringR = 7, ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC * (cooldown / RESEND_COOLDOWN);

  return (
    <div className="auth-screen">
      <MarketBackground scrollRoot="" subtle />
      <div className="grain-overlay" />
      <div className="auth-hero">
        <div className="auth-hero-glow" />
        <div className="auth-logo">
          <svg width="27" height="27" viewBox="0 0 24 24" fill="none" stroke="#1A0D00" strokeWidth="2">
            <rect x="2.5" y="5" width="19" height="14" rx="3"/>
            <path d="M3.5 6.5l8.5 7 8.5-7" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1>Verify it's you</h1>
        <p>We sent a 6-digit code to<br /><strong style={{ color:'var(--t2)' }}>{email || 'your email'}</strong></p>
      </div>
      <div className="auth-body">
        <div className={`otp-inputs${shake ? ' shake' : ''}`} onPaste={handlePaste}>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={el => refs.current[i] = el}
              className={`otp-input${d ? ' filled' : ''}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={d}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKey(i, e)}
              autoFocus={i === 0}
            />
          ))}
        </div>
        <button
          className={`auth-btn ${loading ? 'loading' : ''}`}
          onClick={handleVerify}
          disabled={loading}
        >
          {loading ? '' : 'Verify & Sign In'}
        </button>
        <div className="otp-resend-row">
          {cooldown > 0 || resending ? (
            <>
              <svg className="otp-resend-ring" viewBox="0 0 18 18">
                <circle className="track" cx="9" cy="9" r={ringR} />
                <circle className="fill" cx="9" cy="9" r={ringR} strokeDasharray={ringC} strokeDashoffset={ringOffset} />
              </svg>
              <span style={{ fontSize: 13, color: 'var(--t4)' }}>
                {resending ? 'Sending…' : `Resend code in ${cooldown}s`}
              </span>
            </>
          ) : (
            <span className="auth-link" style={{ margin: 0 }}>
              Didn't receive the code? <span onClick={resend}>Resend OTP</span>
            </span>
          )}
        </div>
        <div className="auth-link">
          <span onClick={backToLogin}>Back to login</span>
        </div>
      </div>
    </div>
  );
}
