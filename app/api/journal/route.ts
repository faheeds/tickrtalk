import { requireUser, getActiveBrokerConnection } from '@/lib/auth'
import { decrypt } from '@/lib/crypto'
import { createAlpacaClient } from '@/lib/alpaca'
import { getVerdict } from '@/lib/halal'
import { NextResponse } from 'next/server'

export interface JournalTrade {
  id: string
  date: string          // YYYY-MM-DD
  symbol: string
  side: 'LONG' | 'SHORT'
  qty: number
  entry: number | null  // avg entry price from FIFO lots
  exit: number          // fill price
  pnl: number | null
  pnlPct: number | null
  halal: 'HALAL' | 'HARAM' | 'DOUBTFUL' | 'UNKNOWN'
  broker?: string       // 'alpaca' | broker display name from SnapTrade
}

export async function GET() {
  const userId = await requireUser().catch(() => null)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const conn = await getActiveBrokerConnection(userId, 'alpaca')
  if (!conn) {
    return NextResponse.json({
      trades: [],
      broker: null,
      error: 'No broker connected. Connect Alpaca in Settings → Brokers.',
    })
  }

  let apiKey: string, apiSecret: string
  try {
    apiKey = decrypt(conn.api_key_encrypted as string)
    apiSecret = decrypt(conn.api_secret_encrypted as string)
  } catch (e) {
    console.error('[journal] Failed to decrypt Alpaca credentials:', e)
    // connected: true tells the journal page a broker IS linked so it doesn't show
    // "Connect a Broker". The user needs to re-enter their API keys in Settings.
    return NextResponse.json({
      trades: [],
      connected: true,
      error: 'Failed to decrypt broker credentials. Please re-enter your API keys in Settings → Brokers.',
    })
  }

  const client = createAlpacaClient({
    apiKey,
    apiSecret,
    paper: conn.paper_mode as boolean,
  })

  // Fetch fills from the past 2 years
  const after = new Date()
  after.setFullYear(after.getFullYear() - 2)
  const fills = await client.getActivities('FILL', after.toISOString())

  // Sort ascending (oldest first) for FIFO lot tracking
  const sorted = [...fills].sort(
    (a, b) => new Date(a.transaction_time).getTime() - new Date(b.transaction_time).getTime()
  )

  // FIFO lot tracker per symbol
  const lots: Record<string, { qty: number; price: number }[]> = {}
  const trades: JournalTrade[] = []

  for (const fill of sorted) {
    const symbol = fill.symbol
    const qty = parseFloat(fill.qty)
    const price = parseFloat(fill.price)
    const side = fill.side

    if (!symbol || isNaN(qty) || isNaN(price)) continue

    if (side === 'buy') {
      if (!lots[symbol]) lots[symbol] = []
      lots[symbol].push({ qty, price })
    } else if (side === 'sell') {
      // FIFO: consume lots and compute realized P&L
      let remaining = qty
      let totalCost = 0
      let totalMatched = 0

      while (remaining > 0 && lots[symbol] && lots[symbol].length > 0) {
        const lot = lots[symbol][0]
        const take = Math.min(lot.qty, remaining)
        totalCost += take * lot.price
        totalMatched += take
        lot.qty -= take
        remaining -= take
        if (lot.qty === 0) lots[symbol].shift()
      }

      const avgEntry = totalMatched > 0 ? +(totalCost / totalMatched).toFixed(4) : null
      const closedQty = qty - remaining
      const pnl = avgEntry !== null ? +((price - avgEntry) * closedQty).toFixed(2) : null
      const pnlPct =
        avgEntry !== null && avgEntry > 0
          ? +((price - avgEntry) / avgEntry * 100).toFixed(2)
          : null

      trades.push({
        id: fill.id,
        date: fill.transaction_time.slice(0, 10),
        symbol,
        side: 'LONG',
        qty: +c