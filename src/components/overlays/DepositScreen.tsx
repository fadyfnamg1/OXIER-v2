import { useState, useRef, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { apiFetch } from '../../lib/api';
import type { Transaction } from '../../types';
import { getCryptoMeta, type DepositMethodDTO } from '../../lib/paymentMethods';
import { CryptoIcon } from '../PaymentIcons';
import { useI18n } from '../../lib/i18n';

type DepStep = 'select' | 'form' | 'payment' | 'done';
const STEP_ORDER: DepStep[] = ['select', 'form', 'payment'];

// Fixed display order requested for the method list — USDT variants first,
// then the major coins. Anything the admin adds that isn't in this list
// simply falls to the end, in the order the backend returned it.
const METHOD_ORDER = [
  'USDT (TRC20)', 'USDT (ERC20)', 'USDT (BEP20)',
  'Bitcoin', 'Ethereum', 'Litecoin', 'TRON', 'BNB', 'USDC (ERC20)', 'XRP',
];

// Trims a raw float down to a clean, human-friendly coin amount — full
// precision for tiny fractions (so 0.0003152747... reads correctly) but
// no ugly trailing zeros or floating-point noise.
function formatCoinAmount(n: number): string {
  if (!isFinite(n) || isNaN(n)) return '0';
  if (n >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: 6 });
  return n.toFixed(10).replace(/0+$/, '').replace(/\.$/, '');
}

