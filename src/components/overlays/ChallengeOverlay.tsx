import { useState, useEffect } from 'react';
import { useStore } from '../../lib/store';
import { apiFetch } from '../../lib/api';
import type { UserChallenge } from '../../types';

function fmtMoney(n: number) {
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

export default function ChallengeOverlay() {
  const setOverlay        = useStore(s => s.setOverlay);
  const showToast         = useStore(s => s.showToast);
  const showConfirm       = useStore(s => s.showConfirm);
  const closeConfirm      = useStore(s => s.closeConfirm);
  const realBalance       = useStore(s => s.realBalance);
  const config             = useStore(s => s.challengeConfig);
  const activeChallenge    = useStore(s => s.activeChallenge);
  const fetchChallengeConfig = useStore(s => s.fetchChallengeConfig);
  const fetchActiveChallenge = useStore(s => s.fetchActiveChallenge);
  const joinChallenge      = useStore(s => s.joinChallenge);
  const setWalType         = useStore(s => s.setWalType);
  const userInfo           = useStore(s => s.userInfo);
  const setScreen          = useStore(s => s.setScreen);

  // Guest/demo browsing has no real account behind it (token === 'demo'),
  // so anything user-specific (history, joining) is off-limits — but the
  // rules/info screen itself stays visible so guests can preview it.
  const isDemo = !userInfo?.token || userInfo.token === 'demo';

  const [joining, setJoining] = useState(false);
  const [history, setHistory] = useState<UserChallenge[]>([]);
  const [, forceTick] = useState(0);

  useEffect(() => {
    fetchChallengeConfig();
    if (isDemo) return;
    fetchActiveChallenge();
    apiFetch('/api/challenge/history').then(r => r.json()).then(d => {
      if (Array.isArray(d?.history)) setHistory(d.history);
    }).catch(() => {});
    // Keep the "day X of 30" / countdown labels fresh while the sheet is open.
    const iv = setInterval(() => { forceTick(n => n + 1); fetchActiveChallenge(); }, 30000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleJoin() {
    if (!config) return;
    if (isDemo) {
      showToast('Create a real account to join the Challenge');
      setOverlay('none');
      setScreen('register');
      return;
    }
    if (realBalance < config.entryFee) {
      showToast(`You need at least ${fmtMoney(config.entryFee)} in your real balance to join`);
      return;
    }
    showConfirm(
      'Join the Challenge?',
      `${fmtMoney(config.entryFee)} will be deducted from your real balance right now. This can't be refunded once the challenge starts.`,
      async () => {
        closeConfirm();
        setJoining(true);
        const result = await joinChallenge();
        setJoining(false);
        if (result.ok) {
          showToast('🎉 Challenge joined — good luck!');
        } else {
          showToast(result.error || 'Failed to join the challenge');
        }
      }
    );
  }

  function startTrading() {
    setWalType('challenge');
    apiFetch('/api/trade/switch-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletType: 'challenge' }),
    }).catch(() => {});
    setOverlay('none');
    showToast('Challenge account active — trade carefully!');
  }

  const hasActive = activeChallenge && activeChallenge.status === 'active';

  return (
    <div className="overlay-bg" onClick={() => setOverlay('none')}>
      <div className="overlay-sheet" style={{ maxHeight: '90vh' }} onClick={e => e.stopPropagation()}>
        <div className="overlay-handle" />
        <div className="overlay-header">
          <span className="overlay-title">🏆 Trading Challenge</span>
          <button className="overlay-close" onClick={() => setOverlay('none')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="overlay-body">
          {hasActive
            ? <ActiveChallengeView challenge={activeChallenge as UserChallenge & { currentDay?: number }} onStartTrading={startTrading} />
            : <ChallengeDetails config={config} joining={joining} onJoin={handleJoin} history={history} />
          }
        </div>
      </div>
    </div>
  );
}

// ── "View Challenge" — rules + reward table + join button ────────────────────
function ChallengeDetails({
  config, joining, onJoin, history,
}: {
  config: ReturnType<typeof useStore.getState>['challengeConfig'];
  joining: boolean;
  onJoin: () => void;
  history: UserChallenge[];
}) {
  if (!config) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center' }}>
        <div className="spinner" style={{ width: 24, height: 24, margin: '0 auto 10px' }} />
        <div style={{ fontSize: 12, color: 'var(--t4)' }}>Loading challenge details…</div>
      </div>
    );
  }

  const lastResult = history[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Hero */}
      <div
        className="dep-glass"
        style={{
          padding: '22px 18px', textAlign: 'center',
          background: 'linear-gradient(160deg, rgba(168,85,247,.14), rgba(59,130,246,.08))',
          borderColor: 'rgba(168,85,247,.3)',
        }}
      >
        <div style={{ fontSize: 34, marginBottom: 6 }}>🏆</div>
        <div className="dep-headline" style={{ fontSize: 21, marginBottom: 4 }}>{config.title}</div>
        <div style={{ fontSize: 12.5, color: 'var(--t3)', lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
          {config.description}
        </div>
      </div>

      {lastResult && (
        <div
          className="dep-glass"
          style={{
            padding: '12px 14px', fontSize: 12.5,
            borderColor: lastResult.status === 'completed' ? 'rgba(0,214,143,.3)' : 'rgba(255,61,87,.25)',
            color: lastResult.status === 'completed' ? 'var(--g0)' : 'var(--red)',
          }}
        >
          {lastResult.status === 'completed'
            ? `✅ Your last challenge was a success — you won ${fmtMoney(lastResult.rewardAmount)}!`
            : `Your last attempt ended with ${lastResult.successfulDays} successful day(s) out of ${lastResult.durationDays}. Ready to try again?`}
        </div>
      )}

      {/* How it works */}
      <div className="dep-glass" style={{ padding: '16px 16px' }}>
        <div className="dep-eyebrow" style={{ marginBottom: 10 }}>The Goal</div>
        <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.7, fontWeight: 600 }}>
          Get a funded <span style={{ color: 'var(--g0)' }}>{fmtMoney(config.startingBalance)}</span> trading account and prove you can trade with discipline for {config.durationDays} days straight.
        </div>
      </div>

      {/* Daily rules */}
      <div className="dep-glass" style={{ padding: '16px 16px' }}>
        <div className="dep-eyebrow" style={{ marginBottom: 12 }}>Daily Target</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Rule icon="📊" text={<>Place <strong>{config.dailyTradesRequired}</strong> trades every day</>} />
          <Rule icon="✅" text={<>Win at least <strong style={{ color: 'var(--g0)' }}>{config.dailyWinsRequired}</strong> of them</>} />
          <Rule icon="⚠️" text={<>No more than <strong style={{ color: 'var(--red)' }}>{config.dailyMaxLosses}</strong> losses that day</>} />
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--t4)', marginTop: 10, fontStyle: 'italic' }}>
          Hit your target → that day counts as a win. Miss it → that day's a miss. No pressure — just trade your normal strategy.
        </div>
      </div>

      {/* Reward table */}
      <div className="dep-glass" style={{ padding: '16px 16px' }}>
        <div className="dep-eyebrow" style={{ marginBottom: 4 }}>Your Reward</div>
        <div style={{ fontSize: 11.5, color: 'var(--t4)', marginBottom: 12 }}>
          Based on how many of the {config.durationDays} days you hit your target (need at least {config.minSuccessDaysForReward} to unlock a reward)
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {config.rewardTiers.map(tier => (
            <div key={tier.successDays} className="dep-glass" style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderColor: 'rgba(0,214,143,.15)',
            }}>
              <span style={{ fontSize: 12.5, color: 'var(--t2)', fontWeight: 600 }}>
                {tier.successDays} / {config.durationDays} successful days
              </span>
              <span className="dep-headline" style={{ fontSize: 15, color: 'var(--g0)' }}>{fmtMoney(tier.reward)}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--t4)', marginTop: 10 }}>
          Fewer than {config.minSuccessDaysForReward} successful days by the end means the challenge doesn't pay out — the entry fee isn't refunded either way.
        </div>
      </div>

      {/* Fine print */}
      <div className="dep-glass" style={{ padding: '14px 16px', fontSize: 11.5, color: 'var(--t4)', lineHeight: 1.7 }}>
        <strong style={{ color: 'var(--t2)', display: 'block', marginBottom: 4 }}>The rules, in plain terms</strong>
        • Entry fee comes out of your real balance — never bonus funds.<br />
        • The {fmtMoney(config.startingBalance)} is a practice balance for the challenge only — it's not real money to withdraw.<br />
        • If you succeed, the cash reward is added to your real balance the moment the challenge ends.<br />
        • You can't withdraw anything challenge-related until the full {config.durationDays} days are over.
      </div>

      <button className="dep-btn-primary" disabled={joining} onClick={onJoin} style={{
        background: 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)',
        boxShadow: '0 8px 24px -8px rgba(168,85,247,.6), inset 0 1px 0 rgba(255,255,255,.3)',
      }}>
        {joining ? '' : `Join Now — ${fmtMoney(config.entryFee)}`}
      </button>
    </div>
  );
}

