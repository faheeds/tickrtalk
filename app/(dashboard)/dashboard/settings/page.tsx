'use client'
import { useState, useEffect, useCallback } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SnapTradeAuthorization {
  id: string
  brokerage: { name: string; display_name: string; logo_url: string; status: string }
  created_date: string
}

interface AlpacaConnection {
  id: string
  broker: string
  label: string
  paper_mode: boolean
}

interface UserInfo {
  subscription_tier: string
  subscription_status: string
  trial_ends_at: string
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TabBar({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  return (
    <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
      {[
        { id: 'brokers', label: 'Brokers' },
        { id: 'billing', label: 'Billing' },
      ].map(t => (
        <button
          key={t.id}
          onClick={() => setTab(t.id)}
          style={{
            flex: 1, padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600,
            border: 'none', cursor: 'pointer', transition: 'all 0.2s',
            background: tab === t.id ? 'rgba(99,102,241,0.2)' : 'transparent',
            color: tab === t.id ? '#A5B4FC' : 'var(--ink-3)',
            boxShadow: tab === t.id ? '0 0 0 1px rgba(99,102,241,0.35) inset' : 'none',
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

function BrokerLogo({ name }: { name: string }) {
  const initials = name.slice(0, 2).toUpperCase()
  return (
    <div style={{
      width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center',
      justifyContent: 'center', fontWeight: 700, fontSize: 12, flexShrink: 0,
      background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.3))',
      border: '1px solid rgba(99,102,241,0.3)', color: '#A5B4FC',
      fontFamily: 'var(--font-mono)',
    }}>
      {initials}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const [tab, setTab]                   = useState('brokers')
  const [msg, setMsg]                   = useState('')
  const [msgType, setMsgType]           = useState<'ok' | 'err'>('ok')

  // SnapTrade state
  const [stRegistered, setStRegistered] = useState<boolean | null>(null)
  const [stAuths, setStAuths]           = useState<SnapTradeAuthorization[]>([])
  const [stLoading, setStLoading]       = useState(true)
  const [stConnecting, setStConnecting] = useState(false)
  const [stRemoving, setStRemoving]     = useState<string | null>(null)
  const [stConfigured, setStConfigured] = useState(true)

  // Alpaca state
  const [alpacaConns, setAlpacaConns]   = useState<AlpacaConnection[]>([])
  const [alpacaKey, setAlpacaKey]       = useState('')
  const [alpacaSecret, setAlpacaSecret] = useState('')
  const [paper, setPaper]               = useState(true)
  const [savingAlpaca, setSavingAlpaca] = useState(false)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetting, setResetting]       = useState(false)

  // Billing state
  const [userInfo, setUserInfo]         = useState<UserInfo | null>(null)

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function flash(text: string, type: 'ok' | 'err' = 'ok') {
    setMsg(text); setMsgType(type)
    setTimeout(() => setMsg(''), 6000)
  }

  // ── SnapTrade ────────────────────────────────────────────────────────────────

  const loadSnapTrade = useCallback(async () => {
    setStLoading(true)
    try {
      // Check registration
      const reg = await fetch('/api/snaptrade/register').then(r => r.json())

      if (reg.error?.includes('not configured')) {
        setStConfigured(false)
        setStRegistered(false)
        setStLoading(false)
        return
      }

      setStRegistered(reg.registered)

      if (reg.registered) {
        // Load connected accounts
        const accs = await fetch('/api/snaptrade/accounts').then(r => r.json())
        setStAuths(accs.authorizations ?? [])
      }
    } catch {
      setStRegistered(false)
    }
    setStLoading(false)
  }, [])

  async function registerSnapTrade() {
    setStConnecting(true)
    const r = await fetch('/api/snaptrade/register', { method: 'POST' })
    const d = await r.json()
    if (d.ok) {
      setStRegistered(true)
      await connectBroker() // immediately open connection portal
    } else if (d.error === 'SNAPTRADE_1012') {
      flash('SNAPTRADE_1012', 'err')
    } else {
      flash(`❌ ${d.error ?? 'Failed to register'}`, 'err')
    }
    setStConnecting(false)
  }

  async function connectBroker(broker?: string) {
    setStConnecting(true)
    const r = await fetch('/api/snaptrade/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ broker }),
    })
    const d = await r.json()
    setStConnecting(false)
    if (d.redirectURI) {
      window.location.href = d.redirectURI
    } else {
      flash(`❌ ${d.error ?? 'Failed to generate connection link'}`, 'err')
    }
  }

  async function handleConnectClick() {
    if (!stRegistered) {
      await registerSnapTrade()
    } else {
      await connectBroker()
    }
  }

  async function disconnectBroker(authorizationId: string) {
    setStRemoving(authorizationId)
    const r = await fetch('/api/snaptrade/disconnect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authorizationId }),
    })
    const d = await r.json()
    if (d.ok) {
      setStAuths(prev => prev.filter(a => a.id !== authorizationId))
      flash('Broker disconnected.')
    } else {
      flash(`❌ ${d.error ?? 'Failed to disconnect'}`, 'err')
    }
    setStRemoving(null)
  }

  // ── Alpaca ────────────────────────────────────────────────────────────────────

  const loadAlpaca = useCallback(async () => {
    const r = await fetch('/api/brokerage/alpaca').then(r => r.json()).catch(() => ({}))
    setAlpacaConns(r.connections ?? [])
  }, [])

  async function saveAlpaca() {
    if (!alpacaKey || !alpacaSecret) return
    setSavingAlpaca(true)
    const r = await fetch('/api/brokerage/alpaca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: alpacaKey, apiSecret: alpacaSecret, paper }),
    })
    const d = await r.json()
    setSavingAlpaca(false)
    if (d.ok) {
      flash(`✅ Alpaca ${paper ? 'paper' : 'live'} account connected! Equity: $${d.equity?.toLocaleString()}`)
      setAlpacaKey(''); setAlpacaSecret('')
      loadAlpaca()
    } else {
      flash(`❌ ${d.error}`, 'err')
    }
  }

  async function resetPaperAccount() {
    setResetting(true)
    const r = await fetch('/api/brokerage/alpaca/reset', { method: 'POST' })
    const d = await r.json()
    setResetting(false)
    setResetConfirm(false)
    if (d.ok) {
      flash('✅ All orders cancelled and positions closed. Visit the Alpaca dashboard to also reset your cash balance to $100,000.')
    } else if (r.status === 428) {
      flash('❌ No active Alpaca connection found. Connect an account first.', 'err')
    } else if (r.status === 403) {
      flash('❌ Reset is only available for paper trading accounts.', 'err')
    } else {
      flash(`❌ Reset failed: ${d.errors?.join(', ') ?? d.error ?? 'Unknown error'}`, 'err')
    }
  }

  // ── Billing ───────────────────────────────────────────────────────────────────

  async function openPortal() {
    const d = await fetch('/api/subscribe/portal', { method: 'POST' }).then(r => r.json())
    if (d.url) window.location.href = d.url
  }

  async function subscribe(plan: string) {
    const d = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    }).then(r => r.json())
    if (d.url) window.location.href = d.url
    else flash(`❌ Billing error: ${d.error ?? JSON.stringify(d)}`, 'err')
  }

  // ── Mount ─────────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadSnapTrade()
    loadAlpaca()
    fetch('/api/user').then(r => r.json()).then(d => setUserInfo(d))

    const p = new URLSearchParams(window.location.search)
    if (p.get('tab'))       setTab(p.get('tab')!)
    if (p.get('connected')) flash(`✅ ${p.get('connected')} connected! Your trades will appear in the Journal.`)
    if (p.get('error'))     flash(`❌ ${p.get('error')}`, 'err')

    // Reload accounts after returning from SnapTrade portal
    if (p.get('connected') === 'snaptrade') {
      setTimeout(loadSnapTrade, 2000)
    }
  }, [loadSnapTrade, loadAlpaca])

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl space-y-6 animate-slide-up">

