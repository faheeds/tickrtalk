'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import type { JournalTrade } from '@/app/api/journal/route'

type ExtendedTrade = JournalTrade & { broker?: string }

// ─── Cumulative P&L Sparkline ─────────────────────────────────────────────────
function PnlSparkline({ trades }: { trades: ExtendedTrade[] }) {
  const W = 900, H = 180, PAD = 16

  const daily = useMemo(() => {
    const byDate: Record<string, number> = {}
    trades
      .filter(t => t.pnl !== null)
      .forEach(t => { byDate[t.date] = (byDate[t.date] ?? 0) + (t.pnl ?? 0) })
    const sorted = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]))
    let cum = 0
    return sorted.map(([date, pnl]) => { cum += pnl; return { date, cum } })
  }, [trades])

  if (daily.length < 2) {
    return (
      <div className="flex items-center justify-center" style={{ height: 180, color: 'var(--ink-3)', fontSize: 13 }}>
        Not enough trade data to chart yet.
      </div>
    )
  }

  const minY    = Math.min(...daily.map(d => d.cum))
  const maxY    = Math.max(...daily.map(d => d.cum))
  const rangeY  = maxY - minY || 1
  const isPos   = daily[daily.length - 1].cum >= 0
  const lineClr = isPos ? '#00C9A7' : '#F43F5E'
  const fillId  = `pnl-grad-${isPos ? 'up' : 'dn'}`

  const pts = daily.map((d, i) => {
    const x = PAD + (i / (daily.length - 1)) * (W - 2 * PAD)
    const y = PAD + (1 - (d.cum - minY) / rangeY) * (H - 2 * PAD)
    return `${x},${y}`
  })

  const fillPts = [`${PAD},${H - PAD}`, ...pts, `${W - PAD},${H - PAD}`]

  const fmt = (n: number) => {
    const abs = Math.abs(n)
    const s = abs >= 1000 ? `${(abs / 1000).toFixed(1)}k` : abs.toFixed(0)
    return n >= 0 ? `+$${s}` : `–$${s}`
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineClr} stopOpacity="0.18" />
          <stop offset="100%" stopColor={lineClr} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts.join(' ')} fill={`url(#${fillId})`} />
      <polyline points={pts.join(' ')} fill="none" stroke={lineClr} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {minY < 0 && maxY > 0 && (
        <line
          x1={PAD} y1={PAD + (maxY / rangeY) * (H - 2 * PAD)}
          x2={W - PAD} y2={PAD + (maxY / rangeY) * (H - 2 * PAD)}
          stroke="rgba(255,255,255,0.08)" strokeWidth="1" strokeDasharray="4 4"
        />
      )}
      <text x={W - PAD + 4} y={PAD + 4} fill="var(--ink-3)" fontSize="10" textAnchor="start">{fmt(maxY)}</text>
      <text x={W - PAD + 4} y={H - PAD + 4} fill="var(--ink-3)" fontSize="10" textAnchor="start">{fmt(minY)}</text>
    </svg>
  )
}

// ─── Verdict Badge ─────────────────────────────────────────────────────────────
function VerdictBadge({ v }: { v: string }) {
  const cls = v === 'HALAL' ? 'badge-halal'
    : v === 'HARAM'    ? 'badge-haram'
    : v === 'DOUBTFUL' ? 'badge-doubtful'
    : 'badge-unknown'
  return <span className={`badge ${cls}`} style={{ fontSize: 10 }}>{v}</span>
}

