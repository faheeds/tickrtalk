'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function PortfolioPage() {
  const [positions, setPositions] = useState<any[]>([])
  const [account, setAccount] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [noConn, setNoConn] = useState(false)

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

  if (loading) return <div className="text-slate-400 animate-pulse">Loading portfolio…</div>

  if (noConn) return (
    <div className="max-w-lg mx-auto mt-16 text-center">
      <div className="text-5xl mb-4">🔌</div>
      <h2 className="text-2xl font-bold text-white mb-3">Connect Your Broker</h2>
      <p className="text-slate-400 mb-6">Add your Alpaca API key to view your portfolio.</p>
      <Link href="/dashboard/settings" className="btn-primary">Go to Settings</Link>
    </div>
  )

  const totalUnrealized = positions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Portfolio</h1>
        {account?.paper && <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-1 rounded-full font-medium">PAPER MODE</span>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-slate-400 text-xs mb-1">Portfolio Value</div>
          <div className="text-2xl font-bold text-white">${account?.portfolioValue?.toLocaleString() ?? '—'}</div>
        </div>
        <div className="card">
          <div className="text-slate-400 text-xs mb-1">Cash Available</div>
          <div className="text-2xl font-bold text-white">${account?.cash?.toLocaleString() ?? '—'}</div>
        </div>
        <div className="card">
          <div className="text-slate-400 text-xs mb-1">Unrealized P&L</div>
          <div className={`text-2xl font-bold ${totalUnrealized >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {totalUnrealized >= 0 ? '+' : ''}${totalUnrealized.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Positions table */}
      {positions.length === 0 ? (
        <div className="card text-center py-12">
          <div className="text-4xl mb-3">📭</div>
          <p className="text-slate-400">No open positions. Start trading to see your holdings here.</p>
        </div>
      ) : (
        <div className="card">
          <h2 className="text-white font-semibold mb-4">Open Positions ({positions.length})</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-left border-b border-slate-700">
                  <th className="pb-2">Symbol</th>
                  <th className="pb-2">Qty</th>
                  <th className="pb-2">Avg Cost</th>
                  <th className="pb-2">Current</th>
                  <th className="pb-2">Mkt Value</th>
                  <th className="pb-2">Unrealized P&L</th>
                  <th className="pb-2">Today</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p: any) => (
                  <tr key={p.symbol} className="border-b border-slate-700/50 text-slate-300 hover:bg-slate-700/20">
                    <td className="py-2.5 font-semibold text-white">{p.symbol}</td>
                    <td className="py-2.5">{p.qty}</td>
                    <td className="py-2.5">${p.avgEntryPrice?.toFixed(2)}</td>
                    <td className="py-2.5">${p.currentPrice?.toFixed(2)}</td>
                    <td className="py-2.5">${p.marketValue?.toLocaleString()}</td>
                    <td className={`py-2.5 font-medium ${p.unrealizedPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.unrealizedPnl >= 0 ? '+' : ''}${p.unrealizedPnl?.toFixed(2)}
                      <span className="text-xs ml-1 opacity-70">({p.unrealizedPct?.toFixed(1)}%)</span>
                    </td>
                    <td className={`py-2.5 text-xs ${p.todayPnl >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {p.todayPnl >= 0 ? '+' : ''}${p.todayPnl?.toFixed(2)}
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
