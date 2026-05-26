'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Account {
  equity: number
  cash: number
  dayPnl: number
  dayPnlPct: number
  portfolioValue: number
  buyingPower: number
  paper: boolean
}

interface Position {
  symbol: string
  qty: number
  side: string
  avgEntryPrice: number
  currentPrice: number
  marketValue: number
  unrealizedPnl: number
  unrealizedPct: number
  todayPnl: number
}

function Skeleton({ w = 'w-24', h = 'h-8' }: { w?: string; h?: string }) {
  return <div className={`skeleton ${w} ${h} rounded-lg`} />
}

function StatCard({
  label, value, sub, color, featured, icon,
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  color?: string
  featured?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div className={`card card-metric ${featured ? 'card-featured' : ''}`} style={{ minHeight: 110 }}>
      <div className="flex items-start justify-between mb-3">
        <span className="section-label">{label}</span>
        {icon && (
          <span style={{ color: 'var(--ink-3)', opacity: 0.8 }}>{icon}</span>
        )}
      </div>
      <div className={`stat-num text-3xl ${color ?? 'text-white'}`} style={{ letterSpacing: '-0.03em' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: '12px', color: 'var(--ink-3)', marginTop: 6 }}>{sub}</div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [account, setAccount]   = useState<Account | null>(null)
  const [positions, setPositions] = useState<Position[]>([])
  const [loading, setLoading]   = useState(true)
  const [noConn, setNoConn]     = useState(false)
  const [hour] = useState(() => new Date().getHours())

  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

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
      .catch(() => setLoading(false))
  }, [])

  const totalUnrealized = positions.reduce((s, p) => s + (p.unrealizedPnl ?? 0), 0)
  const winCount = positions.filter(p => p.unrealizedPnl > 0).length

  // ── No broker connected ────────────────────────────────────────────────────
  if (!loading && noConn) return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="text-center max-w-md animate-fade-in">
        <div
          className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.1))', border: '1px solid rgba(99,102,241,0.3)' }}
        >
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: '#818CF8' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--ink-1)' }}>Connect Your Broker</h2>
        <p style={{ color: 'var(--ink-2)', fontSize: '14px', marginBottom: 28, lineHeight: 1.6 }}>
          Add your Alpaca API key to start tracking your paper trading portfolio in real time.
        </p>
        <Link href="/dashboard/settings" className="btn-primary" style={{ fontSize: '14px', padding: '11px 28px' }}>
          Go to Settings →
        </Link>
      </div>
    </div>
  )

  // ── Main layout ────────────────────────────────────────────────────────────
  return (
    <div className="space-y-7 max-w-[1200px] animate-slide-up">

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <p style={{ fontSize: '12px', color: 'var(--ink-3)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
            {greeting}
          </p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>
            Your Portfolio
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {account?.paper && (
            <span className="badge badge-paper">Paper Mode</span>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl" style={{ background: 'rgba(0,201,167,0.1)', border: '1px solid rgba(0,201,167,0.2)' }}>
            <span className="live-dot" />
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--up)', letterSpacing: '0.04em' }}>LIVE</span>
          </div>
        </div>
      </div>

      {/* ── Hero metric row ──────────────────────────────────────────── */}
      <div className="grid gap-4" style={{ gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
        {/* Portfolio Value — featured */}
        <div className="card card-featured" style={{ padding: '24px 28px' }}>
          <div className="section-label mb-3">Portfolio Value</div>
          {loading ? <Skeleton w="w-40" h="h-10" /> : (
            <>
              <div
                className="stat-num"
                style={{ fontSize: 36, letterSpacing: '-0.03em', color: 'var(--ink-1)', marginBottom: 8 }}
              >
                ${account?.portfolioValue?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—'}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="stat-num text-sm"
                  style={{ color: (account?.dayPnl ?? 0) >= 0 ? 'var(--up)' : 'var(--down)' }}
                >
                  {(account?.dayPnl ?? 0) >= 0 ? '▲' : '▼'}
                  {' '}
                  {(account?.dayPnlPct ?? 0) >= 0 ? '+' : ''}{account?.dayPnlPct?.toFixed(2) ?? '0.00'}% today
                </span>
              </div>
            </>
          )}
        </div>

        {/* Cash */}
        <StatCard
          label="Cash"
          value={loading ? <Skeleton /> : `$${account?.cash?.toLocaleString() ?? '—'}`}
          sub="Available to trade"
          icon={
            <svg viewBox="0 0 16 16" fill="currentColor" className="w-4 h-4">
              <path d="M2 4a2 2 0 012-2h8a2 2 0 012 2v1H2V4zm0 3h12v5a2 2 0 01-2 2H4a2 2 0 01-2-2V7zm4 2a1 1 0 000 2h4a1 1 0 000-2H6z"/>
            </svg>
          }
        />

        {/* Day P&L */}
        <div className="card card-metric">
          <div className="section-label mb-3">Day P&L</div>
          {loading ? <Skeleton /> : (
            <>
              <div
                className="stat-num text-3xl"
                style={{
                  color: (account?.dayPnl ?? 0) >= 0 ? 'var(--up)' : 'var(--down)',
                  letterSpacing: '-0.03em',
                }}
              >
                {(account?.dayPnl ?? 0) >= 0 ? '+' : ''}${Math.abs(account?.dayPnl ?? 0).toFixed(2)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>
                {(account?.dayPnlPct ?? 0) >= 0 ? '+' : ''}{account?.dayPnlPct?.toFixed(2) ?? '0.00'}% change
              </div>
            </>
          )}
        </div>

        {/* Unrealized P&L */}
        <div className="card card-metric">
          <div className="section-label mb-3">Unrealized P&L</div>
          {loading ? <Skeleton /> : (
            <>
              <div
                className="stat-num text-3xl"
                style={{
                  color: totalUnrealized >= 0 ? 'var(--up)' : 'var(--down)',
                  letterSpacing: '-0.03em',
                }}
              >
                {totalUnrealized >= 0 ? '+' : ''}${Math.abs(totalUnrealized).toFixed(2)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)', marginTop: 6 }}>
                {positions.length} open · {winCount} winning
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Open positions ───────────────────────────────────────────── */}
      {loading ? (
        <div className="card" style={{ padding: '24px' }}>
          <div className="skeleton w-40 h-5 mb-5 rounded" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex gap-4 mb-4">
              <div className="skeleton w-16 h-4 rounded" />
              <div className="skeleton w-12 h-4 rounded" />
              <div className="skeleton w-24 h-4 rounded" />
              <div className="skeleton w-20 h-4 rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : positions.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Table header */}
          <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-3">
              <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-1)' }}>Open Positions</span>
              <span
                className="stat-num"
                style={{
                  fontSize: 11, padding: '2px 8px', borderRadius: 99,
                  background: 'rgba(99,102,241,0.15)',
                  color: '#818CF8',
                  border: '1px solid rgba(99,102,241,0.25)',
                }}
              >
                {positions.length}
              </span>
            </div>
            <Link href="/dashboard/portfolio" className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>
              View all →
            </Link>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Symbol</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Avg Cost</th>
                  <th className="text-right">Current</th>
                  <th className="text-right">Mkt Value</th>
                  <th className="text-right">Unrealized P&L</th>
                  <th className="text-right">Today</th>
                </tr>
              </thead>
              <tbody>
                {positions.slice(0, 6).map(p => {
                  const up = p.unrealizedPnl >= 0
                  const todayUp = p.todayPnl >= 0
                  return (
                    <tr key={p.symbol}>
                      <td>
                        <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-1)', fontFamily: 'var(--font-mono)' }}>
                          {p.symbol}
                        </span>
                      </td>
                      <td className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                        {p.qty.toLocaleString()}
                      </td>
                      <td className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                        ${p.avgEntryPrice?.toFixed(2)}
                      </td>
                      <td className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--ink-1)' }}>
                        ${p.currentPrice?.toFixed(2)}
                      </td>
                      <td className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                        ${p.marketValue?.toLocaleString()}
                      </td>
                      <td className="text-right">
                        <div style={{ color: up ? 'var(--up)' : 'var(--down)', fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600 }}>
                          {up ? '+' : '–'}${Math.abs(p.unrealizedPnl).toFixed(2)}
                        </div>
                        <div style={{ color: up ? 'var(--up)' : 'var(--down)', fontSize: 11, opacity: 0.7 }}>
                          {up ? '+' : ''}{p.unrealizedPct?.toFixed(2)}%
                        </div>
                      </td>
                      <td className="text-right">
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 12,
                          color: todayUp ? 'var(--up)' : 'var(--down)',
                          fontWeight: 600,
                        }}>
                          {todayUp ? '+' : '–'}${Math.abs(p.todayPnl).toFixed(2)}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : !loading && (
        <div className="card text-center" style={{ padding: '60px 40px' }}>
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7" style={{ color: '#818CF8' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
            </svg>
          </div>
          <p style={{ color: 'var(--ink-2)', fontSize: 14, marginBottom: 4 }}>No open positions</p>
          <p style={{ color: 'var(--ink-3)', fontSize: 12 }}>Start trading to see your portfolio here.</p>
        </div>
      )}

      {/* ── Quick links ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4">
        {[
          {
            href: '/dashboard/journal',
            label: 'Trade Journal',
            desc: 'Review closed trades & P&L',
            color: '#6366F1',
            bg: 'rgba(99,102,241,0.1)',
            border: 'rgba(99,102,241,0.2)',
            icon: (
              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/>
            ),
          },
          {
            href: '/dashboard/watchlist',
            label: 'Watchlist',
            desc: 'Track symbols & live quotes',
            color: '#38BDF8',
            bg: 'rgba(56,189,248,0.1)',
            border: 'rgba(56,189,248,0.2)',
            icon: (
              <>
                <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/>
                <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
              </>
            ),
          },
          {
            href: '/dashboard/algo',
            label: 'Algo Engine',
            desc: 'Automate your trading strategy',
            color: '#A78BFA',
            bg: 'rgba(167,139,250,0.1)',
            border: 'rgba(167,139,250,0.2)',
            icon: (
              <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd"/>
            ),
          },
        ].map(item => (
          <Link key={item.href} href={item.href}>
            <div
              className="card card-lift cursor-pointer"
              style={{ padding: '20px 22px', border: `1px solid ${item.border}`, background: item.bg }}
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                style={{ background: `${item.color}22`, border: `1px solid ${item.border}` }}
              >
                <svg viewBox="0 0 20 20" fill={item.color} className="w-4.5 h-4.5" style={{ width: 18, height: 18 }}>
                  {item.icon}
                </svg>
              </div>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-1)', marginBottom: 3 }}>{item.label}</div>
              <div style={{ fontSize: 12, color: 'var(--ink-3)' }}>{item.desc}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