// ─── Broker pill ──────────────────────────────────────────────────────────────
function BrokerPill({ broker }: { broker?: string }) {
  if (!broker) return null
  return (
    <span style={{
      fontSize: 9, padding: '1px 6px', borderRadius: 99, fontWeight: 600,
      background: 'rgba(99,102,241,0.12)', color: '#A5B4FC',
      border: '1px solid rgba(99,102,241,0.2)', letterSpacing: '0.02em',
      textTransform: 'uppercase', display: 'inline-block',
    }}>
      {broker}
    </span>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function Skel({ w = 80, h = 14 }: { w?: number; h?: number }) {
  return <div className="skeleton rounded" style={{ width: w, height: h }} />
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25

export default function JournalPage() {
  const [allTrades, setAllTrades]   = useState<ExtendedTrade[]>([])
  const [loading, setLoading]       = useState(true)
  const [sources, setSources]       = useState<string[]>([])
  const [noBroker, setNoBroker]     = useState(false)

  // Filters
  const [search, setSearch]                 = useState('')
  const [fromDate, setFromDate]             = useState('')
  const [toDate, setToDate]                 = useState('')
  const [outcomeFilter, setOutcomeFilter]   = useState<'all' | 'win' | 'loss'>('all')
  const [halalFilter, setHalalFilter]       = useState<'all' | 'HALAL' | 'HARAM' | 'DOUBTFUL' | 'UNKNOWN'>('all')
  const [brokerFilter, setBrokerFilter]     = useState('all')

  // Table state
  const [page, setPage]     = useState(1)
  const [sortKey, setSortKey] = useState<keyof ExtendedTrade>('date')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)

  // Default year range
  useEffect(() => {
    const yr = new Date().getFullYear()
    setFromDate(`${yr}-01-01`)
    setToDate(`${yr}-12-31`)
  }, [])

  // ── Fetch from both Alpaca + SnapTrade ─────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true)

      const [alpacaRes, snapRes] = await Promise.all([
        fetch('/api/journal').then(r => r.json()).catch(() => ({ trades: [], error: null })),
        fetch('/api/snaptrade/activities').then(r => r.json()).catch(() => ({ trades: [], registered: false })),
      ])

      const alpacaTrades: ExtendedTrade[] = (alpacaRes.trades ?? []).map((t: JournalTrade) => ({
        ...t,
        broker: alpacaRes.paper ? 'Alpaca Paper' : 'Alpaca',
      }))

      const snapTrades: ExtendedTrade[] = (snapRes.trades ?? [])

      const merged = [...alpacaTrades, ...snapTrades].sort(
        (a, b) => b.date.localeCompare(a.date)
      )

      const srcSet = new Set<string>()
      merged.forEach(t => { if (t.broker) srcSet.add(t.broker) })
      setSources(Array.from(srcSet))

      setAllTrades(merged)

      // No broker at all — alpacaRes.connected covers the case where a connection
      // exists in the DB but credentials couldn't be decrypted (wrong key).
      const hasAlpaca    = alpacaTrades.length > 0 || alpacaRes.broker || alpacaRes.connected
      const hasSnap      = snapRes.registered
      setNoBroker(!hasAlpaca && !hasSnap)

      setLoading(false)
    }
    load()
  }, [])

  // ── Filtered + sorted ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let out = allTrades.filter(t => {
      if (search && !t.symbol.includes(search.toUpperCase())) return false
      if (fromDate && t.date < fromDate) return false
      if (toDate && t.date > toDate) return false
      if (outcomeFilter === 'win'  && (t.pnl ?? 0) <= 0) return false
      if (outcomeFilter === 'loss' && (t.pnl ?? 0) > 0)  return false
      if (halalFilter !== 'all' && t.halal !== halalFilter) return false
      if (brokerFilter !== 'all' && t.broker !== brokerFilter) return false
      return true
    })

    out = [...out].sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      if (typeof va === 'string') return va.localeCompare(vb as string) * sortDir
      return ((va as number) - (vb as number)) * sortDir
    })

    return out
  }, [allTrades, search, fromDate, toDate, outcomeFilter, halalFilter, brokerFilter, sortKey, sortDir])

  // ── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const withPnl  = filtered.filter(t => t.pnl !== null)
    const wins     = withPnl.filter(t => (t.pnl ?? 0) > 0)
    const losses   = withPnl.filter(t => (t.pnl ?? 0) <= 0)
    const totalPnl = withPnl.reduce((s, t) => s + (t.pnl ?? 0), 0)
    const winRate  = withPnl.length ? (wins.length / withPnl.length) * 100 : 0
    const best     = wins.length   ? Math.max(...wins.map(t => t.pnl ?? 0)) : 0
    const worst    = losses.length ? Math.min(...losses.map(t => t.pnl ?? 0)) : 0
    const avgWin   = wins.length   ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0
    const days     = new Set(withPnl.map(t => t.date)).size
    return { totalPnl, winRate, best, worst, avgWin, days, wins: wins.length, losses: losses.length, total: withPnl.length }
  }, [filtered])

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageTrades = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function sort(key: keyof ExtendedTrade) {
    if (sortKey === key) setSortDir(d => d === 1 ? -1 : 1)
    else { setSortKey(key); setSortDir(-1) }
    setPage(1)
  }

  function setYear(yr: number) {
    setFromDate(`${yr}-01-01`); setToDate(`${yr}-12-31`); setPage(1)
  }

  // ── CSV export ─────────────────────────────────────────────────────────────
  function exportCSV() {
    const header = 'Date,Symbol,Side,Qty,Entry,Exit,P&L,P&L%,Result,Halal,Broker'
    const rows = filtered.map(t =>
      [t.date, t.symbol, t.side, t.qty, t.entry ?? '', t.exit,
        t.pnl ?? '', t.pnlPct ?? '', (t.pnl ?? 0) > 0 ? 'WIN' : 'LOSS',
        t.halal, t.broker ?? ''].join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a'); a.href = url
    a.download = 'tickrtalk-journal.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  function fmtPnl(n: number) {
    const abs = Math.abs(n)
    const s = abs >= 1000
      ? abs.toLocaleString('en-US', { maximumFractionDigits: 0 })
      : abs.toFixed(2)
    return n >= 0 ? `+$${s}` : `–$${s}`
  }

  const yr = new Date().getFullYear()

  // ── No broker connected ────────────────────────────────────────────────────
  if (!loading && noBroker) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-3xl mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.25)' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#818CF8" strokeWidth="1.5" className="w-8 h-8">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--ink-1)' }}>No Broker Connected</h2>
          <p style={{ color: 'var(--ink-2)', fontSize: 13, lineHeight: 1.6, marginBottom: 24 }}>
            Connect your Fidelity, Robinhood, Schwab, IBKR, Alpaca, or other brokerage to view your trade history and halal analysis.
          </p>
          <Link href="/dashboard/settings?tab=brokers" className="btn-primary">
            Connect a Broker
          </Link>
        </div>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl animate-slide-up">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="section-label mb-1">Performance</p>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--ink-1)', letterSpacing: '-0.02em' }}>Trade Journal</h1>
          {sources.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {sources.map(s => <BrokerPill key={s} broker={s} />)}
            </div>
          )}
        </div>

        {/* Year + date pickers */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
            {[yr - 1, yr].map(y => (
              <button key={y} onClick={() => setYear(y)}
                style={{
                  padding: '5px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                  border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                  background: fromDate.startsWith(String(y)) ? 'rgba(99,102,241,0.2)' : 'transparent',
                  color: fromDate.startsWith(String(y)) ? '#A5B4FC' : 'var(--ink-3)',
                }}>
                {y}
              </button>
            ))}
          </div>
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1) }} className="input" style={{ fontSize: 12, padding: '6px 10px' }} />
          <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>to</span>
          <input type="date" value={toDate}   onChange={e => { setToDate(e.target.value);   setPage(1) }} className="input" style={{ fontSize: 12, padding: '6px 10px' }} />
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {loading
          ? [...Array(6)].map((_, i) => (
              <div key={i} className="card" style={{ padding: '16px 18px' }}>
                <Skel w={60} h={10} />
                <div style={{ marginTop: 10 }}><Skel w={80} h={22} /></div>
                <div style={{ marginTop: 6 }}><Skel w={60} h={10} /></div>
              </div>
            ))
          : [
              { label: 'Total P&L',     value: fmtPnl(stats.totalPnl), sub: `${stats.wins}W / ${stats.losses}L`,  color: stats.totalPnl >= 0 ? 'var(--up)' : 'var(--down)', featured: true },
              { label: 'Win Rate',      value: `${stats.winRate.toFixed(1)}%`,  sub: `${stats.total} closed`,       color: stats.winRate >= 50 ? 'var(--up)' : 'var(--down)' },
              { label: 'Best Trade',    value: stats.best  ? fmtPnl(stats.best)  : '—', sub: 'single trade',       color: 'var(--up)' },
              { label: 'Worst Trade',   value: stats.worst ? fmtPnl(stats.worst) : '—', sub: 'single trade',       color: 'var(--down)' },
              { label: 'Avg Win',       value: stats.avgWin ? fmtPnl(stats.avgWin) : '—', sub: 'per win',           color: 'var(--up)' },
              { label: 'Trading Days',  value: String(stats.days), sub: 'with closed trades',                       color: 'var(--ink-1)' },
            ].map((s, i) => (
              <div key={i} className={`card ${s.featured ? 'card-featured' : ''}`} style={{ padding: '16px 18px' }}>
                <div className="section-label mb-2">{s.label}</div>
                <div className="stat-num" style={{ fontSize: 20, color: s.color, letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 4 }}>{s.sub}</div>
              </div>
            ))}
      </div>

      {/* Chart */}
      {!loading && filtered.some(t => t.pnl !== null) && (
        <div className="card" style={{ padding: '20px 24px' }}>
          <div className="section-label mb-3">Cumulative Realized P&L</div>
          <PnlSparkline trades={filtered} />
        </div>
      )}

      {/* Trade log */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {/* Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-3" style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-2">
            <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink-1)' }}>Trade Log</span>
            {!loading && (
              <span style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                background: 'rgba(99,102,241,0.12)', color: '#A5B4FC',
                border: '1px solid rgba(99,102,241,0.25)',
              }}>{filtered.length}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1) }}
              placeholder="Search symbol…"
              className="input"
              style={{ fontSize: 12, padding: '6px 10px', width: 130 }}
            />
            <select value={outcomeFilter} onChange={e => { setOutcomeFilter(e.target.value as 'all'|'win'|'loss'); setPage(1) }} className="select" style={{ fontSize: 12 }}>
              <option value="all">All Trades</option>
              <option value="win">Wins</option>
              <option value="loss">Losses</option>
            </select>
            <select value={halalFilter} onChange={e => { setHalalFilter(e.target.value as typeof halalFilter); setPage(1) }} className="select" style={{ fontSize: 12 }}>
              <option value="all">All Halal</option>
              <option value="HALAL">Halal</option>
              <option value="HARAM">Haram</option>
              <option value="DOUBTFUL">Doubtful</option>
              <option value="UNKNOWN">Unknown</option>
            </select>
            {sources.length > 1 && (
              <select value={brokerFilter} onChange={e => { setBrokerFilter(e.target.value); setPage(1) }} className="select" style={{ fontSize: 12 }}>
                <option value="all">All Brokers</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
            <button onClick={exportCSV} className="btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}>
              <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
                <path d="M.5 9.9a.5.5 0 01.5.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z"/>
                <path d="M7.646 11.854a.5.5 0 00.708 0l3-3a.5.5 0 00-.708-.708L8.5 10.293V1.5a.5.5 0 00-1 0v8.793L5.354 8.146a.5.5 0 10-.708.708l3 3z"/>
              </svg>
              CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                {([
                  ['date',   'Date',    false],
                  ['symbol', 'Symbol',  false],
                  [null,     'Side',    false],
                  ['qty',    'Qty',     true ],
                  ['entry',  'Entry',   true ],
                  ['exit',   'Exit',    true ],
                  ['pnl',    'P&L',     true ],
                  ['pnlPct', 'P&L %',   true ],
                  [null,     'Result',  false],
                  [null,     'Halal',   false],
                  [null,     'Broker',  false],
                ] as [keyof ExtendedTrade | null, string, boolean][]).map(([key, label, right]) => (
                  <th key={label}
                    onClick={() => key && sort(key)}
                    className={right ? 'text-right' : ''}
                    style={{ cursor: key ? 'pointer' : 'default' }}
                  >
                    {label}
                    {key ? (sortKey === key ? (sortDir === -1 ? ' ↓' : ' ↑') : '') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i}>
                    {[80, 56, 48, 36, 64, 64, 72, 60, 48, 56, 60].map((w, j) => (
                      <td key={j} className={j >= 3 && j <= 7 ? 'text-right' : ''}>
                        <Skel w={w} h={13} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : pageTrades.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--ink-3)', fontSize: 13 }}>
                    {allTrades.length === 0
                      ? 'No closed trades found. Connect a broker and make some trades!'
                      : 'No trades match the current filters.'}
                  </td>
                </tr>
              ) : pageTrades.map(t => {
                const isWin = (t.pnl ?? 0) > 0
                return (
                  <tr key={t.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
                      {t.date}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink-1)', fontFamily: 'var(--font-mono)', letterSpacing: '0.02em' }}>
                        {t.symbol}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 700,
                        background: t.side === 'LONG' ? 'var(--up-dim)' : 'var(--down-dim)',
                        color: t.side === 'LONG' ? 'var(--up)' : 'var(--down)',
                        border: `1px solid ${t.side === 'LONG' ? 'var(--up-border)' : 'var(--down-border)'}`,
                      }}>
                        {t.side}
                      </span>
                    </td>
                    <td className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                      {t.qty.toLocaleString()}
                    </td>
                    <td className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-3)' }}>
                      {t.entry !== null ? `$${t.entry.toFixed(2)}` : '—'}
                    </td>
                    <td className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--ink-1)', fontWeight: 600 }}>
                      ${t.exit.toFixed(2)}
                    </td>
                    <td className="text-right">
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700,
                        color: t.pnl !== null ? (isWin ? 'var(--up)' : 'var(--down)') : 'var(--ink-3)',
                      }}>
                        {t.pnl !== null ? fmtPnl(t.pnl) : '—'}
                      </span>
                    </td>
                    <td className="text-right" style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: t.pnlPct !== null ? (isWin ? 'var(--up)' : 'var(--down)') : 'var(--ink-3)' }}>
                      {t.pnlPct !== null ? `${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct.toFixed(2)}%` : '—'}
                    </td>
                    <td>
                      {t.pnl !== null ? (
                        <span style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 99, fontWeight: 700,
                          background: isWin ? 'var(--up-dim)' : 'var(--down-dim)',
                          color: isWin ? 'var(--up)' : 'var(--down)',
                          border: `1px solid ${isWin ? 'var(--up-border)' : 'var(--down-border)'}`,
                        }}>
                          {isWin ? 'WIN' : 'LOSS'}
                        </span>
                      ) : <span style={{ color: 'var(--ink-3)' }}>—</span>}
                    </td>
                    <td><VerdictBadge v={t.halal} /></td>
                    <td><BrokerPill broker={t.broker} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between" style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: 12, color: 'var(--ink-3)' }}>
              {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }}>
                ‹ Prev
              </button>
              <span style={{ fontSize: 12, color: 'var(--ink-3)', padding: '0 8px' }}>{page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="btn-ghost" style={{ fontSize: 12, padding: '5px 12px' }}>
                Next ›
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