      {/* Header */}
      <div>
        <p className="section-label mb-1">Account</p>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>Settings</h1>
      </div>

      {/* Tabs */}
      <TabBar tab={tab} setTab={setTab} />

      {/* Flash message */}
      {msg === 'SNAPTRADE_1012' ? (
        <div className="rounded-xl px-4 py-4 text-sm" style={{
          background: 'rgba(244,63,94,0.08)',
          border: '1px solid rgba(244,63,94,0.25)',
          color: 'var(--down)',
          lineHeight: 1.6,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>❌ SnapTrade Personal plan: user slot already taken</div>
          <div style={{ color: 'rgba(255,255,255,0.65)', marginBottom: 10 }}>
            A SnapTrade user is registered under your API keys from a previous session.
            Delete it to free the slot, then try again.
          </div>
          <a
            href="https://app.snaptrade.com/dashboard/users"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: 'rgba(244,63,94,0.15)', border: '1px solid rgba(244,63,94,0.4)',
              color: '#FCA5A5', textDecoration: 'none',
            }}
          >
            Open SnapTrade Dashboard →
          </a>
        </div>
      ) : msg ? (
        <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{
          background: msgType === 'ok' ? 'rgba(0,201,167,0.1)' : 'rgba(244,63,94,0.1)',
          border: `1px solid ${msgType === 'ok' ? 'rgba(0,201,167,0.25)' : 'rgba(244,63,94,0.25)'}`,
          color: msgType === 'ok' ? 'var(--up)' : 'var(--down)',
        }}>
          {msg}
        </div>
      ) : null}

      {/* ── BROKERS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'brokers' && (
        <div className="space-y-5">

          {/* ── SnapTrade Section ── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>

            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink-1)' }}>Live Brokers</span>
                    <span style={{
                      fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 700,
                      background: 'rgba(99,102,241,0.15)', color: '#A5B4FC',
                      border: '1px solid rgba(99,102,241,0.3)',
                    }}>200+ Brokers via SnapTrade</span>
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                    Connect Fidelity, Robinhood, TD Ameritrade, Schwab, IBKR, and more. Your trades will appear in the Journal.
                  </p>
                </div>
              </div>
            </div>

            {/* Connected brokers list */}
            {stLoading ? (
              <div style={{ padding: '16px 24px' }}>
                {[1, 2].map(i => (
                  <div key={i} className="flex items-center gap-3 py-3">
                    <div className="skeleton rounded-xl" style={{ width: 36, height: 36 }} />
                    <div className="flex-1">
                      <div className="skeleton rounded mb-1" style={{ width: 120, height: 14 }} />
                      <div className="skeleton rounded" style={{ width: 80, height: 11 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : stAuths.length > 0 ? (
              <div>
                {stAuths.map(auth => (
                  <div key={auth.id} className="flex items-center gap-3" style={{
                    padding: '14px 24px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <BrokerLogo name={auth.brokerage.display_name} />
                    <div className="flex-1 min-w-0">
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-1)' }}>
                        {auth.brokerage.display_name}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
                        Connected {new Date(auth.created_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                    </div>
                    <span className="badge" style={{
                      background: 'rgba(0,201,167,0.1)', color: 'var(--up)',
                      border: '1px solid rgba(0,201,167,0.25)', fontSize: 11,
                    }}>
                      Active
                    </span>
                    <button
                      onClick={() => disconnectBroker(auth.id)}
                      disabled={stRemoving === auth.id}
                      className="btn-ghost"
                      style={{ fontSize: 12, padding: '5px 12px', color: 'var(--ink-3)' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--down)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--ink-3)'}
                    >
                      {stRemoving === auth.id ? '…' : 'Disconnect'}
                    </button>
                  </div>
                ))}
              </div>
            ) : null}

            {/* Connect button or setup notice */}
            <div style={{ padding: '16px 24px' }}>
              {!stConfigured ? (
                <div style={{
                  padding: '12px 16px', borderRadius: 10, fontSize: 12, lineHeight: 1.6,
                  background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
                  color: '#FCD34D',
                }}>
                  <strong>Setup required:</strong> Add <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4 }}>SNAPTRADE_CLIENT_ID</code> and{' '}
                  <code style={{ background: 'rgba(255,255,255,0.08)', padding: '1px 5px', borderRadius: 4 }}>SNAPTRADE_CONSUMER_KEY</code> to your Vercel environment variables.
                  Get them free at{' '}
                  <a href="https://app.snaptrade.com" target="_blank" rel="noreferrer" style={{ color: '#FCD34D', textDecoration: 'underline' }}>app.snaptrade.com</a>.
                </div>
              ) : (
                <>
                  <button
                    onClick={handleConnectClick}
                    disabled={stConnecting}
                    className="btn-primary w-full"
                    style={{ justifyContent: 'center', gap: 8 }}
                  >
                    {stConnecting ? (
                      <>
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round"/>
                        </svg>
                        Connecting…
                      </>
                    ) : (
                      <>
                        <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                          <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd"/>
                        </svg>
                        {stAuths.length > 0 ? 'Connect Another Broker' : 'Connect a Broker'}
                      </>
                    )}
                  </button>
                  <p style={{ fontSize: 11, color: 'var(--ink-3)', textAlign: 'center', marginTop: 10 }}>
                    Secured by SnapTrade · OAuth — no credentials stored on our servers
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Broker logos row */}
          <div className="card" style={{ padding: '16px 24px' }}>
            <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 12, fontWeight: 600 }}>
              Popular brokerages supported
            </div>
            <div className="flex flex-wrap gap-2">
              {['Fidelity', 'Robinhood', 'TD Ameritrade', 'Schwab', 'IBKR', 'Webull', 'E*TRADE', 'Alpaca', 'Firstrade', 'Questrade'].map(b => (
                <span key={b} style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 8, fontWeight: 500,
                  background: 'rgba(255,255,255,0.04)', color: 'var(--ink-2)',
                  border: '1px solid rgba(255,255,255,0.07)',
                }}>
                  {b}
                </span>
              ))}
              <span style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 8, fontWeight: 600,
                background: 'rgba(99,102,241,0.1)', color: '#A5B4FC',
                border: '1px solid rgba(99,102,241,0.25)',
              }}>
                +190 more
              </span>
            </div>
          </div>

          {/* ── Alpaca Paper Trading ── */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink-1)', marginBottom: 2 }}>
                Alpaca Paper Trading
              </div>
              <p style={{ fontSize: 12, color: 'var(--ink-3)' }}>
                For simulated trading. Get your API key from{' '}
                <a href="https://alpaca.markets" target="_blank" rel="noreferrer" style={{ color: '#A5B4FC' }}>
                  alpaca.markets
                </a>{' '}
                → Paper Trading → API Keys
              </p>
            </div>

            {/* Existing Alpaca connections */}
            {alpacaConns.length > 0 && (
              <div>
                {alpacaConns.map(c => (
                  <div key={c.id} className="flex items-center gap-3" style={{
                    padding: '14px 24px', borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 11, fontWeight: 700,
                      background: 'rgba(0,201,167,0.12)', border: '1px solid rgba(0,201,167,0.25)', color: 'var(--up)',
                      fontFamily: 'var(--font-mono)',
                    }}>ALP</div>
                    <div className="flex-1">
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-1)' }}>Alpaca</div>
                      <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
                        {c.label} · {c.paper_mode ? 'Paper mode' : 'Live'}
                      </div>
                    </div>
                    <span className="badge" style={{
                      background: c.paper_mode ? 'rgba(99,102,241,0.1)' : 'rgba(0,201,167,0.1)',
                      color: c.paper_mode ? '#A5B4FC' : 'var(--up)',
                      border: `1px solid ${c.paper_mode ? 'rgba(99,102,241,0.25)' : 'rgba(0,201,167,0.25)'}`,
                      fontSize: 11,
                    }}>
                      {c.paper_mode ? 'Paper' : 'Live'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Add Alpaca form */}
            <div style={{ padding: '16px 24px' }}>
              <div className="space-y-3">
                <input
                  value={alpacaKey}
                  onChange={e => setAlpacaKey(e.target.value)}
                  placeholder="API Key (PKXXX…)"
                  className="input w-full"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
                />
                <input
                  value={alpacaSecret}
                  onChange={e => setAlpacaSecret(e.target.value)}
                  type="password"
                  placeholder="API Secret"
                  className="input w-full"
                />
                <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
                  <input
                    type="checkbox"
                    checked={paper}
                    onChange={e => setPaper(e.target.checked)}
                    style={{ accentColor: '#6366F1', width: 14, height: 14 }}
                  />
                  Paper Trading Mode (no real money)
                </label>
                <button
                  onClick={saveAlpaca}
                  disabled={savingAlpaca || !alpacaKey || !alpacaSecret}
                  className="btn-secondary"
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {savingAlpaca ? 'Connecting…' : 'Connect Alpaca'}
                </button>
              </div>
            </div>

            {/* Reset Paper Account — danger zone */}
            {alpacaConns.some(c => c.paper_mode) && (
              <div style={{
                padding: '14px 24px',
                borderTop: '1px solid rgba(244,63,94,0.12)',
                background: 'rgba(244,63,94,0.03)',
              }}>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)' }}>Reset Paper Account</div>
                    <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>
                      Cancels all open orders and closes all positions. Restores a clean slate.
                    </div>
                  </div>

                  {!resetConfirm ? (
                    <button
                      onClick={() => setResetConfirm(true)}
                      style={{
                        flexShrink: 0, padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                        background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)',
                        color: '#FCA5A5', cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      Reset Account
                    </button>
                  ) : (
                    <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
                      <span style={{ fontSize: 11, color: 'var(--ink-3)' }}>Are you sure?</span>
                      <button
                        onClick={resetPaperAccount}
                        disabled={resetting}
                        style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          background: 'rgba(244,63,94,0.2)', border: '1px solid rgba(244,63,94,0.45)',
                          color: '#F87171', cursor: 'pointer',
                        }}
                      >
                        {resetting ? 'Resetting…' : 'Confirm'}
                      </button>
                      <button
                        onClick={() => setResetConfirm(false)}
                        style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                          background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                          color: 'var(--ink-3)', cursor: 'pointer',
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>

                {/* Note about balance reset */}
                <div style={{
                  marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 11, lineHeight: 1.6,
                  background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)',
                  color: '#FCD34D',
                }}>
                  💡 To also reset your cash balance back to $100,000, visit{' '}
                  <a
                    href="https://app.alpaca.markets/paper-trading/dashboard"
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#FCD34D', textDecoration: 'underline' }}
                  >
                    app.alpaca.markets
                  </a>{' '}
                  → Paper Trading → Settings → Reset Account.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── BILLING TAB ─────────────────────────────────────────────────────── */}
      {tab === 'billing' && (
        <div className="space-y-5">
          {userInfo && (
            <div className="card card-featured" style={{ padding: '20px 24px' }}>
              <div className="section-label mb-2">Current Plan</div>
              <div className="flex items-center justify-between">
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink-1)', textTransform: 'capitalize' }}>
                    {userInfo.subscription_tier} Plan
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 3, textTransform: 'capitalize' }}>
                    {userInfo.subscription_status}
                    {userInfo.subscription_status === 'trial' &&
                      ` — trial ends ${new Date(userInfo.trial_ends_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                  </div>
                </div>
                {userInfo.subscription_status === 'active' && (
                  <button onClick={openPortal} className="btn-ghost" style={{ fontSize: 12 }}>
                    Manage Billing
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {[
              {
                plan: 'basic', name: 'Basic', price: 19,
                desc: 'Watchlist, portfolio tracking, halal screener, trade journal',
                features: ['Live price tracking', 'Halal stock screener', 'Trade journal', '1 broker connection'],
              },
              {
                plan: 'pro', name: 'Pro', price: 49,
                desc: 'Everything in Basic plus algo engine, auto-trading, unlimited broker connections',
                features: ['Everything in Basic', 'Algo trading engine', 'Unlimited broker connections', 'Priority support'],
                highlight: true,
              },
            ].map(p => (
              <div key={p.plan} className={`card ${p.highlight ? 'card-featured' : ''}`} style={{ padding: '20px 24px' }}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink-1)' }}>{p.name}</span>
                      {p.highlight && (
                        <span style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 99, fontWeight: 700,
                          background: 'rgba(99,102,241,0.2)', color: '#A5B4FC',
                          border: '1px solid rgba(99,102,241,0.35)',
                        }}>Popular</span>
                      )}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>
                      ${p.price}<span style={{ fontSize: 13, color: 'var(--ink-3)', fontWeight: 400 }}>/mo</span>
                    </div>
                    <ul style={{ marginTop: 12 }}>
                      {p.features.map(f => (
                        <li key={f} className="flex items-center gap-2" style={{ fontSize: 12, color: 'var(--ink-2)', marginBottom: 6 }}>
                          <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--up)' }}>
                            <path d="M13.854 3.646a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 10.293l6.646-6.647a.5.5 0 01.708 0z"/>
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    onClick={() => subscribe(p.plan)}
                    className={p.highlight ? 'btn-primary' : 'btn-secondary'}
                    style={{ flexShrink: 0, fontSize: 13, whiteSpace: 'nowrap' }}
                  >
                    {userInfo?.subscription_status === 'trial' ? 'Activate' : 'Switch'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
