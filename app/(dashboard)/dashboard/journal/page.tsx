'use client'
import { useState, useEffect, useMemo } from 'react'
import type { JournalTrade } from '@/app/api/journal/route'

// ─── SVG Sparkline (cumulative P&L) ──────────────────────────────────────────
function PnlSparkline({ trades }: { trades: JournalTrade[] }) {
  const W = 900, H = 200, PAD = 20

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
      <div className="flex items-center justify-center h-[200px] text-slate-500 text-sm">
        Not enough trade data to chart yet.
      </div>
    )
  }

  const minY = Math.min(...daily.map(d => d.cum))
  const maxY = Math.max(...daily.map(d => d.cum))
  const rangeY = maxY - minY || 1

  const pts = daily.map((d, i) => {
    const x = PAD + (i / (daily.length - 1)) * (W - 2 * PAD)
    const y = PAD + (1 - (d.cum - minY) / rangeY) * (H - 2 * PAD)
    return `${x},${y}`
  })

  const fillPts = [
    `${PAD},${H - PAD}`,
    ...pts,
    `${W - PAD},${H - PAD}`,
  ]

  const isPositive = daily[daily.length - 1].cum >= 0

  const lineColor = isPositive ? '#10b981' : '#ef4444'
  const fillColor = isPositive ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)'

  const fmt = (n: number) => {
    const abs = Math.abs(n)
    const sign = n >= 0 ? '+' : '–'
    if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`
    return `${sign}$${abs.toFixed(0)}`
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[200px]" preserveAspectRatio="none">
      <polygon points={fillPts.join(' ')} fill={fillColor} />
      <polyline points={pts.join(' ')} fill="none" stroke={lineColor} strokeWidth="2" strokeLinejoin="round" />
      {/* Zero line */}
      {minY < 0 && maxY > 0 && (
        <line
          x1={PAD} y1={PAD + ((maxY) / rangeY) * (H - 2 * PAD)}
          x2={W - PAD} y2={PAD + ((maxY) / rangeY) * (H - 2 * PAD)}
          stroke="rgba(255,255,255,0.1)" strokeWidth="1" strokeDasharray="4 4"
        />
      )}
      {/* Y labels */}
      <text x={W - PAD + 4} y={PAD + 4} fill="#64748b" fontSize="10" textAnchor="start">{fmt(maxY)}</text>
      <text x={W - PAD + 4} y={H - PAD + 4} fill="#64748b" fontSize="10" textAnchor="start">{fmt(minY)}</text>
    </svg>
  )
}

// ─── Verdict Badge ─────────────────────────────────────────────────────────────
const VERDICT_STYLE: Record<string, string> = {
  HALAL:    'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
  HARAM:    'bg-red-500/15 text-red-400 border border-red-500/30',
  DOUBTFUL: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  UNKNOWN:  'bg-slate-700 text-slate-400 border border-slate-600',
}

function VerdictBadge({ v }: { v: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${VERDICT_STYLE[v] ?? VERDICT_STYLE.UNKNOWN}`}>
      {v}
    </span>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────
const PAGE_SIZE = 25

