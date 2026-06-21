'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

interface Allocations {
  dayBudget:      number
  swingBudget:    number
  longtermBudget: number
}

interface UserInfo {
  subscription_tier?:   string
  subscription_status?: string
  trial_ends_at?:       string
}

function BudgetInput({
  label, sub, value, onChange, color,
}: {
  label: string; sub: string; value: number; onChange: (v: number) => void; color: string
}) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </label>
      <div style={{ position: 'relative', marginTop: 6 }}>
        <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-3)', fontSize: 14, fontWeight: 600, pointerEvents: 'none' }}>$</span>
        <input
          type="number" min={0} step={100} value={value || ''}
          onChange={e => onChange(Math.max(0, Number(e.target.value) || 0))}
          placeholder="0"
          className="input"
          style={{ paddingLeft: 24, fontSize: 15, fontWeight: 700, fontFamily: 'var(--font-mono)', color, width: '100%', boxSizing: 'border-box' }}
        />
      </div>
      <p style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{sub}</p>
    </div>
  )
}

const STRATEGIES = [
  {
    id:       'day',
    name:     'Day Trading',
    badge:    'Intraday',
    icon:     '⚡',
    desc:     'Opening Range Breakout + VWAP confirmation. Enters after the 30-minute opening range forms, targets 1.5× the range width. All positions hard-closed by 3:45 PM ET. Max 2 simultaneous positions.',
    details:  [
      { label: 'Method',     value: 'ORB + VWAP filter' },
      { label: 'Scan freq',  value: 'Every 15 min, 10am–3:30pm ET' },
      { label: 'Risk/trade', value: '2% of day budget' },
      { label: 'Max open',   value: '2 positions' },
      { label: 'Hold time',  value: 'Intraday — hard close at 3:45 PM' },
      { label: 'Stop',       value: 'Opening range low' },
    ],
    budgetKey:  'dayBudget'      as keyof Allocations,
    color:      '#F59E0B',
    bgColor:    'rgba(245,158,11,0.06)',
    border:     'rgba(245,158,11,0.2)',
  },
  {
    id:       'swing',
    name:     'Swing Trading',
    badge:    'Multi-day',
    icon:     '📈',
    desc:     'SuperTrend indicator crossovers with ATR-based dynamic stops. Enters when a halal stock flips from bearish to bullish SuperTrend on daily bars. Target is 2× ATR above entry.',
    details:  [
      { label: 'Method',     value: 'SuperTrend + ATR(14)' },
      { label: 'Scan freq',  value: 'Daily at 9:30 AM ET' },
      { label: 'Risk/trade', value: '1% of swing budget' },
      { label: 'Max entries', value: '3 new entries per scan' },
      { label: 'Hold time',  value: 'Days to weeks' },
      { label: 'Stop',       value: 'SuperTrend line (dynamic trailing)' },
    ],
    budgetKey:  'swingBudget'    as keyof Allocations,
    color:      '#10B981',
    bgColor:    'rgba(16,185,129,0.06)',
    border:     'rgba(16,185,129,0.2)',
  },
  {
    id:       'longterm',
    name:     'Long-Term',
    badge:    'Monthly',
    icon:     '🏛️',
    desc:     'Dual Momentum + Quality filter. Ranks the halal universe by 6-month return, buys top momentum stocks with a golden cross (50 MA > 200 MA). Rebalances monthly, exits on death cross.',
    details:  [
      { label: 'Method',     value: 'Quality Momentum (Dual Momentum)' },
      { label: 'Scan freq',  value: '1st Monday of each month' },
      { label: 'Sizing',     value: 'Equal weight across positions' },
      { label: 'Max open',   value: '8 positions' },
      { label: 'Hold time',  value: '3–6 months typically' },
      { label: 'Exit',       value: 'Death cross (50 MA crosses below 200 MA)' },
    ],
    budgetKey:  'longtermBudget' as keyof Allocations,
    color:      '#6366F1',
    bgColor:    'rgba(99,102,241,0.06)',
    border:     'rgba(99,102,241,0.2)',
  },
] as const

