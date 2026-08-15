import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { apiFetch } from '../../lib/api';
import { subscribeTransactions } from '../../lib/liveSocket';
import type { Transaction } from '../../types';
import { getCryptoMeta, type DepositMethodDTO } from '../../lib/paymentMethods';
import { CryptoIcon } from '../PaymentIcons';
import { useI18n } from '../../lib/i18n';

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function statusColor(s: string) {
  if (s === 'completed') return 'var(--g0)';
  if (s === 'processing') return '#F59E0B';
  if (s === 'rejected')  return 'var(--red)';
  return '#60A5FA';
}
function statusLabel(s: string, t: (k: string) => string) {
  if (s === 'completed')  return t('wd.completed');
  if (s === 'processing') return t('wd.processingStatus');
  if (s === 'rejected')   return t('wd.rejected');
  return t('wd.pendingStatus');
}

export default function TransfersScreen() {
  const { t } = useI18n();
  const setOverlay         = useStore(s => s.setOverlay);
  const showToast          = useStore(s => s.showToast);
  const realBalance        = useStore(s => s.realBalance);
  const setRealBalance     = useStore(s => s.setRealBalance);
  const transactions       = useStore(s => s.transactions);
  const addTransaction     = useStore(s => s.addTransaction);
  const updateTransactionStatus = useStore(s => s.updateTransactionStatus);
  const transfersTab       = useStore(s => s.transfersTab);
  const userInfo           = useStore(s => s.userInfo);
  const setScreen          = useStore(s => s.setScreen);
  const isDemo = !userInfo?.token || userInfo.token === 'demo';
  const [tab, setTab]      = useState<'history' | 'withdraw'>(transfersTab);
  const [methods, setMethods] = useState<DepositMethodDTO[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [method, setMethod]= useState('');
  const [amount, setAmount]= useState('');
  const [account, setAccount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<'all'|'deposit'|'withdrawal'>('all');

  // Profit Cap plan detail (see /api/trade/balance) — how much of the
  // bonus's profit is actually withdrawable right now, on top of the
  // user's own real balance, plus enough context to explain why.
  interface BonusInfo { granted: number; profitCap: number; turnoverRequired: number; turnoverProgress: number; eligibleProfit: number; forfeited: boolean; expiresAt: string | null; }
  const [bonusInfo, setBonusInfo] = useState<BonusInfo | null>(null);
  useEffect(() => {
    if (isDemo) return;
    apiFetch('/api/trade/balance')
      .then(r => r.json())
      .then(data => { if (data?.bonus) setBonusInfo(data.bonus); })
      .catch(() => {});
  }, [isDemo]);

  // Live push — the moment staff confirm/reject a deposit or withdrawal,
  // this updates instantly instead of waiting for the next screen open.
  useEffect(() => {
    const unsub = subscribeTransactions((update) => {
      if (!update?.txId) return;
      const newStatus = update.status === 'confirmed' ? 'completed' : update.status === 'rejected' ? 'rejected' : 'pending';
      updateTransactionStatus(update.txId, newStatus);

      if (update.status === 'confirmed' && update.type === 'deposit') {
        useStore.getState().setRealBalance(useStore.getState().realBalance + Math.abs(update.amount || 0));
        showToast(`✅ Deposit confirmed — ${update.amount} credited to your account`);
      } else if (update.status === 'rejected' && update.type === 'deposit') {
        showToast(`❌ Deposit rejected${update.note ? ': ' + update.note : ''}`);
      } else if (update.status === 'confirmed' && update.type === 'withdrawal') {
        showToast('✅ Withdrawal confirmed and sent');
      } else if (update.status === 'rejected' && update.type === 'withdrawal') {
        useStore.getState().setRealBalance(useStore.getState().realBalance + Math.abs(update.amount || 0));
        showToast(`❌ Withdrawal rejected — funds returned to your balance${update.note ? ': ' + update.note : ''}`);
      }
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh from the server on open — and critically, also RE-SYNC the
  // status of transactions that already exist locally (not just add new
  // ones). Previously a transaction already in local state was skipped
  // entirely here, so a deposit/withdrawal that staff had confirmed or
  // rejected while this screen was closed kept showing as "Pending"
  // forever, since the only other status updates came from a live socket
  // subscription that only exists while this screen happens to be open.
  useEffect(() => {
    apiFetch('/api/wallet/transactions')
      .then(r => r.json())
      .then(data => {
        const list = Array.isArray(data?.transactions) ? data.transactions : [];
        const existing = useStore.getState().transactions;
        const existingIds = new Set(existing.map(t => t.id));
        list.forEach((tx: any) => {
          const id = tx.txId || tx._id;
          if (!id) return;
          const serverStatus: Transaction['status'] =
            tx.status === 'confirmed' ? 'completed' : tx.status === 'rejected' ? 'rejected' : 'pending';

          if (existingIds.has(id)) {
            // Already known locally — make sure its status matches the
            // server's current (authoritative) status instead of staying
            // stuck on whatever it was when it was first added.
            updateTransactionStatus(id, serverStatus);
            return;
          }

          existingIds.add(id);
          const type: 'deposit' | 'withdrawal' = tx.type === 'withdrawal' ? 'withdrawal' : 'deposit';
          const signedAmount = type === 'withdrawal' ? -Math.abs(tx.amount) : Math.abs(tx.amount);
          addTransaction({
            id,
            type,
            desc: `${tx.method || ''} ${type === 'withdrawal' ? 'Withdrawal' : 'Deposit'}`.trim(),
            amount: signedAmount,
            status: serverStatus,
            date: tx.createdAt ? new Date(tx.createdAt).getTime() : Date.now(),
            method: tx.method,
            currency: (tx.method || '').split(' ')[0] || undefined,
          });
        });
      })
      .catch(() => {});
  }, []);

  // Withdrawal methods now come straight from the backend — crypto only, no
  // Egyptian e-wallets, and always in sync with whatever the admin has set.
  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/wallet/methods')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const list: DepositMethodDTO[] = Array.isArray(data?.methods) ? data.methods : [];
        setMethods(list.filter(m => m.type === 'crypto' && m.isActive));
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingMethods(false); });
    return () => { cancelled = true; };
  }, []);

  const withdrawMethods = methods.map(m => ({ id: m.name, label: m.name, symbol: m.currency }));
  const selectedMethod = methods.find(m => m.name === method);

  const filtered = transactions.filter(tx => filterType === 'all' ? true : tx.type === filterType);

  async function submitWithdraw() {
    if (isDemo) {
      showToast('Create a real account to withdraw funds');
      setOverlay('none');
      setScreen('register');
      return;
    }
    const v = parseFloat(amount);
    const withdrawable = realBalance + (bonusInfo?.eligibleProfit ?? 0);
    if (!method) { showToast('Please select a withdrawal method'); return; }
    if (!amount || isNaN(v) || v < 20) { showToast('Minimum withdrawal is $20'); return; }
    if (v > withdrawable) {
      showToast(`Max withdrawable right now: $${withdrawable.toFixed(2)}`);
      return;
    }
    if (!account.trim())               { showToast('Enter your crypto wallet address'); return; }
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/wallet/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: v, method, walletAddress: account.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { showToast(data.error || 'Withdrawal failed'); return; }

      const tx: Transaction = {
        id:     data.txId || data.id || `wd_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,
        type:   'withdrawal',
        desc:   `${withdrawMethods.find(m => m.id === method)?.label || method} Withdrawal`,
        amount: -v,
        status: 'pending',
        date:   Date.now(),
        method,
        currency: selectedMethod?.currency || 'USD',
      };
      addTransaction(tx);
      setRealBalance(Math.max(0, realBalance - v));
      showToast('Withdrawal request submitted! Processing in 1–3 business days.');
      setAmount(''); setAccount(''); setMethod('');
      setTab('history');
    } catch {
      showToast('Connection error — please try again');
    } finally {
      setSubmitting(false);
    }
  }

  const totalDeposited  = transactions.filter(tx => tx.type === 'deposit'    && tx.status === 'completed').reduce((a, tx) => a + Math.abs(tx.amount), 0);
  const totalWithdrawn  = transactions.filter(tx => tx.type === 'withdrawal' && tx.status === 'completed').reduce((a, tx) => a + Math.abs(tx.amount), 0);
  const pendingCount    = transactions.filter(tx => tx.status === 'pending' || tx.status === 'processing').length;
  const selectedColor   = (selectedMethod ? getCryptoMeta(selectedMethod.name).color : '') || '#00D68F';

  return (
    <div className="fullscreen dep-fullscreen">
      <div className="fs-header">
        <button className="fs-back" onClick={() => setOverlay('panel')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <span className="fs-title">{t('wd.title')}</span>
        <button style={{ background:'none', border:'none', color:'var(--t4)', cursor:'pointer', padding:4 }} onClick={() => setOverlay('none')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="fs-body">
        {/* Quick action cards */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
          <div className="dep-glass" style={{ padding:15, cursor:'pointer', display:'flex', alignItems:'flex-start', justifyContent:'space-between', '--mc':'#00D68F', '--mc-glow':'rgba(0,214,143,.35)' } as React.CSSProperties}
            onClick={() => setOverlay('deposit')}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#00D68F'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; }}
          >
            <div>
              <div className="dep-eyebrow" style={{ marginBottom: 6 }}>{t('app.panel.deposit')}</div>
              <div className="dep-headline" style={{ fontSize:17, color:'var(--g0)', fontFamily:"'JetBrains Mono'" }}>{t('wd.addFunds')}</div>
            </div>
            <div style={{ width:30, height:30, borderRadius:9, background:'rgba(0,214,143,.14)', color:'var(--g0)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
            </div>
          </div>
          <div className="dep-glass" style={{ padding:15, cursor:'pointer', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}
            onClick={() => setTab('withdraw')}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#3B82F6'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.borderColor = ''; }}
          >
            <div>
              <div className="dep-eyebrow" style={{ marginBottom: 6 }}>{t('wd.withdraw')}</div>
              <div className="dep-headline" style={{ fontSize:17, color:'#3B82F6', fontFamily:"'JetBrains Mono'" }}>${realBalance.toFixed(2)}</div>
            </div>
            <div style={{ width:30, height:30, borderRadius:9, background:'rgba(59,130,246,.14)', color:'#3B82F6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2"/><path d="M1 10h22"/></svg>
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:16 }}>
          {[
            { label:t('wd.deposited'), val:`$${totalDeposited.toFixed(0)}`, color:'var(--g0)' },
            { label:t('wd.withdrawn'), val:`$${totalWithdrawn.toFixed(0)}`, color:'var(--red)' },
            { label:t('wd.pending'),   val:String(pendingCount),           color:'#F59E0B' },
          ].map(s => (
            <div key={s.label} className="dep-glass" style={{ padding:'11px 8px', textAlign:'center' }}>
              <div className="dep-headline" style={{ fontSize:15, color:s.color, fontFamily:"'JetBrains Mono'" }}>{s.val}</div>
              <div style={{ fontSize:9.5, color:'var(--t4)', fontWeight:700, marginTop:3, textTransform:'uppercase', letterSpacing:'.4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="dep-glass" style={{ display:'flex', padding:4, gap:4, marginBottom:16, borderRadius:999 }}>
          {(['history','withdraw'] as const).map(tabId => (
            <button key={tabId} onClick={() => setTab(tabId)} style={{
              flex:1, padding:'10px 0', borderRadius:999, fontSize:13, fontWeight:700, fontFamily:"'Outfit','Inter',sans-serif",
              background: tab === tabId ? 'linear-gradient(135deg, var(--g0), #00A3E0)' : 'transparent',
              color: tab === tabId ? '#04120C' : 'var(--t3)',
              border:'none', cursor:'pointer', transition:'all .2s var(--ease)',
            }}>
              {tabId === 'history' ? t('wd.transactionHistory') : t('wd.withdrawFunds')}
            </button>
          ))}
        </div>

        {/* ── HISTORY TAB ── */}
        {tab === 'history' && (
          <>
            <div className="dep-chip-row" style={{ marginBottom:14, marginTop:0 }}>
              {(['all','deposit','withdrawal'] as const).map(f => (
                <button key={f} onClick={() => setFilterType(f)} className={`dep-chip${filterType === f ? ' active' : ''}`} style={{ flex:'0 1 auto', padding:'7px 16px' }}>
                  {f === 'all' ? t('wd.all') : f === 'deposit' ? t('wd.deposits') : t('wd.withdrawals')}
                </button>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="dep-glass" style={{ textAlign:'center', padding:'40px 20px', color:'var(--t4)' }}>
                <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ margin:'0 auto 14px', opacity:.4 }}><path d="M9 17H7A5 5 0 017 7h10a5 5 0 010 10h-2"/><path d="M12 12v5m0 0l-2-2m2 2l2-2"/></svg>
                <div className="dep-headline" style={{ fontSize:14, color:'var(--t3)' }}>{t('wd.noTransactions')}</div>
                <div style={{ fontSize:12, marginTop:4 }}>{t('wd.noTransactionsSub')}</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:9 }}>
                {filtered.map(tx => (
                  <TxCard key={tx.id} tx={tx} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── WITHDRAW TAB ── */}
        {tab === 'withdraw' && (() => {
          const eligibleProfit = bonusInfo?.eligibleProfit ?? 0;
          const withdrawable = realBalance + eligibleProfit;
          const turnoverPct = bonusInfo && bonusInfo.turnoverRequired > 0
            ? Math.min(100, Math.round((bonusInfo.turnoverProgress / bonusInfo.turnoverRequired) * 100))
            : 100;
          const turnoverMet = !bonusInfo || bonusInfo.turnoverRequired === 0 || bonusInfo.turnoverProgress >= bonusInfo.turnoverRequired;
          return (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Withdrawable balance ticket */}
            <div className="dep-glass dep-ticket">
              <div className="dep-ticket-top" style={{ flexDirection:'column', alignItems:'flex-start', gap:4 }}>
                <div className="dep-ticket-label">{t('wd.withdrawableBalance')}</div>
                <div className="dep-ticket-amount" style={{ fontSize:32 }}>${withdrawable.toFixed(2)}</div>
              </div>
              <div className="dep-ticket-notch-row" />
              <div className="dep-ticket-bottom" style={{ fontSize:11.5, color:'var(--t4)' }}>
                {t('wd.realBalanceLabel')} ${realBalance.toFixed(2)}
                {eligibleProfit > 0 ? ` · Bonus profit unlocked $${eligibleProfit.toFixed(2)}` : ''} · {t('wd.businessDays')}
              </div>
            </div>

            {/* Bonus Profit Cap progress — only shown once a bonus has ever been granted */}
            {bonusInfo && bonusInfo.granted > 0 && !bonusInfo.forfeited && (
              <div className="dep-glass" style={{ padding:'14px 15px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:8 }}>
                  <span className="dep-eyebrow" style={{ margin:0 }}>Bonus Profit Cap</span>
                  <span style={{ fontSize:12, fontWeight:800, color:'var(--g0)', fontFamily:'JetBrains Mono' }}>
                    ${eligibleProfit.toFixed(2)} <span style={{ color:'var(--t4)', fontWeight:600 }}>/ ${bonusInfo.profitCap.toFixed(2)}</span>
                  </span>
                </div>
                {!turnoverMet ? (
                  <>
                    <div style={{ height:6, borderRadius:999, background:'var(--bg3)', overflow:'hidden', marginBottom:6 }}>
                      <div style={{ height:'100%', width:`${turnoverPct}%`, background:'linear-gradient(90deg, #F59E0B, var(--g0))', transition:'width .3s var(--ease)' }} />
                    </div>
                    <div style={{ fontSize:11, color:'var(--t4)' }}>
                      Trade ${bonusInfo.turnoverRequired.toFixed(0)} of volume to unlock bonus profit — ${bonusInfo.turnoverProgress.toFixed(0)} so far ({turnoverPct}%)
                    </div>
                  </>
                ) : (
                  <div style={{ fontSize:11, color:'var(--t4)' }}>
                    Turnover requirement cleared — bonus profit is withdrawable up to the cap above.
                  </div>
                )}
              </div>
            )}

            {bonusInfo?.forfeited && (
              <div className="dep-glass" style={{ padding:'12px 14px', fontSize:12, color:'var(--red)', borderColor:'rgba(255,61,87,.25)' }}>
                <strong>⚠ Bonus forfeited</strong> — a real-balance withdrawal was made before the turnover requirement was met, so the bonus and its profit are no longer withdrawable.
              </div>
            )}

            <div className="dep-field">
              <label>{t('wd.withdrawalMethod')}</label>
              {loadingMethods && (
                <div style={{ fontSize:12, color:'var(--t4)', padding:'8px 2px' }}>Loading methods…</div>
              )}
              {!loadingMethods && (
                <div className="dep-method-grid">
                  {withdrawMethods.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      className={`dep-glass dep-method-card${method === m.id ? ' selected' : ''}`}
                      style={{ '--mc': getCryptoMeta(m.label).color, '--mc-glow': `${getCryptoMeta(m.label).color}55` } as React.CSSProperties}
                      onClick={() => setMethod(m.id)}
                    >
                      <CryptoIcon symbol={m.symbol} size={36} />
                      <span className="dep-method-name">{m.label}</span>
                    </button>
                  ))}
                </div>
              )}
              {!loadingMethods && withdrawMethods.length === 0 && (
                <div style={{ fontSize:12, color:'var(--t4)', padding:'8px 2px' }}>{t('wd.noMethodsAvailable')}</div>
              )}
            </div>

            <div className="dep-field">
              <label>{t('wd.amountUsd')}</label>
              <div className="dep-glass dep-amount-shell">
                <span className="cur">$</span>
                <input type="number" min={20} placeholder={t('wd.minimumPlaceholder')} value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
              <div className="dep-chip-row">
                {[25, 50, 100, Math.max(20, Math.floor(withdrawable))].map((v, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`dep-chip${amount === String(v) ? ' active' : ''}`}
                    onClick={() => setAmount(String(v))}
                  >
                    {i === 3 ? t('wd.max') : v.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {selectedMethod && (
              <div className="dep-field">
                <label>{selectedMethod.name} {t('wd.address')}</label>
                <input
                  placeholder={t('wd.enterAddressPlaceholder')}
                  value={account} onChange={e => setAccount(e.target.value)} />
              </div>
            )}

            <div className="dep-glass" style={{ padding:'12px 14px', fontSize:12, color:'var(--t3)', lineHeight:1.6, borderColor:'rgba(255,61,87,.14)' }}>
              <strong style={{ color:'var(--t2)' }}>{t('wd.important')}</strong> {t('wd.importantNote')}
            </div>

            <button
              className="dep-btn-primary"
              style={{ background: `linear-gradient(135deg, ${selectedColor} 0%, #00A3E0 100%)`, boxShadow: `0 8px 24px -8px ${selectedColor}70, inset 0 1px 0 rgba(255,255,255,.3)` }}
              onClick={submitWithdraw} disabled={submitting}>
              {submitting ? '' : t('wd.submitRequest')}
            </button>
          </div>
          );
        })()}
      </div>
    </div>
  );
}

