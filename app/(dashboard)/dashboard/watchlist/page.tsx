'use client'
import { useEffect, useState, useRef } from 'react'

interface Quote {
  symbol: string
  price: number | null
  changesPct: number | null
  volume: number | null
  high: number | null
  low: number | null
  prevClose: number | null
}

export default function WatchlistPage() {
  const [symbols, setSymbols] = useState<string[]>([])
  const [quotes, setQuotes]   = useState<Record<string, Quote>>({})
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)
  const [msg, setMsg]         = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function loadWatchlist() {
    const r = await fetch('/api/watchlist/quotes').catch(() => null)
    if (!r) { setLoading(false); return }
    const d = await r.json()
    setSymbols(d.symbols ?? [])
    setQuotes(d.quotes ?? {})
    setLoading(false)
  }

  useEffect(() => { loadWatchlist() }, [])

  async function addSymbol() {
    const sym = input.trim().toUpperCase()
    if (!sym) return
    setAdding(true); setMsg('')
    const r = await fetch('/api/watchlist/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: sym }),
    })
    const d = await r.json()
    setAdding(false)
    if (d.ok) { setInput(''); loadWatchlist() }
    else setMsg(d.error ?? 'Failed to add symbol')
  }

  async function removeSymbol(sym: string) {
    setRemoving(sym)
    await fetch('/api/watchlist/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: sym }),
    })
    setRemoving(null)
    loadWatchlist()
  }

  const totalValue = symbols.reduce((s, sym) => {
    const q = quotes[sym]
    return s + (q?.price ?? 0)
  }, 0)

  return (
    <div className="space-y-6 max-w-[900px] animate-slide-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label mb-1">Market Tracking</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>Watchlist</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="live-dot" />
          <span style={{ fontSize: 12, color: 'var(--up)', fontWeight: 600 }}>Prices live</span>
        </div>
      </div>

      {/* Add ticker */}
      <div className="card" style={{ padding: '20px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink-2)', marginBottom: 12 }}>
          Add a Symbol
        </div>
        <div className="flex gap-3">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && addSymbol()}
            placeholder="Ticker symbol (e.g. AAPL, NVDA, MSFT)"
            className="input flex-1"
            style={{ textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}
            maxLength={10}
          />
          <button
            onClick={addSymbol}
            disabled={adding || !input.trim()}
            className="btn-primary"
          >
            {adding ? (
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="32" strokeLinecap="round"/>
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
                <path d="M8 2a1 1 0 011 1v4h4a1 1 0 010 2H9v4a1 1 0 01-2 0V9H3a1 1 0 010-2h4V3a1 1 0 011-1z"/>
              </svg>
            )}
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
        {msg && (
          <div className="flex items-center gap-2 mt-3" style={{ color: 'var(--down)', fontSize: 12 }}>
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5 flex-shrink-0">
              <path fillRule="evenodd" d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8zm8-3a1 1 0 01.894.553l2 4a1 1 0 01-1.788.894L8 8.236l-1.106 2.21a1 1 0 01-1.788-.894l2-4A1 1 0 018 5z" clipRule="evenodd"/>
            </svg>
            {msg}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="skeleton rounded w-32 h-4" />
          </div>
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
              <div className="skeleton rounded w-16 h-5" />
              <div className="skeleton rounded w-20 h-4 ml-auto" />
              <div className="skeleton rounded w-16 h-4" />
              <div className="skeleton rounded w-24 h-4" />
              <div className="skeleton rounded w-24 h-4" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && symbols.length === 0 && (
        <div className="card text-center" style={{ padding: '60px 40px' }}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(56,189,248,0.1)', border: '1px solid rgba(56,189,248,0.2)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#38BDF8" strokeWidth="1.5" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 4 }}>Your watchlist is empty</p>
          <p style={{ color: 'var(--ink-3)', fontSize: 12 }}>Add tickers above to track live prices and changes.</p>
        </div>
      )}

      {/* Watchlist table */}
      {!loading && symbols.length > 0 && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="flex items-center justify-between" style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3">
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-1)' }}>Tracked Symbols</span>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 99,
                background: 'rgba(56,189,248,0.12)', color: '#38BDF8',
                border: '1px solid rgba(56,189,248,0.25)', fontWeight: 600,
              }}>
                {symbols.length}
              </span>
            </div>
            <button onClick={loadWatchlist} className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path fillRule="evenodd" d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.417A6 6 0 118 2v1z" clipRule="evenodd"/>
                <path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966c.12.1.12.284 0 .384L8.41 4.658A.25.25 0 018 4.466z"/>
              </svg>
              Refresh
            </button>
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th className="text-right">Price</th>
                <th className="text-right">Change</th>
                <th className="text-right">High</th>
                <th className="text-right">Low</th>
                <th className="text-right">Volume</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {symbols.map(sym => {
                const q = quotes[sym]
                const up = (q?.changesPct ?? 0) >= 0
                const hasData = q?.price != null

                return (
                  <tr key={sym}>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-1)', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' }}>
                        {sym}
                      </span>
                    </td>
                    <td className="text-right">
                      {hasData ? (
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color: 'var(--ink-1)' }}>
                          ${q.price!.toFixed(2)}
                        </span>
                      ) : (
                        <span className="skeleton rounded inline-block" style={{ width: 64, height: 14 }} />
                      )}
                    </td>
                    <td className="text-right">
                      {q?.changesPct != null ? (
                        <span
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600,
                            color: up ? 'var(--up)' : 'var(--down)',
                            background: up ? 'var(--up-dim)' : 'var(--down-dim)',
                            padding: '3px 10px', borderRadius: 99,
                          }}
                        >
                          {up ? '▲' : '▼'} {Math.abs(q.changesPct).toFixed(2)}%
                        </span>
                      ) : (
                        <span style={{ color: 'var(--ink-3)' }}>—</span>
                      )}
                    </td>
                    <td className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {q?.high != null ? `$${q.high.toFixed(2)}` : '—'}
                    </td>
                    <td className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                      {q?.low != null ? `$${q.low.toFixed(2)}` : '—'}
                    </td>
                    <td className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-3)' }}>
                      {q?.volume != null
                        ? q.volume >= 1_000_000 ? `${(q.volume / 1_000_000).toFixed(1)}M` : `${(q.volume / 1000).toFixed(0)}K`
                        : '—'}
                    </td>
                    <td>
                      <button
                        onClick={() => removeSymbol(sym)}
                        disabled={removing === sym}
                        className="btn-ghost"
                        style={{ padding: '5px 12px', fontSize: 12, color: removing === sym ? 'var(--ink-3)' : undefined }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--down)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--ink-3)'}
                      >
                        {removing === sym ? '…' : 'Remove'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
