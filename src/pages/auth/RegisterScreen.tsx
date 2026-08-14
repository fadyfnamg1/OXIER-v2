import { useState } from 'react';
import { useStore } from '../../lib/store';
import OxierLogo from '../../components/OxierLogo';
import { BACKEND } from '../../lib/api';
import MarketBackground from '../../components/MarketBackground';

function passwordStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: 'var(--border2)' };
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: 'Weak', color: 'var(--red)' };
  if (score <= 3) return { score, label: 'Medium', color: '#F59E0B' };
  return { score, label: 'Strong', color: 'var(--g0)' };
}

export default function RegisterScreen() {
  const setScreen = useStore(s => s.setScreen);
  const showToast = useStore(s => s.showToast);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const strength = passwordStrength(password);

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password) { setErr('Please fill all fields'); return; }
    if (password.length < 6) { setErr('Password must be at least 6 characters'); return; }
    if (password !== confirm) { setErr('Passwords do not match'); return; }
    setErr(''); setLoading(true);
    try {
      const parts = name.trim().split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(' ') || parts[0];
      const res = await fetch(`${BACKEND}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName, lastName, name: name.trim(), email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('ox_reg_email', email.trim().toLowerCase());
        showToast('Account created! Check your email for OTP');
        setScreen('verify');
      } else {
        setErr(data.message || data.error || 'Registration failed');
      }
    } catch {
      setErr('Connection error — check your network');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <MarketBackground scrollRoot="" subtle />
      <div className="grain-overlay" />
      <div className="auth-hero" style={{ paddingTop: 56 }}>
        <div className="auth-hero-glow" />
        <OxierLogo size={26} className="auth-logo-wordmark" />
        <h1>Create account</h1>
        <p>Join OXIER and start trading today</p>
      </div>

      <div className="auth-body">
        <div className="auth-card">
          {err && (
            <div className="auth-error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {err}
            </div>
          )}

          <div className="auth-field" style={{ animationDelay: '.05s' }}>
            <label>Full Name</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/></svg>
              </span>
              <input className="auth-input" type="text" placeholder="Your Name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" />
            </div>
          </div>

          <div className="auth-field" style={{ animationDelay: '.1s' }}>
            <label>Email</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 6l-10 7L2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
              </span>
              <input className="auth-input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
            </div>
          </div>

          <div className="auth-field" style={{ animationDelay: '.15s' }}>
            <label>Password</label>
            <div className="auth-input-wrap auth-pw-wrap">
              <span className="auth-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </span>
              <input
                className="auth-input"
                type={showPw ? 'text' : 'password'}
                placeholder="Min 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="new-password"
                style={{ paddingInlineEnd: 44 }}
              />
              <button className="auth-pw-eye" onClick={() => setShowPw(v => !v)} type="button">
                {showPw
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
            {password && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border2)', overflow: 'hidden' }}>
                  <div style={{
                    width: `${(strength.score / 5) * 100}%`, height: '100%',
                    background: strength.color, borderRadius: 2, transition: 'width .2s, background .2s',
                  }} />
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: strength.color, minWidth: 44 }}>{strength.label}</span>
              </div>
            )}
          </div>

          <div className="auth-field" style={{ animationDelay: '.2s' }}>
            <label>Confirm Password</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </span>
              <input
                className="auth-input"
                type="password"
                placeholder="Repeat password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                autoComplete="new-password"
                onKeyDown={e => e.key === 'Enter' && handleRegister()}
              />
            </div>
          </div>

          <button
            className={`auth-btn ${loading ? 'loading' : ''}`}
            onClick={handleRegister}
            disabled={loading}
            style={{ animationDelay: '.25s', marginTop: 4 }}
          >
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Creating account…
                </span>
              : 'Create Account'
            }
          </button>

          <div className="auth-link">
            Already have an account?{' '}
            <span onClick={() => setScreen('login')}>Sign in</span>
          </div>
        </div>

        <div
          className="auth-back-link"
          style={{ animation: 'fadeUp .4s .3s both' }}
          onClick={() => setScreen('landing')}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="15 18 9 12 15 6"/></svg>
          <span style={{ fontSize: 11, color: 'var(--t4)', cursor: 'pointer' }}>Back to home</span>
        </div>

        <div className="auth-trust trust-badge-row">
          <span className="trust-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
            256-bit encryption
          </span>
          <span className="trust-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polyline points="20 6 9 17 4 12"/></svg>
            No hidden fees
          </span>
        </div>
      </div>
    </div>
  );
}
