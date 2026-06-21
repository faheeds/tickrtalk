/**
 * Vercel Cron — daily at 4:00 PM ET (20:00 UTC) Mon–Fri
 * Schedule in vercel.json: "0 20 * * 1-5"
 *
 * Post-market tasks:
 *  1. Cancel any remaining open day-trade orders (client_order_id contains "_DAY_")
 *  2. Log updated SuperTrend trailing stops for swing positions
 *  3. Report portfolio summary per user
 */
import { supabaseAdmin }      from '@/lib/supabase'
import { createAlpacaClient } from '@/lib/alpaca'
import { decrypt }            from '@/lib/crypto'
import { calcSuperTrend }     from '@/lib/strategies/indicators'
import { NextResponse }       from 'next/server'

export const maxDuration = 60

export async function GET(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data: conns } = await supabaseAdmin
    .from('brokerage_connections')
    .select('user_id, api_key_encrypted, api_secret_encrypted, paper_mode')
    .eq('is_active', true)
    .eq('broker', 'alpaca')

  if (!conns?.length) return NextResponse.json({ ok: true, processed: 0 })
  let processed = 0

  for (const conn of conns) {
    try {
      const alpaca = createAlpacaClient({
        apiKey:    decrypt(conn.api_key_encrypted as string),
        apiSecret: decrypt(conn.api_secret_encrypted as string),
        paper:     conn.paper_mode as boolean,
      })

      // 1. Cancel any open day-trade orders
      const rawOrders = await alpaca.getOrders('open').catch(() => []) as Array<{
        id: string; client_order_id?: string; symbol: string
      }>
      for (const o of rawOrders) {
        if ((o.client_order_id ?? '').includes('_DAY_')) {
          await alpaca.cancelOrder(o.id)
          console.log(`[MTM] Cancelled day-trade order ${o.id} (${o.symbol})`)
        }
      }

      // 2. Log SuperTrend trailing stops for swing positions
      const positions = await alpaca.getPositions().catch(() => [])
      console.log(`[MTM] user=${conn.user_id} positions=${positions.length}`)

      for (const pos of positions) {
        try {
          const bars = await alpaca.getBars(pos.symbol, 3)
          if (bars.length < 15) continue
          const { supertrend, direction } = calcSuperTrend(bars)
          const n     = bars.length
          const stVal = supertrend[n - 1]
          if (direction[n - 1] === 1 && stVal !== null) {
            console.log(`[MTM] ${pos.symbol}: SuperTrend trailing stop = $${stVal.toFixed(2)}`)
          }
        } catch {}
      }

      processed++
    } catch (e) {
      console.error(`[MTM] user=${conn.user_id}:`, (e as Error).message)
    }
  }

  return NextResponse.json({ ok: true, processed, timestamp: new Date().toISOString() })
}