function TxCard({ tx }: { tx: Transaction }) {
  const { t } = useI18n();
  const isIn = tx.amount > 0;
  const typeColor = isIn ? 'var(--g0)' : 'var(--red)';
  const typeBg    = isIn ? 'rgba(0,230,118,.1)' : 'rgba(255,61,87,.1)';

  return (
    <div className="dep-glass" style={{ padding:'14px 15px 11px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:11 }}>
        <div style={{ width:40, height:40, borderRadius:12, display:'flex', alignItems:'center', justifyContent:'center', background: typeBg, flexShrink:0 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={typeColor} strokeWidth="2">
            {isIn
              ? <><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></>
              : <><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></>
            }
          </svg>
        </div>
        <div style={{ flex:1, minWidth:0 }}>
          <div className="dep-method-name" style={{ fontSize:13.5, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{tx.desc}</div>
          <div style={{ fontSize:11, color:'var(--t4)', marginTop:2 }}>{formatDate(tx.date)}</div>
        </div>
        <div style={{ textAlign:'right', flexShrink:0 }}>
          <div style={{ fontSize:15, fontWeight:800, color: typeColor, fontFamily:'JetBrains Mono' }}>
            {isIn ? '+' : ''}{Math.abs(tx.amount).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 })}
            <span style={{ fontSize:10, fontWeight:400, marginLeft:3 }}>{tx.currency || 'USD'}</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop:9, paddingTop:9, borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          {tx.method && <span style={{ fontSize:10, color:'var(--t4)', background:'var(--bg2)', padding:'3px 8px', borderRadius:999, fontWeight:600 }}>{tx.method}</span>}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          {(tx.status === 'pending' || tx.status === 'processing') && (
            <div className="spinner" style={{ width:10, height:10, borderWidth:1.5, borderColor:'rgba(245,158,11,.2)', borderTopColor:'#F59E0B' }} />
          )}
          <span style={{ fontSize:11, fontWeight:700, color: statusColor(tx.status) }}>{statusLabel(tx.status, t)}</span>
        </div>
      </div>
    </div>
  );
}
