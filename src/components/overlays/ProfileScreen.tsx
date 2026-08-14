import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { useI18n } from '../../lib/i18n';
import { BACKEND } from '../../lib/api';

// Simple PIN stored as hash in localStorage
function hashPin(pin: string): string {
  let h = 0;
  for (let i = 0; i < pin.length; i++) { h = (Math.imul(31, h) + pin.charCodeAt(i)) | 0; }
  return h.toString(36);
}

export default function ProfileScreen() {
  const { t: tr } = useI18n();
  const setOverlay  = useStore(s => s.setOverlay);
  const userInfo    = useStore(s => s.userInfo);
  const setUserInfo = useStore(s => s.setUserInfo);
  const showToast   = useStore(s => s.showToast);
  const trades      = useStore(s => s.trades);

  const [tab, setTab]       = useState<'info'|'security'|'danger'>('info');
  const [name, setName]     = useState(userInfo?.name || '');
  const [country, setCountry] = useState('');
  const [phone, setPhone]     = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [saving, setSaving] = useState(false);

  // Pull the full profile (country/phone/photo aren't in the lightweight
  // userInfo kept in local storage) once when the screen opens.
  useEffect(() => {
    if (!userInfo?.token || userInfo.token === 'demo') return;
    fetch(`${BACKEND}/api/auth/me`, { headers: { Authorization: `Bearer ${userInfo.token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        setCountry(data.country || '');
        setPhone(data.phone || '');
        setPhotoUrl(data.photoUrl || '');
      })
      .catch(() => {});
  }, [userInfo?.token]);

  // PIN / Passkey states
  const [pinSet, setPinSet]           = useState(false);
  const [pinDialog, setPinDialog]     = useState<'setup'|'verify'|null>(null);
  const [newPin, setNewPin]           = useState('');
  const [confirmPin, setConfirmPin]   = useState('');
  const [enterPin, setEnterPin]       = useState('');
  const [pinError, setPinError]       = useState('');
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyReg, setPasskeyReg]   = useState(false);

  // Delete account states
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [deleteStep, setDeleteStep]     = useState<'confirm'|'otp'>('confirm');
  const [deleteOtp, setDeleteOtp]       = useState('');
  const [deletePass, setDeletePass]     = useState('');
  const [deleting, setDeleting]         = useState(false);
  const [sendingOtp, setSendingOtp]     = useState(false);

  const resolved = trades.filter(t => t.resolved);
  const wins     = resolved.filter(t => t.won);
  const totalPnl = resolved.reduce((a, t) => a + (t.profit || 0), 0);
  const email    = userInfo?.email || '';
  const initials = (userInfo?.name || 'T').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    setPinSet(!!localStorage.getItem('ox_pin'));
    setPasskeySupported(!!(window.PublicKeyCredential));
    setPasskeyReg(!!localStorage.getItem('ox_passkey'));
  }, []);

  // ─── Profile save ──────────────────────────────────────────────────────────
  async function save() {
    if (!name.trim()) { showToast('Name cannot be empty'); return; }
    if (!userInfo?.token || userInfo.token === 'demo') {
      showToast('Sign in with a real account to save your profile');
      return;
    }
    setSaving(true);
    try {
      const [firstName, ...rest] = name.trim().split(' ');
      const res = await fetch(`${BACKEND}/api/auth/me`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${userInfo.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName,
          lastName: rest.join(' ') || firstName,
          country: country.trim(),
          phone: phone.trim(),
          photoUrl: photoUrl.trim(),
        }),
      });
      if (res.ok) {
        setUserInfo({ ...userInfo!, name: name.trim() });
        showToast('Profile updated!');
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d?.error || 'Failed to update profile');
      }
    } catch {
      showToast('Network error — please try again');
    }
    setSaving(false);
  }

  // ─── Profile photo: read a local file and store it as a data URL. There is
  // no separate file-upload/object-storage endpoint, so the photo is saved
  // as a compact base64 data URL directly on the account, same as any other
  // profile field. ────────────────────────────────────────────────────────
  function onPhotoPicked(file: File) {
    if (!file.type.startsWith('image/')) { showToast('Please choose an image file'); return; }
    if (file.size > 1.5 * 1024 * 1024) { showToast('Image must be under 1.5MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setPhotoUrl(String(reader.result || ''));
    reader.readAsDataURL(file);
  }

  // ─── PIN setup ────────────────────────────────────────────────────────────
  function setupPin() {
    if (!newPin || newPin.length < 4) { setPinError('PIN must be at least 4 digits'); return; }
    if (newPin !== confirmPin)        { setPinError('PINs do not match'); return; }
    localStorage.setItem('ox_pin', hashPin(newPin));
    setPinSet(true); setPinDialog(null); setNewPin(''); setConfirmPin(''); setPinError('');
    showToast('PIN set successfully');
  }

  function removePin() {
    localStorage.removeItem('ox_pin');
    setPinSet(false); showToast('PIN removed');
  }

  // ─── Passkey registration via WebAuthn ────────────────────────────────────
  async function registerPasskey() {
    if (!passkeySupported) { showToast('WebAuthn not supported on this browser'); return; }
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const userId = new TextEncoder().encode(email);
      const cred = await navigator.credentials.create({
        publicKey: {
          challenge,
          rp: { name: 'OXIER Trading', id: location.hostname },
          user: { id: userId, name: email, displayName: userInfo?.name || 'Trader' },
          pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
          authenticatorSelection: { userVerification: 'preferred', residentKey: 'preferred' },
          timeout: 60000,
        },
      }) as PublicKeyCredential;
      const rawId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
      localStorage.setItem('ox_passkey', rawId);
      setPasskeyReg(true);
      showToast('Passkey registered! You can now use biometrics to authenticate.');
    } catch (err: any) {
      if (err.name !== 'NotAllowedError') showToast('Passkey registration failed: ' + err.message);
    }
  }

  async function removePasskey() {
    localStorage.removeItem('ox_passkey');
    setPasskeyReg(false);
    showToast('Passkey removed');
  }

  // ─── Delete account ───────────────────────────────────────────────────────
  async function sendDeleteOtp() {
    if (!userInfo?.token) { showToast('Not logged in'); return; }
    setSendingOtp(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/send-delete-otp`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${userInfo.token}`, 'Content-Type': 'application/json' },
      });
      if (res.ok) { setDeleteStep('otp'); showToast('OTP sent to your email'); }
      else showToast('Failed to send OTP');
    } catch { showToast('Network error'); }
    setSendingOtp(false);
  }

  async function deleteAccount() {
    if (!deleteOtp || !deletePass) { showToast('Enter your password and OTP'); return; }
    if (!userInfo?.token) return;
    setDeleting(true);
    try {
      const res = await fetch(`${BACKEND}/api/auth/delete-account`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${userInfo.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: deletePass, code: deleteOtp }),
      });
      if (res.ok) {
        showToast('Account deleted');
        setUserInfo(null);
        localStorage.removeItem('ox_user');
        localStorage.removeItem('ox_pin');
        localStorage.removeItem('ox_passkey');
        setOverlay(null);
      } else {
        const d = await res.json().catch(() => ({}));
        showToast(d?.message || 'Failed to delete account');
      }
    } catch { showToast('Network error'); }
    setDeleting(false);
  }

  // ─── PIN numeric keypad ───────────────────────────────────────────────────
  function PinPad({ value, onChange, label, maxLen = 6 }: { value: string; onChange: (v: string) => void; label: string; maxLen?: number }) {
    const digits = '123456789 0⌫'.split(' ').flatMap(r => r.split(''));
    return (
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
        <div style={{ fontSize:12, color:'var(--t4)', fontWeight:600 }}>{label}</div>
        <div style={{ display:'flex', gap:8 }}>
          {Array.from({ length: maxLen }).map((_, i) => (
            <div key={i} style={{ width:12, height:12, borderRadius:'50%', background: i < value.length ? 'var(--g0)' : 'var(--bg2)', border:'2px solid var(--border)' }} />
          ))}
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, width:180 }}>
          {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((k, i) => (
            <button
              key={i}
              disabled={!k}
              onClick={() => {
                if (k === '⌫') onChange(value.slice(0,-1));
                else if (k && value.length < maxLen) onChange(value + k);
              }}
              style={{
                height:44, borderRadius:10, border:'1px solid var(--border)', background: k ? 'var(--bg2)' : 'transparent',
                color:'var(--t1)', fontSize:18, fontWeight:600, cursor: k ? 'pointer' : 'default', fontFamily:'inherit',
              }}
            >{k}</button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="fullscreen">
      <div className="fs-header">
        <button className="fs-back" onClick={() => setOverlay('panel')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="fs-title">{tr('app.panel.profile')}</span>
      </div>
      <div className="fs-body">
        {/* Avatar */}
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, marginBottom:20 }}>
          <label style={{ position:'relative', cursor:'pointer' }}>
            <div style={{
              width:72, height:72, borderRadius:'50%',
              background: photoUrl ? `url(${photoUrl}) center/cover` : 'linear-gradient(135deg,var(--g0),var(--g2))',
              display:'flex', alignItems:'center', justifyContent:'center', fontSize:26, fontWeight:800, color:'#04060C',
              border:'3px solid rgba(0,230,118,.3)', boxShadow:'0 0 20px rgba(0,230,118,.2)',
            }}>{!photoUrl && initials}</div>
            <div style={{
              position:'absolute', bottom:-2, right:-2, width:24, height:24, borderRadius:'50%',
              background:'var(--bg1)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </div>
            <input type="file" accept="image/*" style={{ display:'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) onPhotoPicked(f); }} />
          </label>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--t1)' }}>{userInfo?.name || 'Trader'}</div>
          <div style={{ fontSize:12, color:'var(--t4)' }}>{email}</div>
        </div>

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:20 }}>
          {[
            { label:tr('app.panel.trades'), val: resolved.length },
            { label:tr('app.panel.winRate'), val: resolved.length ? `${Math.round(wins.length/resolved.length*100)}%` : '—' },
            { label:tr('app.panel.pnl'), val: `${totalPnl >= 0 ? '+' : ''}$${Math.abs(totalPnl).toFixed(0)}`, color: totalPnl >= 0 ? 'var(--g0)' : 'var(--red)' },
          ].map((s,i) => (
            <div key={i} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:'12px 8px', textAlign:'center' }}>
              <div style={{ fontSize:16, fontWeight:800, color: s.color || 'var(--t1)', fontFamily:'JetBrains Mono' }}>{s.val}</div>
              <div style={{ fontSize:10, color:'var(--t4)', marginTop:3 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="profile-tabs" style={{ marginBottom:16 }}>
          {(['info','security','danger'] as const).map(tabId => (
            <button key={tabId} className={`profile-tab ${tab === tabId ? 'active' : ''}`} onClick={() => setTab(tabId)}
              style={{ fontFamily:'inherit', color: tabId === 'danger' && tab === tabId ? 'var(--red)' : undefined }}>
              {tabId === 'info' ? tr('prof.tabInfo') : tabId === 'security' ? tr('prof.tabSecurity') : tr('prof.tabDelete')}
            </button>
          ))}
        </div>

        {/* Info tab */}
        {tab === 'info' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="auth-field">
              <label>{tr('prof.displayName')}</label>
              <input className="auth-input" value={name} onChange={e => setName(e.target.value)} placeholder={tr('prof.namePlaceholder')} />
            </div>
            <div className="auth-field">
              <label>{tr('prof.emailAddress')}</label>
              <input className="auth-input" value={email} readOnly style={{ opacity:.6 }} />
            </div>
            <div className="auth-field">
              <label>{tr('prof.country')}</label>
              <input className="auth-input" value={country} onChange={e => setCountry(e.target.value)} placeholder={tr('prof.countryPlaceholder')} />
            </div>
            <div className="auth-field">
              <label>{tr('prof.phone')}</label>
              <input className="auth-input" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+20 100 000 0000" />
            </div>
            <button className={`auth-btn ${saving ? 'loading' : ''}`} onClick={save} disabled={saving}>
              {saving ? '' : tr('prof.saveChanges')}
            </button>
          </div>
        )}

        {/* Security tab */}
        {tab === 'security' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* PIN */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <span style={{ fontSize:20 }}>🔢</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)' }}>{tr('prof.pinCode')}</div>
                  <div style={{ fontSize:11, color:'var(--t4)' }}>{tr('prof.pinDesc')}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                {pinSet
                  ? <>
                      <button onClick={() => { setPinDialog('setup'); setNewPin(''); setConfirmPin(''); setPinError(''); }}
                        style={{ flex:1, padding:'8px 0', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg1)', color:'var(--t1)', fontWeight:600, cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>{tr('prof.changePin')}</button>
                      <button onClick={removePin}
                        style={{ flex:1, padding:'8px 0', borderRadius:8, border:'1px solid rgba(255,61,87,.3)', background:'rgba(255,61,87,.1)', color:'var(--red)', fontWeight:600, cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>{tr('prof.remove')}</button>
                    </>
                  : <button onClick={() => { setPinDialog('setup'); setNewPin(''); setConfirmPin(''); setPinError(''); }}
                      style={{ width:'100%', padding:'9px 0', borderRadius:8, border:'1px solid rgba(0,230,118,.3)', background:'rgba(0,230,118,.1)', color:'var(--g0)', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>
                      {tr('prof.setupPin')}
                    </button>
                }
              </div>
            </div>

            {/* Passkey / WebAuthn */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:16 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                <span style={{ fontSize:20 }}>🔑</span>
                <div>
                  <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)' }}>{tr('prof.passkeyTitle')}</div>
                  <div style={{ fontSize:11, color:'var(--t4)' }}>
                    {passkeySupported ? tr('prof.passkeySupported') : tr('prof.passkeyNotSupported')}
                  </div>
                </div>
              </div>
              {passkeySupported && (
                passkeyReg
                  ? <div style={{ display:'flex', gap:8 }}>
                      <div style={{ flex:1, padding:'9px 12px', borderRadius:8, background:'rgba(0,230,118,.08)', border:'1px solid rgba(0,230,118,.2)', color:'var(--g0)', fontSize:12, fontWeight:600 }}>
                        {tr('prof.passkeyRegistered')}
                      </div>
                      <button onClick={removePasskey}
                        style={{ padding:'9px 12px', borderRadius:8, border:'1px solid rgba(255,61,87,.3)', background:'rgba(255,61,87,.1)', color:'var(--red)', fontWeight:600, cursor:'pointer', fontSize:12, fontFamily:'inherit' }}>{tr('prof.remove')}</button>
                    </div>
                  : <button onClick={registerPasskey}
                      style={{ width:'100%', padding:'9px 0', borderRadius:8, border:'1px solid rgba(59,130,246,.3)', background:'rgba(59,130,246,.1)', color:'#3B82F6', fontWeight:700, cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>
                      {tr('prof.registerPasskey')}
                    </button>
              )}
            </div>

            {/* Change password */}
            <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--t1)', marginBottom:4 }}>{tr('prof.changePassword')}</div>
              <div style={{ fontSize:11, color:'var(--t4)', marginBottom:10 }}>{tr('prof.changePasswordDesc')}</div>
              <button onClick={() => showToast('Password reset link sent to your email!')}
                style={{ width:'100%', padding:'9px 0', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg1)', color:'var(--t1)', fontWeight:600, cursor:'pointer', fontSize:13, fontFamily:'inherit' }}>
                {tr('prof.sendResetLink')}
              </button>
            </div>
          </div>
        )}

        {/* Danger zone tab */}
        {tab === 'danger' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ background:'rgba(255,61,87,.06)', border:'1px solid rgba(255,61,87,.2)', borderRadius:'var(--r2)', padding:16 }}>
              <div style={{ fontSize:14, fontWeight:700, color:'var(--red)', marginBottom:6 }}>⚠ Delete Account</div>
              <div style={{ fontSize:13, color:'var(--t3)', marginBottom:12 }}>
                {tr('prof.deleteWarning')}<br/>
                {tr('prof.deleteWarningSub')}
              </div>
              <button
                onClick={() => { setDeleteDialog(true); setDeleteStep('confirm'); setDeleteOtp(''); setDeletePass(''); }}
                style={{ width:'100%', padding:'11px 0', borderRadius:8, border:'1px solid rgba(255,61,87,.4)', background:'rgba(255,61,87,.15)', color:'var(--red)', fontWeight:700, cursor:'pointer', fontSize:14, fontFamily:'inherit' }}>
                {tr('prof.deleteMyAccount')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PIN setup dialog */}
      {pinDialog === 'setup' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--bg1)', borderRadius:16, padding:24, minWidth:260, border:'1px solid var(--border)' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--t1)', marginBottom:16, textAlign:'center' }}>
              {!newPin || newPin.length < 4 ? tr('prof.enterNewPin') : tr('prof.confirmPinTitle')}
            </div>
            {(!newPin || newPin.length < 4)
              ? <PinPad value={newPin} onChange={setNewPin} label={tr('prof.newPinLabel')} maxLen={6} />
              : <PinPad value={confirmPin} onChange={setConfirmPin} label={tr('prof.confirmPinLabel')} maxLen={6} />
            }
            {pinError && <div style={{ color:'var(--red)', fontSize:12, textAlign:'center', marginTop:8 }}>{pinError}</div>}
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button onClick={() => { setPinDialog(null); setNewPin(''); setConfirmPin(''); setPinError(''); }}
                style={{ flex:1, padding:'10px 0', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--t3)', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>{tr('prof.cancel')}</button>
              {newPin.length >= 4 && confirmPin.length >= 4 && (
                <button onClick={setupPin}
                  style={{ flex:1, padding:'10px 0', borderRadius:8, border:'none', background:'var(--g0)', color:'#04060C', fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{tr('prof.savePin')}</button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete account dialog */}
      {deleteDialog && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ background:'var(--bg1)', borderRadius:16, padding:24, minWidth:300, maxWidth:360, border:'1px solid rgba(255,61,87,.3)' }}>
            <div style={{ fontSize:16, fontWeight:700, color:'var(--red)', marginBottom:8, textAlign:'center' }}>{tr('prof.deleteAccountDialogTitle')}</div>
            {deleteStep === 'confirm' ? (
              <>
                <div style={{ fontSize:13, color:'var(--t3)', textAlign:'center', marginBottom:16 }}>
                  {tr('prof.otpSendNote')} <strong>{email}</strong>
                </div>
                <div className="auth-field" style={{ marginBottom:12 }}>
                  <label>{tr('prof.currentPassword')}</label>
                  <input className="auth-input" type="password" value={deletePass} onChange={e => setDeletePass(e.target.value)} placeholder={tr('prof.enterPasswordPlaceholder')} />
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setDeleteDialog(false)}
                    style={{ flex:1, padding:'10px 0', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--t3)', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>{tr('prof.cancel')}</button>
                  <button onClick={sendDeleteOtp} disabled={sendingOtp || !deletePass}
                    style={{ flex:1, padding:'10px 0', borderRadius:8, border:'none', background:'rgba(255,61,87,.8)', color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: sendingOtp || !deletePass ? .5 : 1 }}>
                    {sendingOtp ? tr('prof.sending') : tr('prof.sendOtp')}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize:13, color:'var(--t3)', textAlign:'center', marginBottom:16 }}>
                  {tr('prof.otpEnterNote')}
                </div>
                <div className="auth-field" style={{ marginBottom:12 }}>
                  <label>{tr('prof.verificationCode')}</label>
                  <input className="auth-input" value={deleteOtp} onChange={e => setDeleteOtp(e.target.value)} placeholder={tr('prof.otpPlaceholder')} maxLength={6} style={{ fontFamily:'JetBrains Mono', letterSpacing:4 }} />
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setDeleteDialog(false)}
                    style={{ flex:1, padding:'10px 0', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg2)', color:'var(--t3)', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>{tr('prof.cancel')}</button>
                  <button onClick={deleteAccount} disabled={deleting || !deleteOtp}
                    style={{ flex:1, padding:'10px 0', borderRadius:8, border:'none', background:'var(--red)', color:'#fff', fontWeight:700, cursor:'pointer', fontFamily:'inherit', opacity: deleting || !deleteOtp ? .5 : 1 }}>
                    {deleting ? tr('prof.deleting') : tr('prof.confirmDelete')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