export default function DepositScreen() {
  const { t } = useI18n();
  const setOverlay     = useStore(s => s.setOverlay);
  const showToast      = useStore(s => s.showToast);
  const addTransaction = useStore(s => s.addTransaction);
  const userInfo       = useStore(s => s.userInfo);
  const setScreen      = useStore(s => s.setScreen);
  const pendingPromoCode    = useStore(s => s.pendingPromoCode);
  const setPendingPromoCode = useStore(s => s.setPendingPromoCode);
  const isDemo = !userInfo?.token || userInfo.token === 'demo';

  const [step, setStep]           = useState<DepStep>('select');
  const [methods, setMethods]     = useState<DepositMethodDTO[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [crypto, setCrypto]       = useState<DepositMethodDTO | null>(null);
  // Live USDT price per coin symbol — so a min/max amount set by the admin
  // in the coin's own unit (e.g. "0.0003 BTC") is always shown next to its
  // real-world USDT value too, instead of a bare crypto number.
  const [prices, setPrices] = useState<Record<string, number>>({});

  // Form fields
  const [fullName,    setFullName]   = useState('');
  const [amount,      setAmount]     = useState('');

  // Promo / bonus code — optional. Pre-filled if the user tapped "Use Code"
  // from an Event; otherwise blank and freely editable.
  const [promoCode,    setPromoCode]    = useState('');
  const [promoStatus,  setPromoStatus]  = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [promoBonusPct, setPromoBonusPct] = useState<number | null>(null);

  // Payment step
  const [copied,         setCopied]         = useState(false);
  const [receiptFile,    setReceiptFile]    = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [submitting,     setSubmitting]     = useState(false);
  const [txId,           setTxId]           = useState('');

  const fileRef = useRef<HTMLInputElement>(null);

  // Wallet addresses + min/max amounts always come live from the backend so
  // the admin can change/replace them at any time without a redeploy.
  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/wallet/methods')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const list: DepositMethodDTO[] = Array.isArray(data?.methods) ? data.methods : [];
        setMethods(list.filter(m => m.type === 'crypto' && m.isActive));
      })
      .catch(() => { if (!cancelled) showToast('Could not load deposit methods — check your connection'); })
      .finally(() => { if (!cancelled) setLoadingMethods(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const coins = Array.from(new Set(
      methods.map(m => m.currency).filter(c => c && c !== 'USDT' && c !== 'USDC')
    ));
    if (coins.length === 0) return;
    const symbols = JSON.stringify(coins.map(c => `${c}USDT`));
    fetch(`https://api.binance.com/api/v3/ticker/price?symbols=${encodeURIComponent(symbols)}`)
      .then(r => r.json())
      .then((rows: { symbol: string; price: string }[]) => {
        if (!Array.isArray(rows)) return;
        const map: Record<string, number> = {};
        for (const row of rows) {
          const coin = coins.find(c => `${c}USDT` === row.symbol);
          if (coin) map[coin] = parseFloat(row.price);
        }
        setPrices(map);
      })
      .catch(() => {}); // purely cosmetic — silently skip if Binance is unreachable
  }, [methods]);

  function usdtEquivalent(curr: string, amt: number): number | null {
    if (!amt || isNaN(amt)) return null;
    if (curr === 'USDT' || curr === 'USDC') return amt;
    const p = prices[curr];
    return p ? amt * p : null;
  }

  // Every method's minimum should be worth the same ~$20 in USDT, no matter
  // the coin. USDT/USDC keep whatever the admin set directly (they're 1:1
  // already); every other coin's minimum is derived live from its USDT
  // price instead of a raw admin-entered coin number, so it never shows
  // something like "Min 20 BTC" again. Falls back to the admin's stored
  // minAmount only until the live price has loaded.
  const usdtAnchor = methods.find(m => m.currency === 'USDT')?.minAmount ?? 20;
  function liveMinAmount(m: DepositMethodDTO): number {
    if (m.currency === 'USDT' || m.currency === 'USDC') return m.minAmount;
    const p = prices[m.currency];
    return p ? usdtAnchor / p : m.minAmount;
  }

  const sortedMethods = [...methods].sort((a, b) => {
    const ia = METHOD_ORDER.indexOf(a.name), ib = METHOD_ORDER.indexOf(b.name);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });

  // If the user tapped "Use Code" on an Event, arrive here with it
  // pre-filled — then clear it from the store so it isn't reused if they
  // close and reopen the deposit screen fresh later.
  useEffect(() => {
    if (pendingPromoCode) {
      setPromoCode(pendingPromoCode);
      setPendingPromoCode(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live preview: debounced check against the backend so the user sees the
  // bonus % (and whether the code is actually valid for them) before they
  // ever submit. No side effects — nothing is reserved by this call.
  useEffect(() => {
    const code = promoCode.trim();
    if (!code) { setPromoStatus('idle'); setPromoBonusPct(null); return; }
    setPromoStatus('checking');
    const handle = setTimeout(() => {
      apiFetch(`/api/wallet/validate-promo?code=${encodeURIComponent(code)}`)
        .then(r => r.json())
        .then(data => {
          if (data?.valid) { setPromoStatus('valid'); setPromoBonusPct(data.bonusPct ?? null); }
          else { setPromoStatus('invalid'); setPromoBonusPct(null); }
        })
        .catch(() => { setPromoStatus('invalid'); setPromoBonusPct(null); });
    }, 500);
    return () => clearTimeout(handle);
  }, [promoCode]);

  const minAmount = crypto ? liveMinAmount(crypto) : 20;
  const currency  = crypto?.currency || 'USDT';
  const meta      = crypto ? getCryptoMeta(crypto.name) : { color: '#00D68F', network: '' };

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function reset() {
    setStep('select'); setCrypto(null);
    setFullName(''); setAmount('');
    setReceiptFile(null); setReceiptPreview(null); setTxId('');
    setPromoCode(''); setPromoStatus('idle'); setPromoBonusPct(null);
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setReceiptFile(f);
    setReceiptPreview(URL.createObjectURL(f));
  }

  function goToPayment() {
    const amt = parseFloat(amount);
    if (!fullName.trim()) { showToast('Please enter your name'); return; }
    if (!amount || isNaN(amt) || amt < minAmount) {
      showToast(`Minimum deposit is ${formatCoinAmount(minAmount)} ${currency}`); return;
    }
    setStep('payment');
  }

  async function confirmDeposit() {
    if (isDemo) {
      showToast('Create a real account to make a deposit');
      setOverlay('none');
      setScreen('register');
      return;
    }
    if (!receiptFile) { showToast('Please upload your payment receipt'); return; }
    if (!crypto) return;
    setSubmitting(true);

    try {
      const form = new FormData();
      form.append('amount', amount);
      form.append('method', crypto.name);
      form.append('currency', currency);
      form.append('fullName', fullName);
      form.append('proof', receiptFile);
      // Send the code as long as the user typed one — do NOT gate this on
      // promoStatus. promoStatus is set by a 500ms-debounced background
      // check; if the user hits Confirm quickly after typing the code,
      // promoStatus can still be 'checking' (not yet 'valid') at this exact
      // moment, so the old `promoStatus === 'valid'` guard silently dropped
      // the code — the deposit went through as a normal deposit with no
      // bonus and no error telling the user why. The backend already
      // re-validates the code itself (validateAndReservePromoCode) and
      // returns a clear 400 error if it's actually invalid/already used,
      // so it's the correct single source of truth here — no need to
      // duplicate/race that check on the client.
      if (promoCode.trim()) form.append('promoCode', promoCode.trim());

      const res = await apiFetch('/api/wallet/deposit', { method: 'POST', body: form });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.error || 'Deposit request failed — please try again');
        setSubmitting(false);
        return;
      }

      const id = data.txId || data.id || `dep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setTxId(id);

      const tx: Transaction = {
        id,
        type: 'deposit',
        desc: `${crypto.name} Deposit`,
        amount: parseFloat(amount),
        status: 'pending',
        date: Date.now(),
        method: crypto.name,
        currency,
      };
      addTransaction(tx);
      setStep('done');
    } catch {
      showToast('Connection error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  async function copyAddress() {
    const addr = crypto?.walletAddress;
    if (!addr) return;
    await navigator.clipboard.writeText(addr).catch(() => {});
    setCopied(true);
    showToast('Copied!');
    setTimeout(() => setCopied(false), 2000);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="fullscreen dep-fullscreen">
      {/* Header */}
      <div className="fs-header">
        <button className="fs-back" onClick={
          step === 'select' || step === 'done' ? () => setOverlay('none')
          : step === 'payment' ? () => setStep('form')
          : reset
        }>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="fs-title">
          {step === 'select' ? t('dep.title') : step === 'form' ? `${t('dep.title').split(' ')[0]} ${crypto?.name || ''}` : step === 'payment' ? t('dep.paymentDetails') : t('dep.submitted')}
        </span>
        <button style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', padding:4 }} onClick={() => setOverlay('none')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {/* Step indicator */}
      {step !== 'done' && (
        <div className="dep-step-track">
          {STEP_ORDER.map((s, i) => (
            <div key={s} className="seg">
              <div className={`fill ${STEP_ORDER.indexOf(step) >= i ? 'done' : ''}`} />
            </div>
          ))}
        </div>
      )}

      <div className="fs-body" style={{ paddingTop: step === 'done' ? 32 : 16 }}>

        {/* ── STEP 1: SELECT METHOD ────────────────────────────────────────── */}
        {step === 'select' && (
          <>
            <div className="dep-eyebrow">{t('dep.availableMethods')}</div>
            {loadingMethods && (
              <div style={{ padding: '24px 0', textAlign: 'center' }}>
                <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 10px' }} />
                <div style={{ fontSize: 12, color: 'var(--t4)' }}>Loading deposit methods…</div>
              </div>
            )}
            {!loadingMethods && methods.length === 0 && (
              <div className="dep-glass" style={{ padding: '16px', fontSize: 12.5, color: 'var(--t4)', textAlign: 'center' }}>
                No deposit methods are available right now — please try again shortly or contact support.
              </div>
            )}
            {!loadingMethods && methods.length > 0 && (
              <div className="dep-method-list">
                {sortedMethods.map(m => {
                  const mm = getCryptoMeta(m.name);
                  const min = liveMinAmount(m);
                  const eq = usdtEquivalent(m.currency, min);
                  return (
                    <button key={m._id} className="dep-glass dep-method-card"
                      style={{ '--mc': mm.color, '--mc-glow': `${mm.color}55` } as React.CSSProperties}
                      onClick={() => { setCrypto(m); setStep('form'); }}>
                      <CryptoIcon symbol={m.currency} size={42} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div className="dep-method-name">{m.name}</div>
                        <div className="dep-method-sub">
                          {mm.network ? `${t('dep.network')}: ${mm.network} · ` : ''}{t('dep.min')} {formatCoinAmount(min)} {m.currency}
                          {eq && m.currency !== 'USDT' ? ` (≈ $${eq.toLocaleString(undefined, { maximumFractionDigits: 2 })})` : ''}
                        </div>
                      </div>
                      <svg className="dep-method-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── STEP 2: FORM ──────────────────────────────────────────────────── */}
        {step === 'form' && crypto && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Method badge */}
            <div className="dep-glass" style={{ display:'flex', alignItems:'center', gap:12, padding:'13px 15px', '--mc': meta.color } as React.CSSProperties}>
              <CryptoIcon symbol={crypto.currency} size={38} />
              <div>
                <div className="dep-method-name" style={{ fontSize:13.5 }}>{crypto.name}</div>
                <div className="dep-method-sub">
                  {t('dep.min')} {formatCoinAmount(minAmount)} {currency}
                  {(() => { const eq = usdtEquivalent(currency, minAmount); return eq && currency !== 'USDT' ? ` ≈ $${eq.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : ''; })()}
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="dep-field">
              <label>{t('dep.fullName')}</label>
              <input placeholder={t('dep.fullNamePlaceholder')} value={fullName} onChange={e => setFullName(e.target.value)} />
            </div>

            {/* Amount */}
            <div className="dep-field">
              <label>{t('dep.amount')} ({currency})</label>
              <div className="dep-glass dep-amount-shell">
                <span className="cur">{currency}</span>
                <input type="number" min={minAmount}
                  placeholder={`Min ${formatCoinAmount(minAmount)}`}
                  value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              {currency !== 'USDT' && (() => {
                const eq = usdtEquivalent(currency, parseFloat(amount));
                return eq ? (
                  <div style={{ fontSize: 11.5, color: 'var(--t4)', marginTop: -6 }}>≈ ${eq.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT</div>
                ) : null;
              })()}
              <div className="dep-chip-row">
                {[25, 50, 100, 250].map(v => (
                  <button
                    key={v}
                    type="button"
                    className={`dep-chip${amount === String(v) ? ' active' : ''}`}
                    onClick={() => setAmount(String(v))}
                  >
                    {v.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* Promo / Bonus code — optional */}
            <div className="dep-field">
              <label>Promo Code <span style={{ color: 'var(--t4)', fontWeight: 400 }}>(optional)</span></label>
              <div className={`dep-promo-box ${promoStatus}`}>
                <span className="dep-promo-ico">🎁</span>
                <input
                  placeholder="Have a bonus code?"
                  value={promoCode}
                  onChange={e => setPromoCode(e.target.value.toUpperCase())}
                  className="dep-promo-input"
                />
                {promoStatus === 'checking' && <div className="spinner" style={{ width: 14, height: 14 }} />}
                {promoStatus === 'valid' && (
                  <span className="dep-promo-badge">+{promoBonusPct}% ✓</span>
                )}
                {promoStatus === 'invalid' && (
                  <span className="dep-promo-invalid">Invalid</span>
                )}
              </div>
            </div>

            {/* Summary */}
            {amount && parseFloat(amount) >= minAmount && (
              <div className="dep-glass" style={{ padding:'14px 16px', borderColor: 'rgba(0,214,143,.25)' }}>
                <div style={{ color:'var(--t3)', marginBottom:4, fontSize:13 }}>{t('dep.willSend')}</div>
                <div className="dep-headline" style={{ fontSize:22, color:'var(--g0)', fontFamily:"'JetBrains Mono'" }}>
                  {parseFloat(amount).toLocaleString()} {currency}
                </div>
                {promoStatus === 'valid' && promoBonusPct && (
                  <div style={{ marginTop: 8, fontSize: 12.5, color: '#FFA53D', fontWeight: 700 }}>
                    🎁 + {(parseFloat(amount) * promoBonusPct / 100).toLocaleString()} {currency} bonus ({promoBonusPct}%)
                  </div>
                )}
              </div>
            )}

            <button className="dep-btn-primary" onClick={goToPayment} style={{ marginTop:4 }}>
              {t('dep.continue')}
            </button>
          </div>
        )}

        {/* ── STEP 3: PAYMENT DETAILS — the ticket ───────────────────────────── */}
        {step === 'payment' && crypto && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Instruction */}
            <div className="dep-glass" style={{ padding:'13px 15px', fontSize:13, color:'var(--t3)', lineHeight:1.7, borderColor:'rgba(59,130,246,.22)' }}>
              Send <strong style={{ color:'var(--t1)' }}>{amount} {currency}</strong> to the address below, then upload your transfer receipt.
            </div>

            {/* The ticket */}
            <div className="dep-glass dep-ticket" style={{ '--mc': meta.color } as React.CSSProperties}>
              <div className="dep-ticket-top">
                <div className="dep-method-ico" style={{ width:44, height:44, padding:0, background:'none', boxShadow:'none' }}>
                  <CryptoIcon symbol={crypto.currency} size={44} />
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div className="dep-ticket-label">{meta.network || t('app.panel.deposit')}</div>
                  <div className="dep-method-name" style={{ fontSize:15 }}>{crypto.name}</div>
                </div>
                <div style={{ textAlign:'right' }}>
                  <div className="dep-ticket-label">{t('dep.amount')}</div>
                  <div className="dep-ticket-amount" style={{ fontSize:20 }}>{amount || '0'} <span style={{ fontSize:12, color:'var(--t4)' }}>{currency}</span></div>
                </div>
              </div>

              <div className="dep-ticket-notch-row" />

              {crypto.walletAddress && (
                <div className="dep-qr-wrap">
                  <img
                    className="dep-qr-img"
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(crypto.walletAddress)}`}
                    alt={`${crypto.name} deposit address QR code`}
                    width={180} height={180}
                  />
                </div>
              )}

              <div className="dep-ticket-bottom">
                <div className="dep-ticket-label">{t('dep.walletAddress')}</div>
                <div className="dep-addr-shell">
                  <div className="dep-addr-text">
                    {crypto.walletAddress || '—'}
                  </div>
                  <button className={`dep-copy-btn ${copied ? 'copied' : ''}`} onClick={copyAddress}>
                    {copied ? (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    )}
                    {copied ? t('dep.copied') : t('dep.copy')}
                  </button>
                </div>
                {meta.network && (
                  <div style={{ marginTop:10, fontSize:11, color:'var(--t4)' }}>{t('dep.network')}: <strong style={{ color:'var(--t2)' }}>{meta.network}</strong></div>
                )}
              </div>
            </div>

            {/* Receipt upload */}
            <div>
              <div className="dep-eyebrow" style={{ marginBottom:8 }}>{t('dep.uploadReceipt')}</div>
              <div
                className={`dep-glass dep-dropzone ${receiptFile ? 'has-file' : ''}`}
                onClick={() => fileRef.current?.click()}>
                {receiptPreview ? (
                  <>
                    <img src={receiptPreview} alt="Receipt"
                      style={{ maxWidth:'100%', maxHeight:180, borderRadius:14, objectFit:'contain', marginBottom:10 }} />
                    <div style={{ fontSize:12, color:'var(--g0)', fontWeight:700 }}>{receiptFile?.name}</div>
                    <div style={{ fontSize:11, color:'var(--t4)', marginTop:4 }}>{t('dep.tapToChange')}</div>
                  </>
                ) : (
                  <>
                    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="var(--t4)" strokeWidth="1.5" style={{ margin:'0 auto 12px' }}>
                      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <div style={{ fontSize:14, fontWeight:700, color:'var(--t2)', marginBottom:4, fontFamily:"'Outfit','Inter',sans-serif" }}>{t('dep.tapToUpload')}</div>
                    <div style={{ fontSize:12, color:'var(--t4)' }}>{t('dep.fileTypes')}</div>
                  </>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*,application/pdf" style={{ display:'none' }} onChange={handleFile} />
            </div>

            <button
              className="dep-btn-primary"
              onClick={confirmDeposit}
              disabled={submitting || !receiptFile}
            >
              {submitting ? '' : t('dep.confirmDeposit')}
            </button>

            <div className="dep-glass" style={{ padding:'12px 15px', fontSize:12, color:'var(--t4)', lineHeight:1.7 }}>
              <strong style={{ color:'var(--t2)', display:'block', marginBottom:4, fontFamily:"'Outfit','Inter',sans-serif" }}>How it works</strong>
              1. Send the exact amount to the address above<br/>
              2. Upload a screenshot of your payment<br/>
              3. Tap <strong>Confirm Deposit</strong> — reviewed within <strong style={{ color:'var(--g0)' }}>15–30 min</strong>
            </div>
          </div>
        )}

        {/* ── STEP 4: DONE ────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div style={{ textAlign:'center', padding:'20px 0' }}>
            <div style={{
              width:80, height:80, borderRadius:'50%',
              background:'rgba(0,214,143,.1)', border:'2px solid rgba(0,214,143,.3)',
              display:'flex', alignItems:'center', justifyContent:'center',
              margin:'0 auto 20px', animation:'bounceIn .5s var(--ease)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--g0)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </div>

            <div className="dep-headline" style={{ fontSize:22, marginBottom:8 }}>{t('dep.receiptSubmitted')}</div>
            <div style={{ fontSize:13, color:'var(--t3)', lineHeight:1.8, marginBottom:20 }}>
              {t('dep.underReview')}<br/>
              {t('dep.fundsAppear1530')}
            </div>

            <div className="dep-glass" style={{ padding:'14px 16px', marginBottom:16, textAlign:'left', borderColor:'rgba(245,158,11,.3)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div className="spinner" style={{ width:18, height:18, borderColor:'rgba(245,158,11,.2)', borderTopColor:'#F59E0B' }} />
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#F59E0B' }}>{t('dep.processing')}</div>
                  <div style={{ fontSize:11, color:'var(--t4)', marginTop:2 }}>{t('dep.fundsAppear1530')}</div>
                </div>
              </div>
            </div>

            {txId && (
              <div className="dep-glass" style={{ padding:'11px 15px', marginBottom:16, textAlign:'left' }}>
                <div style={{ fontSize:10, color:'var(--t4)', fontWeight:700, textTransform:'uppercase', letterSpacing:'.5px' }}>{t('dep.transactionId')}</div>
                <div style={{ fontSize:12, fontFamily:'JetBrains Mono', color:'var(--t2)', marginTop:4, wordBreak:'break-all' }}>{txId}</div>
              </div>
            )}

            <button className="dep-btn-primary" onClick={() => setOverlay('transfers')} style={{ marginBottom:10 }}>
              {t('dep.viewHistory')}
            </button>
            <button style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', fontSize:13, fontFamily:'inherit', display:'block', margin:'0 auto' }} onClick={() => setOverlay('none')}>
              {t('dep.close')}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
