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
import { getActivities, type SnapTradeActivity } from '@/lib/snaptrade'
import { getVerdict } from '@/lib/halal'
import { NextRequest, NextResponse } from 'next/server'
import type { JournalTrade } from '@/app/api/journal/route'

function fiveYearsAgo(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 5)
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
  } catch (e) {
    console.error('[snaptrade/activities] Failed to decrypt user secret — secret likely encrypted with old key. User must re-register SnapTrade:', e)
    // Return registered:false (not 500) so the journal page degrades gracefully.
    // The user needs to go to Settings → Brokers and click "Connect via SnapTrade"
    // to re-register and get a freshly-encrypted secret.
    return NextResponse.json({
      trades: [],
      registered: false,
      staleSecret: true,
      error: 'SnapTrade credentials need to be refreshed. Please reconnect in Settings → Brokers.',
    })
  }

  const sp = req.nextUrl.searchParams
  const startDate = sp.get('startDate') ?? fiveYearsAgo()
  const endDate   = sp.get('endDate')   ?? new Date().toISOString().slice(0, 10)

  try {
    // Fetch ALL activities — no server-side type filter so we catch every broker's
    // trade types (Fidelity may use slightly different labels than 'BUY'/'SELL').
    // We normalise below with .toUpperCase() and also check common aliases.
    const activities = await getActivities(userId, userSecret, { startDate, endDate })

    // Log what actually came back so we can diagnose broker-specific type strings
    const typeSample = [...new Set(activities.map(a => a.type).filter(Boolean))].slice(0, 20)
    console.log(`[snaptrade/activities] total=${activities.length} types=${JSON.stringify(typeSample)}`)

    // Sort ascending for FIFO
    const sorted = [...activities].sort(
      (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime(),
    )

    // Build FIFO lots per symbol
    const lots: Record<string, { qty: number; price: number }[]> = {}
    const trades: JournalTrade[] = []
    const brokerSet = new Set<string>()

    // Normalise broker-specific activity type strings to BUY / SELL
    function normaliseType(raw: string | undefined): 'BUY' | 'SELL' | null {
      const t = (raw ?? '').toUpperCase().trim()
      if (['BUY', 'B', 'BOT', 'BUY TO OPEN', 'BTO'].includes(t)) return 'BUY'
      if (['SELL', 'S', 'SLD', 'SELL TO CLOSE', 'STC', 'SOLD'].includes(t)) return 'SELL'
      return null
    }

    for (const act of sorted) {
      const symbol = act.symbol?.symbol
      const qty    = act.units  ?? 0
      const price  = act.price  ?? 0
      const type   = normaliseType(act.type)
      const broker = act.account?.institution_name ?? 'SnapTrade'

      if (!symbol || qty <= 0 || price <= 0) continue
      if (!type) continue   // skip dividends, fees, etc.
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
    // Return 200 with registered:true so the journal page shows the "no trades" empty
    // state instead of crashing. The error message surfaces for debugging.
    return NextResponse.json({
      trades: [],
      registered: true,
      brokers: [],
      error: (err as Error).message ?? 'Failed to fetch activities',
    })
  }
}
