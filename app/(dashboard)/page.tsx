'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Account {
  equity: number; cash: number; dayPnl: number; dayPnlPct: number
  portfolioValue: number; paper: boolean
}

export default function DashboardPage() {
  const [account, setAccount]   = useState<Account | null>(null)
  const [positions, setPositions] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [noConn, setNoConn]     = useState(false)

  useEffect(() => {
    fetch('/api/portfolio')
      .then(r => {
        if (r.status === 428) { setNoConn(true); setLoading(false); return null }
        return r.json()
      })
      .then(d => {
        if (!d) return
        setAccount(d.account)
        setPositions(d.positions ?? [])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="text-slate-400 animate-pulse">Loading account…</div>

  if (noConn) return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <div className="text-5xl mb-4">🔌</div>
      <h2 className="text-2xl font-bold text-white mb-3">Connect Your Broker</h2>
      <p className="text-slate-400 mb-6">Add your Alpaca API key to get started with paper trading.</p>
      <Link href="/dashboard/settings" className="btn-primary">Go to Settings</Link>
    </div>
  )

  const totalPnl     = positions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0)
  const openCount    = positions.length
  const positiveCnt  = positions.filter(p => p.unrealizedPnl > 0).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Overview</h1>
        {account?.paper && <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full font-medium">PAPER MODE</span>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Portfolio Value', value: `$${account?.portfolioValue?.toLocaleString() ?? '—'}` },
          { label: 'Cash',            value: `$${account?.cash?.toLocaleString() ?? '—'}` },
          { label: 'Day P&L',         value: `${account?.dayPnl >= 0 ? '+' : ''}$${account?.dayPnl?.toFixed(2) ?? '—'}`,
            sub: `${account?.dayPnlPct?.toFixed(2) ?? '0'}%`,
            color: account?.dayPnl >= 0 ? 'text-emerald-400' : 'text-red-400' },
          { label: 'Open Positions',  value: openCount, sub: `${positiveCnt} winning` },
        ].map(s => (
          <div key={s.label} className="card">
            <div className="text-slate-400 text-xs mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color ?? 'text-white'}`}>{s.value}</div>
            {s.sub && <div className="text-slate-500 text-xs mt-0.5">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Open positions preview */}
      {positions.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold">Open Positions</h2>
            <Link href="/dashboard/portfolio" className="text-emerald-400 text-sm hover:underline">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-left border-b border-slate-700">
                  <th className="pb-2">Symbol</th><th className="pb-2">Qty</th>
                  <th className="pb-2">Avg Cost</th><th className="pb-2">Current</th>
                  <th className="pb-2">Unrealized P&L</th>
                </tr>
              </thead>
              <tbody>
                {positions.slice(0, 5).map((p: any) => (
                  <tr key={p.symbol} className="border-b border-slate-700/50 text-slate-300">
                    <td className="py-2 font-medium text-white">{p.symbol}</td>
                    <td className="py-2">{p.qty}</td>
                    <td className="py-2">${p.avgEntryPrice}</td>
                    <td className="py-2">${p.currentPrice}</td>
                    <td className={`py-2 font-medium ${p.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.unrealizedPnl >= 0 ? '+' : ''}${p.unrealizedPnl?.toFixed(2)} ({p.unrealizedPct?.toFixed(1)}%)
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