export default function AlgoPage() {
  const [userInfo,  setUserInfo]  = useState<UserInfo | null>(null)
  const [draft,     setDraft]     = useState<Allocations>({ dayBudget: 0, swingBudget: 0, longtermBudget: 0 })
  const [saved,     setSaved]     = useState<Allocations>({ dayBudget: 0, swingBudget: 0, longtermBudget: 0 })
  const [loading,   setLoading]   = useState(true)
  const [saving,    setSaving]    = useState(false)
  const [saveMsg,   setSaveMsg]   = useState('')

  const isDirty = JSON.stringify(draft) !== JSON.stringify(saved)

  const load = useCallback(async () => {
    setLoading(true)
    const [uRes, aRes] = await Promise.all([
      fetch('/api/user').then(r => r.json()).catch(() => null),
      fetch('/api/algo/allocations').then(r => r.json()).catch(() => null),
    ])
    if (uRes)  setUserInfo(uRes)
    if (aRes && !aRes.error) { setDraft(aRes); setSaved(aRes) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function updateDraft(key: keyof Allocations, val: number) {
    setDraft(d => ({ ...d, [key]: val }))
    setSaveMsg('')
  }

  async function handleSave() {
    setSaving(true)
    const res = await fetch('/api/algo/allocations', {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(draft),
    }).then(r => r.json()).catch(() => null)
    if (res?.ok) {
      setSaved(draft)
      setSaveMsg('Saved!')
      setTimeout(() => setSaveMsg(''), 3000)
    } else {
      setSaveMsg('Save failed — try again')
    }
    setSaving(false)
  }

  const totalAllocated = draft.dayBudget + draft.swingBudget + draft.longtermBudget

  if (loading) return <div style={{ color: 'var(--ink-3)', padding: 32 }}>Loading…</div>

  const isPro   = userInfo?.subscription_tier === 'pro' && userInfo?.subscription_status === 'active'
  const isTrial = userInfo?.subscription_status === 'trial'

  if (!isPro && !isTrial) return (
    <div className="flex items-center justify-center" style={{ minHeight: '60vh' }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>🤖</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 8 }}>Algo Engine — Pro Feature</h2>
        <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.7, marginBottom: 24 }}>
          Automated trading with three strategy types — day trading, swing, and long-term —
          each with its own dollar allocation and risk controls. Trades halal-only stocks, automatically.
        </p>
        <Link href="/dashboard/settings?tab=billing" className="btn-primary">Upgrade to Pro — $49/mo</Link>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 max-w-5xl animate-slide-up">

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="section-label mb-1">Automated Trading</p>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>Algo Engine</h1>
        </div>
        <div className="flex items-center gap-2">
          {isTrial && !isPro && (
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, fontWeight: 600, background: 'rgba(251,191,36,0.12)', color: '#FCD34D', border: '1px solid rgba(251,191,36,0.3)' }}>
              Trial Active
            </span>
          )}
          {isPro && (
            <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, fontWeight: 600, background: 'rgba(16,185,129,0.12)', color: '#34D399', border: '1px solid rgba(16,185,129,0.3)' }}>
              Pro Active
            </span>
          )}
        </div>
      </div>

      {/* Allocation summary bar */}
      {totalAllocated > 0 && (
        <div className="card" style={{ padding: '14px 20px' }}>
          <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
            <div className="flex items-center gap-6">
              <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Total allocated</span>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)', fontFamily: 'var(--font-mono)' }}>
                ${totalAllocated.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {STRATEGIES.map(s => draft[s.budgetKey] > 0 && (
                <span key={s.id} style={{ fontSize: 12, color: s.color }}>
                  {s.name}: ${draft[s.budgetKey].toLocaleString()}
                </span>
              ))}
            </div>
          </div>
          <div style={{ height: 4, borderRadius: 99, background: 'rgba(255,255,255,0.06)', overflow: 'hidden', display: 'flex' }}>
            {STRATEGIES.map(s => {
              const pct = totalAllocated > 0 ? (draft[s.budgetKey] / totalAllocated) * 100 : 0
              return pct > 0 ? (
                <div key={s.id} style={{ width: `${pct}%`, background: s.color, transition: 'width 0.3s' }} />
              ) : null
            })}
          </div>
        </div>
      )}

      {/* Strategy cards */}
      <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
        {STRATEGIES.map(s => (
          <div key={s.id} className="card" style={{ background: s.bgColor, border: `1px solid ${s.border}`, padding: '20px 24px' }}>
            <div className="flex items-start gap-2 mb-3">
              <span style={{ fontSize: 22, lineHeight: '1' }}>{s.icon}</span>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink-1)', marginBottom: 4 }}>{s.name}</div>
                <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 600, background: `${s.color}20`, color: s.color, border: `1px solid ${s.color}40`, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>
                  {s.badge}
                </span>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.65, marginBottom: 16 }}>{s.desc}</p>
            <div className="space-y-1.5 mb-5">
              {s.details.map(d => (
                <div key={d.label} className="flex justify-between" style={{ fontSize: 11 }}>
                  <span style={{ color: 'var(--ink-3)' }}>{d.label}</span>
                  <span style={{ color: 'var(--ink-2)', fontWeight: 500, textAlign: 'right' as const, maxWidth: '60%' }}>{d.value}</span>
                </div>
              ))}
            </div>
            <BudgetInput
              label="Budget allocation"
              sub={`Max capital for ${s.name.toLowerCase()}`}
              value={draft[s.budgetKey]}
              onChange={v => updateDraft(s.budgetKey, v)}
              color={s.color}
            />
          </div>
        ))}
      </div>

      {/* Save */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={!isDirty || saving}
          className="btn-primary"
          style={{ opacity: !isDirty || saving ? 0.5 : 1, cursor: !isDirty || saving ? 'not-allowed' : 'pointer' }}
        >
          {saving ? 'Saving…' : 'Save Allocations'}
        </button>
        {saveMsg && (
          <span style={{ fontSize: 12, color: saveMsg === 'Saved!' ? '#34D399' : '#F87171' }}>
            {saveMsg === 'Saved!' ? '✓ ' : ''}{saveMsg}
          </span>
        )}
        {isDirty && !saveMsg && <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>Unsaved changes</span>}
      </div>

      {/* Info grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card" style={{ padding: '18px 20px' }}>
          <div className="section-label mb-3">⏰ Scan Schedule</div>
          <div className="space-y-2">
            {[
              { label: 'Day trade scans',     value: 'Every 15 min · 10am–3:30pm ET' },
              { label: 'Swing scan',          value: 'Daily · 9:30 AM ET' },
              { label: 'Long-term rebalance', value: '1st Monday of each month' },
              { label: 'Mark-to-market',      value: 'Daily · 4:00 PM ET' },
              { label: 'Day trade close-out', value: 'Hard close at 3:45 PM ET' },
            ].map(r => (
              <div key={r.label} className="flex justify-between" style={{ fontSize: 12 }}>
                <span style={{ color: 'var(--ink-3)' }}>{r.label}</span>
                <span style={{ color: 'var(--ink-2)' }}>{r.value}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card" style={{ padding: '18px 20px', background: 'rgba(99,102,241,0.05)', border: '1px solid rgba(99,102,241,0.2)' }}>
          <div className="section-label mb-3">☪️ Halal-Only Universe</div>
          <p style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.7, marginBottom: 12 }}>
            All three strategies scan only from the 523 halal-certified stocks in the TickrTalk
            database. Interest-bearing, alcohol, tobacco, gambling, and weapons sectors are
            automatically excluded. A liquidity filter further refines each scan.
          </p>
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { val: '523', label: 'Halal symbols' },
              { val: '3',   label: 'Strategies' },
              { val: '0%',  label: 'No leverage' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' as const }}>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#A5B4FC' }}>{s.val}</div>
                <div style={{ fontSize: 10, color: 'var(--ink-3)', marginTop: 2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Paper trading notice */}
      <div className="card" style={{ padding: '16px 20px', background: 'rgba(251,191,36,0.04)', border: '1px solid rgba(251,191,36,0.18)' }}>
        <div className="flex gap-3">
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#FCD34D', marginBottom: 4 }}>Start with a Paper Account</div>
            <p style={{ fontSize: 12, color: 'var(--ink-2)', lineHeight: 1.65 }}>
              Connect an Alpaca <strong>paper trading</strong> account in{' '}
              <Link href="/dashboard/settings" style={{ color: '#A5B4FC' }}>Settings → Brokers</Link>{' '}
              to test all three strategies with virtual money before going live.
              The algo will never exceed your per-strategy budget cap.
              Past signal performance does not guarantee future results.
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}
