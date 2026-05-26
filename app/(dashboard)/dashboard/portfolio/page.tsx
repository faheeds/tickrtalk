'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Position {
  symbol: string; qty: number; side: string
  avgEntryPrice: number; currentPrice: number
  marketValue: number; costBasis: number
  unrealizedPnl: number; unrealizedPct: number
  todayPnl: number; todayPct: number
}

interface Account {
  portfolioValue: number; cash: number; buyingPower: number
  dayPnl: number; dayPnlPct: number; paper: boolean
}

function Skel({ w = 80, h = 16 }: { w?: number; h?: number }) {
  return <div className="skeleton rounded" style={{ width: w, height: h }} />
}

export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[]>([])
  const [account, setAccount]     = useState<Account | null>(null)
  const [loading, setLoading]     = useState(true)
  const [noConn, setNoConn]       = useState(false)

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

  if (!loading && noConn) return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-3xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
          <span style={{ fontSize: 28 }}>🔌</span>
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--ink-1)' }}>No Broker Connected</h2>
        <p style={{ color: 'var(--ink-2)', fontSize: 13, marginBottom: 24 }}>Connect your Alpaca account to view your portfolio.</p>
        <Link href="/dashboard/settings" className="btn-primary">Go to Settings</Link>
      </div>
    </div>
  )

  const totalUnrealized = positions.reduce((s, p) => s + p.unrealizedPnl, 0)
  const totalCost = positions.reduce((s, p) => s + p.costBasis, 0)
  const totalReturn = totalCost > 0 ? (totalUnrealized / totalCost) * 100 : 0

  return (
    <div className="space-y-6 max-w-[1100px] animate-slide-up">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="section-label mb-1">Holdings</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>Portfolio</h1>
        </div>
        {account?.paper && <span className="badge badge-paper">Paper Mode</span>}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {[
          {
            label: 'Portfolio Value',
            value: loading ? null : `$${account?.portfolioValue?.toLocaleString('en-US', { minimumFractionDigits: 2 }) ?? '—'}`,
            featured: true,
          },
          {
            label: 'Cash',
            value: loading ? null : `$${account?.cash?.toLocaleString() ?? '—'}`,
          },
          {
            label: 'Day P&L',
            value: loading ? null : `${(account?.dayPnl ?? 0) >= 0 ? '+' : '–'}$${Math.abs(account?.dayPnl ?? 0).toFixed(2)}`,
            sub: loading ? null : `${account?.dayPnlPct?.toFixed(2) ?? '0'}%`,
            color: (account?.dayPnl ?? 0) >= 0 ? 'var(--up)' : 'var(--down)',
          },
          {
            label: 'Unrealized',
            value: loading ? null : `${totalUnrealized >= 0 ? '+' : '–'}$${Math.abs(totalUnrealized).toFixed(2)}`,
            sub: loading ? null : `${totalReturn >= 0 ? '+' : ''}${totalReturn.toFixed(2)}% total return`,
            color: totalUnrealized >= 0 ? 'var(--up)' : 'var(--down)',
          },
        ].map((s, i) => (
          <div key={i} className={`card ${s.featured ? 'card-featured' : ''}`} style={{ padding: '18px 22px' }}>
            <div className="section-label mb-2">{s.label}</div>
            {s.value == null ? (
              <Skel w={120} h={28} />
            ) : (
              <>
                <div className="stat-num" style={{ fontSize: 22, color: s.color ?? 'var(--ink-1)', letterSpacing: '-0.02em' }}>
                  {s.value}
                </div>
                {s.sub && <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{s.sub}</div>}
              </>
            )}
          </div>
        ))}
      </div>

      {/* Positions table */}
      {loading ? (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <Skel w={160} h={18} />
          </div>
          <div style={{ padding: 24 }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex gap-6 mb-5">
                <Skel w={56} h={14} />
                <Skel w={40} h={14} />
                <Skel w={72} h={14} />
                <Skel w={72} h={14} />
                <Skel w={88} h={14} />
                <Skel w={100} h={14} />
              </div>
            ))}
          </div>
        </div>
      ) : positions.length === 0 ? (
        <div className="card text-center" style={{ padding: '60px 40px' }}>
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.5" className="w-7 h-7">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 4 }}>No open positions</p>
          <p style={{ color: 'var(--ink-3)', fontSize: 12 }}>Place trades via your Alpaca account to see holdings here.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="flex items-center justify-between" style={{ padding: '18px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3">
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-1)' }}>Open Positions</span>
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 99,
                background: 'rgba(99,102,241,0.15)',
                color: '#818CF8',
                border: '1px solid rgba(99,102,241,0.25)',
                fontWeight: 600,
              }}>
                {positions.length}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="text-right">Shares</th>
                  <th className="text-right">Avg Cost</th>
                  <th className="text-right">Price</th>
                  <th className="text-right">Mkt Value</th>
                  <th className="text-right">Unrealized P&L</th>
                  <th className="text-right">Today</th>
                </tr>
              </thead>
              <tbody>
                {positions.map(p => {
                  const up = p.unrealizedPnl >= 0
                  const todayUp = p.todayPnl >= 0
                  return (
                    <tr key={p.symbol}>
                      <td>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-1)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
                          {p.symbol}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
                          {p.side?.toUpperCase()}
                        </div>
                      </td>
                      <td className="text-right" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-1)' }}>
                        {p.qty.toLocaleString()}
                      </td>
                      <td className="text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                        ${p.avgEntryPrice?.toFixed(2)}
                      </td>
                      <td className="text-right" style={{ fontFamily: 'var(--font-mono)', color: 'var(--ink-1)', fontWeight: 600 }}>
                        ${p.currentPrice?.toFixed(2)}
                      </td>
                      <td className="text-right" style={{ fontFamily: 'var(--font-mono)' }}>
                        ${p.marketValue?.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right">
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 13, color: up ? 'var(--up)' : 'var(--down)' }}>
                          {up ? '+' : '–'}${Math.abs(p.unrealizedPnl).toFixed(2)}
                        </div>
                        <div style={{ fontSize: 11, color: up ? 'var(--up)' : 'var(--down)', opacity: 0.7 }}>
                          {up ? '+' : ''}{p.unrealizedPct?.toFixed(2)}%
                        </div>
                      </td>
                      <td className="text-right">
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 12,
                          fontWeight: 600,
                          color: todayUp ? 'var(--up)' : 'var(--down)',
                        }}>
                          {todayUp ? '+' : '–'}${Math.abs(p.todayPnl).toFixed(2)}
                        </span>
                        <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 1 }}>
                          {todayUp ? '+' : ''}{p.todayPct?.toFixed(2)}%
                        </div>
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
