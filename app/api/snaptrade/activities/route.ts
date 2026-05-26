/**
 * GET /api/snaptrade/activities
 *
 * Fetches BUY/SELL trade activities from all connected SnapTrade brokerages.
 * Query params: startDate (YYYY-MM-DD), endDate
 * Returns { trades: JournalTrade[], brokers: string[] }
 */
import { requireUser } from '@/lib/auth'
import { decrypt } from '@/lib/crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { getActivities, listAccounts, type SnapTradeActivity } from '@/lib/snaptrade'
import { getVerdict } from '@/lib/halal'
import { NextRequest, NextResponse } from 'next/server'
import type { JournalTrade } from '@/app/api/journal/route'

function twoYearsAgo(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 2)
  return d.toISOString().slice(0, 10)
}

export async function GET(req: NextRequest) {
  const userId = await requireUser().catch(() => null)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('snaptrade_user_secret')
    .eq('id', userId)
    .single()

  if (!user?.snaptrade_user_secret) {
    return NextResponse.json({ trades: [], registered: false })
  }

  let userSecret: string
  try {
    userSecret = decrypt(user.snaptrade_user_secret)
  } catch {
    return NextResponse.json({ error: 'Failed to decrypt credentials' }, { status: 500 })
  }

  const sp = req.nextUrl.searchParams
  const startDate = sp.get('startDate') ?? twoYearsAgo()
  const endDate   = sp.get('endDate')   ?? new Date().toISOString().slice(0, 10)

  try {
    // Fetch BUY + SELL activities (types filter)
    const activities = await getActivities(userId, userSecret, {
      startDate,
      endDate,
      types: 'BUY,SELL',
    })

    // Sort ascending for FIFO
    const sorted = [...activities].sort(
      (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime(),
    )

    // Build FIFO lots per symbol
    const lots: Record<string, { qty: number; price: number }[]> = {}
    const trades: JournalTrade[] = []
    const brokerSet = new Set<string>()

    for (const act of sorted) {
      const symbol = act.symbol?.symbol
      const qty    = act.units  ?? 0
      const price  = act.price  ?? 0
      const type   = act.type?.toUpperCase()  // BUY | SELL
      const broker = act.account?.institution_name ?? 'SnapTrade'

      if (!symbol || qty <= 0 || price <= 0) continue
      brokerSet.add(broker)

      if (type === 'BUY') {
        if (!lots[symbol]) lots[symbol] = []
        lots[symbol].push({ qty, price })
      } else if (type === 'SELL') {
        let remaining = qty
        let totalCost = 0
        let totalMatched = 0

        while (remaining > 0 && lots[symbol]?.length > 0) {
          const lot  = lots[symbol][0]
          const take = Math.min(lot.qty, remaining)
          totalCost    += take * lot.price
          totalMatched += take
          lot.qty      -= take
          remaining    -= take
          if (lot.qty === 0) lots[symbol].shift()
        }

        const avgEntry  = totalMatched > 0 ? +(totalCost / totalMatched).toFixed(4) : null
        const closedQty = qty - remaining
        const pnl       = avgEntry !== null ? +((price - avgEntry) * closedQty).toFixed(2) : null
        const pnlPct    =
          avgEntry !== null && avgEntry > 0
            ? +((price - avgEntry) / avgEntry * 100).toFixed(2)
            : null

        trades.push({
          id:     act.id,
          date:   act.trade_date.slice(0, 10),
          symbol,
          side:   'LONG',
          qty:    +closedQty.toFixed(4),
          entry:  avgEntry,
          exit:   +price.toFixed(4),
          pnl,
          pnlPct,
          halal:  getVerdict(symbol),
          broker,
        } as JournalTrade & { broker: string })
      }
    }

    // Newest first
    trades.reverse()

    return NextResponse.json({
      trades,
      registered: true,
      brokers: Array.from(brokerSet),
      total: trades.length,
    })
  } catch (err) {
    console.error('SnapTrade activities error:', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'Failed to fetch activities' },
      { status: 500 },
    )
  }
}
