'use client'
import { useState, useEffect } from 'react'

export default function SettingsPage() {
  const [tab, setTab]           = useState('brokers')
  const [connections, setConns] = useState<any[]>([])
  const [alpacaKey, setKey]     = useState('')
  const [alpacaSecret, setSecret] = useState('')
  const [paper, setPaper]       = useState(true)
  const [saving, setSaving]     = useState(false)
  const [msg, setMsg]           = useState('')
  const [userInfo, setUserInfo] = useState<any>(null)

  useEffect(() => {
    fetch('/api/brokerage/alpaca').then(r => r.json()).then(d => setConns(d.connections ?? []))
    fetch('/api/user').then(r => r.json()).then(d => setUserInfo(d))
    // Check URL params
    const p = new URLSearchParams(window.location.search)
    if (p.get('tab')) setTab(p.get('tab')!)
    if (p.get('connected')) setMsg(`✅ ${p.get('connected')} connected successfully!`)
    if (p.get('error')) setMsg(`❌ Error: ${p.get('error')}`)
  }, [])

  async function saveAlpaca() {
    setSaving(true); setMsg('')
    const r = await fetch('/api/brokerage/alpaca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: alpacaKey, apiSecret: alpacaSecret, paper }),
    })
    const d = await r.json()
    setSaving(false)
    if (d.ok) {
      setMsg(`✅ Alpaca ${paper ? 'paper' : 'live'} account connected! Equity: $${d.equity?.toLocaleString()}`)
      setKey(''); setSecret('')
      fetch('/api/brokerage/alpaca').then(r => r.json()).then(d => setConns(d.connections ?? []))
    } else {
      setMsg(`❌ ${d.error}`)
    }
  }

  async function openPortal() {
    const r = await fetch('/api/subscribe/portal', { method: 'POST' })
    const d = await r.json()
    if (d.url) window.location.href = d.url
  }

  async function subscribe(plan: string) {
    const r = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    })
    const d = await r.json()
    if (d.url) window.location.href = d.url
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-700">
        {['brokers', 'billing'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${tab === t ? 'text-emerald-400 border-b-2 border-emerald-400' : 'text-slate-400 hover:text-white'}`}>
            {t === 'brokers' ? '🔌 Brokers' : '💳 Billing'}
          </button>
        ))}
      </div>

      {msg && <div className="bg-slate-700/50 rounded-lg px-4 py-3 text-sm text-slate-200">{msg}</div>}

      {/* Brokers Tab */}
      {tab === 'brokers' && (
        <div className="space-y-6">
          {/* Existing connections */}
          {connections.length > 0 && (
            <div className="card">
              <h3 className="text-white font-semibold mb-3">Connected Accounts</h3>
              {connections.map(c => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                  <div>
                    <span className="text-white font-medium capitalize">{c.broker}</span>
                    <span className="ml-2 text-xs text-slate-400">{c.label} {c.paper_mode ? '· Paper' : '· Live'}</span>
                  </div>
                  <span className="badge-halal">Active</span>
                </div>
              ))}
            </div>
          )}

          {/* Add Alpaca */}
          <div className="card">
            <h3 className="text-white font-semibold mb-1">Add Alpaca Account</h3>
            <p className="text-slate-400 text-sm mb-4">
              Get your API key from <a href="https://alpaca.markets" target="_blank" className="text-emerald-400 hover:underline">alpaca.markets</a> → Paper Trading → API Keys
            </p>
            <div className="space-y-3">
              <input value={alpacaKey} onChange={e => setKey(e.target.value)}
                placeholder="API Key (PKXXX...)" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none" />
              <input value={alpacaSecret} onChange={e => setSecret(e.target.value)} type="password"
                placeholder="API Secret" className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none" />
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-slate-300 text-sm cursor-pointer">
                  <input type="checkbox" checked={paper} onChange={e => setPaper(e.target.checked)} className="accent-emerald-500" />
                  Paper Trading Mode
                </label>
              </div>
              <button onClick={saveAlpaca} disabled={saving || !alpacaKey || !alpacaSecret} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
                {saving ? 'Connecting…' : 'Connect Alpaca'}
              </button>
            </div>
          </div>

          {/* Schwab OAuth */}
          <div className="card">
            <h3 className="text-white font-semibold mb-1">Add Schwab Account</h3>
            <p className="text-slate-400 text-sm mb-4">Connect via OAuth — no API key needed. Requires a Schwab Developer account.</p>
            <a href="/api/brokerage/schwab" className="btn-secondary inline-block">Connect Schwab →</a>
          </div>

          {/* IBKR — coming soon */}
          <div className="card opacity-60">
            <h3 className="text-white font-semibold mb-1">Interactive Brokers <span className="badge-unknown ml-2">Coming Soon</span></h3>
            <p className="text-slate-400 text-sm">IBKR Web API integration is in development.</p>
          </div>
        </div>
      )}

      {/* Billing Tab */}
      {tab === 'billing' && (
        <div className="space-y-6">
          {userInfo && (
            <div className="card">
              <h3 className="text-white font-semibold mb-3">Current Plan</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium capitalize">{userInfo.subscription_tier} Plan</div>
                  <div className="text-slate-400 text-sm capitalize">{userInfo.subscription_status}
                    {userInfo.subscription_status === 'trial' && ` — trial ends ${new Date(userInfo.trial_ends_at).toLocaleDateString()}`}
                  </div>
                </div>
                {userInfo.subscription_status === 'active' && (
                  <button onClick={openPortal} className="btn-secondary text-sm">Manage Billing</button>
                )}
              </div>
            </div>
          )}

          {/* Upgrade options */}
          <div className="grid gap-4">
            {[
              { plan: 'basic', name: 'Basic', price: 19, desc: 'Watchlist, portfolio tracking, halal screener' },
              { plan: 'pro',   name: 'Pro',   price: 49, desc: 'Algo engine, auto-trading, all brokers' },
            ].map(p => (
              <div key={p.plan} className="card flex items-center justify-between">
                <div>
                  <div className="text-white font-semibold">{p.name} — ${p.price}/mo</div>
                  <div className="text-slate-400 text-sm">{p.desc}</div>
                </div>
                <button onClick={() => subscribe(p.plan)} className="btn-primary text-sm">
                  {userInfo?.subscription_status === 'trial' ? 'Activate' : 'Switch'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