export default function JournalPage() {
  const [trades, setTrades] = useState<JournalTrade[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [broker, setBroker] = useState<string | null>(null)
  const [paper, setPaper] = useState<boolean | null>(null)

  // Filters
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | 'win' | 'loss'>('all')
  const [halalFilter, setHalalFilter] = useState<'all' | 'HALAL' | 'HARAM' | 'DOUBTFUL' | 'UNKNOWN'>('all')

  // Table state
  const [page, setPage] = useState(1)
  const [sortKey, setSortKey] = useState<keyof JournalTrade>('date')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)

  useEffect(() => {
    fetch('/api/journal')
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        setTrades(d.trades ?? [])
        setBroker(d.broker ?? null)
        setPaper(d.paper ?? null)
      })
      .catch(() => setError('Failed to load journal data.'))
      .finally(() => setLoading(false))
  }, [])

  // Set default date range to current year
  useEffect(() => {
    const yr = new Date().getFullYear()
    setFromDate(`${yr}-01-01`)
    setToDate(`${yr}-12-31`)
  }, [])

  // ── Filtered + sorted trades ───────────────────────────────────────────────
  const filtered = useMemo(() => {
    let out = trades.filter(t => {
      if (search && !t.symbol.includes(search.toUpperCase())) return false
      if (fromDate && t.date < fromDate) return false
      if (toDate && t.date > toDate) return false
      if (outcomeFilter === 'win' && (t.pnl ?? 0) <= 0) return false
      if (outcomeFilter === 'loss' && (t.pnl ?? 0) > 0) return false
      if (halalFilter !== 'all' && t.halal !== halalFilter) return false
      return true
    })

    out = [...out].sort((a, b) => {
      const va = a[sortKey] ?? ''
      const vb = b[sortKey] ?? ''
      if (typeof va === 'string') return va.localeCompare(vb as string) * sortDir
      return ((va as number) - (vb as number)) * sortDir
    })

    return out
  }, [trades, search, fromDate, toDate, outcomeFilter, halalFilter, sortKey, sortDir])

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const withPnl = filtered.filter(t => t.pnl !== null)
    const wins    = withPnl.filter(t => (t.pnl ?? 0) > 0)
    const losses  = withPnl.filter(t => (t.pnl ?? 0) <= 0)
    const totalPnl = withPnl.reduce((s, t) => s + (t.pnl ?? 0), 0)
    const winRate  = withPnl.length ? (wins.length / withPnl.length) * 100 : 0
    const best     = wins.length ? Math.max(...wins.map(t => t.pnl ?? 0)) : 0
    const worst    = losses.length ? Math.min(...losses.map(t => t.pnl ?? 0)) : 0
    const avgWin   = wins.length ? wins.reduce((s, t) => s + (t.pnl ?? 0), 0) / wins.length : 0
    const avgLoss  = losses.length ? losses.reduce((s, t) => s + (t.pnl ?? 0), 0) / losses.length : 0
    const days     = new Set(withPnl.map(t => t.date)).size
    return { totalPnl, winRate, best, worst, avgWin, avgLoss, days, wins: wins.length, losses: losses.length, total: withPnl.length }
  }, [filtered])

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageTrades = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function sort(key: keyof JournalTrade) {
    if (sortKey === key) setSortDir(d => d === 1 ? -1 : 1)
    else { setSortKey(key); setSortDir(-1) }
    setPage(1)
  }

  function setYear(yr: number) {
    setFromDate(`${yr}-01-01`)
    setToDate(`${yr}-12-31`)
    setPage(1)
  }

  // ── CSV export ───────────────────────────────────────────────────────────
  function exportCSV() {
    const header = 'Date,Symbol,Side,Qty,Entry,Exit,P&L,P&L%,Result,Halal'
    const rows = filtered.map(t =>
      [t.date, t.symbol, t.side, t.qty, t.entry ?? '', t.exit,
        t.pnl ?? '', t.pnlPct ?? '', (t.pnl ?? 0) > 0 ? 'WIN' : 'LOSS', t.halal].join(',')
    )
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'tickrtalk-journal.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Formatting helpers ───────────────────────────────────────────────────
  function fmtPnl(n: number, sign = true) {
    const abs = Math.abs(n)
    const s = abs >= 1000 ? abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : abs.toFixed(2)
    if (!sign) return `$${s}`
    return n >= 0 ? `+$${s}` : `–$${s}`
  }

  const yr = new Date().getFullYear()

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Trade Journal</h1>
          {broker && (
            <p className="text-slate-400 text-sm mt-0.5">
              {broker.charAt(0).toUpperCase() + broker.slice(1)}
              {paper !== null && (
                <span className={`ml-2 text-[11px] px-1.5 py-0.5 rounded ${paper ? 'bg-yellow-500/15 text-yellow-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                  {paper ? 'Paper' : 'Live'}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Year + date filters */}
        <div className="flex items-center gap-3">
          <div className="flex bg-slate-800 rounded-lg p-1 border border-slate-700">
            {[yr - 1, yr].map(y => (
              <button key={y} onClick={() => setYear(y)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors ${fromDate.startsWith(String(y)) ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                {y}
              </button>
            ))}
          </div>
          <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1) }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 outline-none" />
          <span className="text-slate-500 text-xs">to</span>
          <input type="date" value={toDate} onChange={e => { setToDate(e.target.value); setPage(1) }}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 outline-none" />
        </div>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="card rounded-xl p-10 text-center text-slate-400 text-sm">
          Loading trade history…
        </div>
      )}

      {error && (
        <div className="card rounded-xl p-6 text-center">
          <p className="text-red-400 text-sm mb-2">⚠️ {error}</p>
          {error.includes('No broker') && (
            <a href="/dashboard/settings" className="text-emerald-400 text-sm hover:underline">
              Connect a broker in Settings →
            </a>
          )}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 md:grid-cols-6">
            {[
              {
                label: 'Total P&L',
                value: fmtPnl(stats.totalPnl),
                sub: `${stats.wins}W / ${stats.losses}L`,
                color: stats.totalPnl >= 0 ? 'text-emerald-400' : 'text-red-400',
              },
              {
                label: 'Win Rate',
                value: `${stats.winRate.toFixed(1)}%`,
                sub: `${stats.total} closed`,
                color: stats.winRate >= 50 ? 'text-emerald-400' : 'text-red-400',
              },
              {
                label: 'Best Trade',
                value: stats.best ? fmtPnl(stats.best) : '—',
                sub: 'single trade',
                color: 'text-emerald-400',
              },
              {
                label: 'Worst Trade',
                value: stats.worst ? fmtPnl(stats.worst) : '—',
                sub: 'single trade',
                color: 'text-red-400',
              },
              {
                label: 'Avg Win',
                value: stats.avgWin ? fmtPnl(stats.avgWin) : '—',
                sub: 'per winning trade',
                color: 'text-emerald-400',
              },
              {
                label: 'Trading Days',
                value: String(stats.days),
                sub: 'with closed trades',
                color: 'text-white',
              },
            ].map(s => (
              <div key={s.label} className="card rounded-xl p-4">
                <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{s.label}</div>
                <div className={`text-xl font-mono font-bold ${s.color}`}>{s.value}</div>
                <div className="text-[11px] text-slate-500 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Cumulative P&L Chart */}
          {filtered.some(t => t.pnl !== null) && (
            <div className="card rounded-xl p-5">
              <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-3">Cumulative Realized P&L</div>
              <PnlSparkline trades={filtered} />
            </div>
          )}

          {/* Trade Log */}
          <div className="card rounded-xl overflow-hidden">
            {/* Toolbar */}
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between flex-wrap gap-3">
              <span className="text-sm font-semibold text-white">
                Trade Log
                <span className="ml-2 text-xs font-normal text-slate-400">{filtered.length} trades</span>
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1) }}
                  placeholder="Search symbol…"
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 outline-none w-32" />

                <select value={outcomeFilter} onChange={e => { setOutcomeFilter(e.target.value as 'all'|'win'|'loss'); setPage(1) }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 outline-none">
                  <option value="all">All Trades</option>
                  <option value="win">Wins only</option>
                  <option value="loss">Losses only</option>
                </select>

                <select value={halalFilter} onChange={e => { setHalalFilter(e.target.value as typeof halalFilter); setPage(1) }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-emerald-500 outline-none">
                  <option value="all">All Halal Status</option>
                  <option value="HALAL">Halal only</option>
                  <option value="HARAM">Haram only</option>
                  <option value="DOUBTFUL">Doubtful only</option>
                  <option value="UNKNOWN">Unknown only</option>
                </select>

                <button onClick={exportCSV}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-300 hover:text-white hover:border-slate-500 transition-colors flex items-center gap-1.5">
                  ↓ CSV
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-500">
                    {([
                      ['date', 'Date'],
                      ['symbol', 'Symbol'],
                      [null, 'Side'],
                      ['qty', 'Qty'],
                      ['entry', 'Entry'],
                      ['exit', 'Exit'],
                      ['pnl', 'P&L'],
                      ['pnlPct', 'P&L %'],
                      [null, 'Result'],
                      [null, 'Halal'],
                    ] as [keyof JournalTrade | null, string][]).map(([key, label]) => (
                      <th key={label}
                        onClick={() => key && sort(key)}
                        className={`px-4 py-3 text-left ${key ? 'cursor-pointer hover:text-slate-300' : ''} ${['Qty', 'Entry', 'Exit', 'P&L', 'P&L %'].includes(label) ? 'text-right' : ''}`}>
                        {label} {key && sortKey === key ? (sortDir === -1 ? '↓' : '↑') : key ? '↕' : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {pageTrades.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-5 py-12 text-center text-slate-500 text-sm">
                        {trades.length === 0
                          ? 'No closed trades found. Make some trades in your Alpaca account!'
                          : 'No trades match the current filters.'}
                      </td>
                    </tr>
                  ) : pageTrades.map(t => {
                    const pnl = t.pnl ?? 0
                    const isWin = pnl > 0
                    return (
                      <tr key={t.id} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">{t.date}</td>
                        <td className="px-4 py-3 font-semibold text-white">{t.symbol}</td>
                        <td className="px-4 py-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded ${t.side === 'LONG' ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                            {t.side}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-300">{t.qty.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-400">
                          {t.entry !== null ? `$${t.entry.toFixed(2)}` : '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-[11px] text-slate-300">${t.exit.toFixed(2)}</td>
                        <td className={`px-4 py-3 text-right font-mono font-semibold ${t.pnl !== null ? (isWin ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500'}`}>
                          {t.pnl !== null ? fmtPnl(t.pnl) : '—'}
                        </td>
                        <td className={`px-4 py-3 text-right font-mono text-[11px] ${t.pnlPct !== null ? (isWin ? 'text-emerald-400' : 'text-red-400') : 'text-slate-500'}`}>
                          {t.pnlPct !== null ? `${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct.toFixed(2)}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {t.pnl !== null ? (
                            <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${isWin ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/15 text-red-400 border border-red-500/30'}`}>
                              {isWin ? 'WIN' : 'LOSS'}
                            </span>
                          ) : <span className="text-slate-500">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <VerdictBadge v={t.halal} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-5 py-3 border-t border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1 rounded bg-slate-800 text-xs hover:bg-slate-700 disabled:opacity-40 transition-colors">
                  ‹ Prev
                </button>
                <span className="px-3 py-1 text-xs text-slate-400">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="px-3 py-1 rounded bg-slate-800 text-xs hover:bg-slate-700 disabled:opacity-40 transition-colors">
                  Next ›
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