function Rule({ icon, text }: { icon: string; text: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 18, width: 26, textAlign: 'center' }}>{icon}</span>
      <span style={{ fontSize: 13, color: 'var(--t2)' }}>{text}</span>
    </div>
  );
}

// ── Active challenge — live day-by-day progress dashboard ────────────────────
function ActiveChallengeView({
  challenge, onStartTrading,
}: {
  challenge: UserChallenge & { currentDay?: number };
  onStartTrading: () => void;
}) {
  const walType = useStore(s => s.walType);
  const currentDay = challenge.currentDay || 1;
  const today = challenge.days.find(d => d.dayNumber === currentDay);
  const daysLeft = Math.max(0, challenge.durationDays - currentDay + 1);
  const progressPct = Math.round((challenge.successfulDays / challenge.durationDays) * 100);
  const onTrack = challenge.successfulDays >= Math.floor((currentDay - 1) * (challenge.minSuccessDaysForReward / challenge.durationDays));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header ticket */}
      <div className="dep-glass dep-ticket">
        <div className="dep-ticket-top" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
          <div className="dep-ticket-label">Challenge Balance</div>
          <div className="dep-ticket-amount" style={{ fontSize: 30 }}>${challenge.challengeBalance.toFixed(2)}</div>
        </div>
        <div className="dep-ticket-notch-row" />
        <div className="dep-ticket-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 700 }}>Day {currentDay} of {challenge.durationDays}</span>
          <span style={{ fontSize: 11, color: 'var(--t4)' }}>{daysLeft} day{daysLeft === 1 ? '' : 's'} left</span>
        </div>
      </div>

      {walType !== 'challenge' && (
        <button className="dep-btn-primary" onClick={onStartTrading} style={{
          background: 'linear-gradient(135deg, #A855F7 0%, #6366F1 100%)',
          boxShadow: '0 8px 24px -8px rgba(168,85,247,.6), inset 0 1px 0 rgba(255,255,255,.3)',
        }}>
          Switch to Challenge Account & Trade
        </button>
      )}

      {/* Today's tally */}
      <div className="dep-glass" style={{ padding: '16px 16px' }}>
        <div className="dep-eyebrow" style={{ marginBottom: 10 }}>Today — Day {currentDay}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
          <MiniStat label="Trades" value={`${today?.trades ?? 0}/${challenge.dailyTradesRequired}`} color="var(--t2)" />
          <MiniStat label="Wins" value={String(today?.wins ?? 0)} color="var(--g0)" />
          <MiniStat label="Losses" value={String(today?.losses ?? 0)} color="var(--red)" />
        </div>
        {today?.result === 'complete' && (
          <div style={{ textAlign: 'center', padding: '8px', borderRadius: 'var(--r3)', background: 'rgba(0,214,143,.1)', color: 'var(--g0)', fontWeight: 800, fontSize: 13 }}>
            MISSION COMPLETE ✅
          </div>
        )}
        {today?.result === 'failed' && (
          <div style={{ textAlign: 'center', padding: '8px', borderRadius: 'var(--r3)', background: 'rgba(255,61,87,.1)', color: 'var(--red)', fontWeight: 800, fontSize: 13 }}>
            MISSION FAILED ❌
          </div>
        )}
        {today?.result === 'pending' && (
          <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--t4)' }}>
            Need {Math.max(0, challenge.dailyWinsRequired - (today?.wins ?? 0))} more win{Math.max(0, challenge.dailyWinsRequired - (today?.wins ?? 0)) === 1 ? '' : 's'} today to complete the mission
          </div>
        )}
      </div>

      {/* 30-day progress bar */}
      <div className="dep-glass" style={{ padding: '16px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="dep-eyebrow">Progress</div>
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--g0)' }}>{challenge.successfulDays}/{challenge.durationDays} successful days</span>
        </div>
        <div className="signal-strength-bar">
          <div className="signal-strength-fill buy" style={{ width: `${progressPct}%` }} />
        </div>
        <div style={{ fontSize: 11, color: onTrack ? 'var(--t4)' : 'var(--red)', marginTop: 8 }}>
          {onTrack
            ? `Need ${challenge.minSuccessDaysForReward}/${challenge.durationDays} successful days total to unlock a reward.`
            : `You're behind pace to reach ${challenge.minSuccessDaysForReward} successful days — every day still counts!`}
        </div>

        {/* Day-by-day grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 5, marginTop: 14 }}>
          {challenge.days.map(day => {
            const bg = day.result === 'complete' ? 'var(--g0)' : day.result === 'failed' ? 'var(--red)' : 'var(--bg2)';
            const isToday = day.dayNumber === currentDay;
            return (
              <div
                key={day.dayNumber}
                title={`Day ${day.dayNumber}: ${day.wins}W / ${day.losses}L`}
                style={{
                  aspectRatio: '1', borderRadius: 6, background: day.result === 'pending' ? 'var(--bg2)' : bg,
                  border: isToday ? '2px solid var(--t2)' : '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 700, color: day.result === 'pending' ? 'var(--t4)' : '#04120C',
                }}
              >
                {day.dayNumber}
              </div>
            );
          })}
        </div>
      </div>

      <div className="dep-glass" style={{ padding: '12px 14px', fontSize: 11.5, color: 'var(--t4)', lineHeight: 1.6 }}>
        Withdrawals from your real balance stay available as normal — the challenge balance and reward simply aren't touchable until day {challenge.durationDays} wraps up.
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="dep-glass" style={{ padding: '10px 6px', textAlign: 'center' }}>
      <div style={{ fontSize: 16, fontWeight: 800, color, fontFamily: 'JetBrains Mono' }}>{value}</div>
      <div style={{ fontSize: 9.5, color: 'var(--t4)', fontWeight: 700, marginTop: 3, textTransform: 'uppercase' }}>{label}</div>
    </div>
  );
}
