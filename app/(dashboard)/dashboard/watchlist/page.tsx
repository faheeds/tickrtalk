'use client'
import { useEffect, useState } from 'react'

interface Quote {
  symbol: string
  price: number | null
  changesPct: number | null
  volume: number | null
  high: number | null
  low: number | null
}

export default function WatchlistPage() {
  const [symbols, setSymbols] = useState<string[]>([])
  const [quotes, setQuotes]   = useState<Record<string, Quote>>({})
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding]   = useState(false)
  const [msg, setMsg]         = useState('')

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
    await fetch('/api/watchlist/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol: sym }),
    })
    loadWatchlist()
  }

  if (loading) return <div className="text-slate-400 animate-pulse">Loading watchlist…</div>

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Watchlist</h1>

      {/* Add symbol */}
      <div className="card">
        <div className="flex gap-3">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSymbol()}
            placeholder="Add ticker (e.g. AAPL)"
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-emerald-500 outline-none uppercase"
          />
          <button onClick={addSymbol} disabled={adding || !input.trim()} className="btn-primary disabled:opacity-50">
            {adding ? 'Adding…' : '+ Add'}
          </button>
        </div>
        {msg && <p className="text-red-400 text-sm mt-2">{msg}</p>}
      </div>

      {/* Watchlist table */}
      {symbols.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">👁</div>
          <p className="text-slate-400">Your watchlist is empty. Add tickers above to track them.</p>
        </div>
      ) : (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-left border-b border-slate-700">
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Price</th>
                  <th className="pb-2">Change</th>
                  <th className="pb-2">High</th>
                  <th className="pb-2">Low</th>
                  <th className="pb-2">Volume</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {symbols.map(sym => {
                  const q = quotes[sym]
                  const up = (q?.changesPct ?? 0) >= 0
                  return (
                    <tr key={sym} className="border-b border-slate-700/50 text-slate-300 hover:bg-slate-700/20">
                      <td className="py-2.5 font-semibold text-white">{sym}</td>
                      <td className="py-2.5">{q?.price != null ? `$${q.price.toFixed(2)}` : '—'}</td>
                      <td className={`py-2.5 font-medium ${up ? 'text-emerald-400' : 'text-red-400'}`}>
                        {q?.changesPct != null ? `${up ? '+' : ''}${q.changesPct.toFixed(2)}%` : '—'}
                      </td>
                      <td className="py-2.5">{q?.high != null ? `$${q.high.toFixed(2)}` : '—'}</td>
                      <td className="py-2.5">{q?.low != null ? `$${q.low.toFixed(2)}` : '—'}</td>
                      <td className="py-2.5">{q?.volume != null ? (q.volume / 1_000_000).toFixed(1) + 'M' : '—'}</td>
                      <td className="py-2.5">
                        <button onClick={() => removeSymbol(sym)} className="text-slate-500 hover:text-red-400 text-xs transition-colors">
                          Remove
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
