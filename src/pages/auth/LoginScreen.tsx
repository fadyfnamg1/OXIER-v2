import { useState } from 'react';
import { useStore } from '../../lib/store';
import OxierLogo from '../../components/OxierLogo';
import { resumeAudio } from '../../lib/sounds';
import { BACKEND } from '../../lib/api';
import MarketBackground from '../../components/MarketBackground';

export default function LoginScreen() {
  const setScreen  = useStore(s => s.setScreen);
  const setPendingLogin = useStore(s => s.setPendingLogin);
  const showToast  = useStore(s => s.showToast);

  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr]         = useState('');

  // Step 1 of login: verify email+password and have the backend email a
  // fresh OTP. No token is issued here — the session only starts once the
  // OTP is confirmed on the next screen.
  async function handleLogin() {
    if (!email.trim() || !password.trim()) { setErr('Please fill all fields'); return; }
    setErr(''); setLoading(true); resumeAudio();
    try {
      const cleanEmail = email.trim().toLowerCase();
      const res = await fetch(`${BACKEND}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPendingLogin({ email: cleanEmail, password });
        showToast('A verification code was sent to your email');
        setScreen('login-verify');
      } else {
        setErr(data.error || data.message || 'Login failed — check your credentials');
      }
    } catch { setErr('Connection error — check your network'); }
    finally { setLoading(false); }
  }

  return (
    <div className="auth-screen">
      <MarketBackground scrollRoot="" subtle />
      <div className="grain-overlay" />

      {/* Hero */}
      <div className="auth-hero" style={{ paddingTop: 56 }}>
        <OxierLogo size={26} className="auth-logo-wordmark" />
        <h1>Welcome back</h1>
        <p>Sign in to your OXIER trading account</p>
      </div>

      {/* Body */}
      <div className="auth-body">
        <div className="auth-card">
          {err && (
            <div className="auth-error" style={{ animation: 'fadeDown .3s both' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              {err}
            </div>
          )}

          <div className="auth-field" style={{ animationDelay: '.05s' }}>
            <label>Email Address</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16v16H4z" opacity="0"/><path d="M22 6l-10 7L2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>
              </span>
              <input
                className="auth-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                autoComplete="email"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
          </div>

          <div className="auth-field" style={{ animationDelay: '.12s' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label>Password</label>
              <span
                style={{ fontSize: 11, color: 'var(--o-500)', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => showToast('Password reset link sent!')}
              >Forgot password?</span>
            </div>
            <div className="auth-input-wrap auth-pw-wrap">
              <span className="auth-input-icon">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
              </span>
              <input
                className="auth-input"
                type={showPw ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ paddingInlineEnd: 44 }}
              />
              <button className="auth-pw-eye" onClick={() => setShowPw(v => !v)} type="button">
                {showPw
                  ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                }
              </button>
            </div>
          </div>

          <button
            className={`auth-btn ${loading ? 'loading' : ''}`}
            onClick={handleLogin}
            disabled={loading}
            style={{ animationDelay: '.2s', marginTop: 4 }}
          >
            {loading
              ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                  Signing in…
                </span>
              : 'Sign In'
            }
          </button>

          <div className="auth-link" style={{ animationDelay: '.28s' }}>
            Don't have an account?{' '}
            <span onClick={() => setScreen('register')}>Create account</span>
          </div>
        </div>

        <div
          className="auth-back-link"
          style={{ animationDelay: '.44s', animation: 'fadeUp .4s .44s both' }}
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            Licensed &amp; regulated
          </span>
        </div>
      </div>
    </div>
  );
}
