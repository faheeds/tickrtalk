// Vercel Cron — every 15 minutes during market hours Mon–Fri
// Schedule in vercel.json: every-15-min 13-21 UTC Mon-Fri  (= 9am-5pm ET year-round)
//
// Strategy dispatch by time-of-day (ET):
//   09:30–10:00  Swing scan  — SuperTrend+ATR (once per day at open)
//   10:00–15:30  Day scan    — ORB+VWAP (every 15 min during the session)
//   1st Monday   Long-term   — Quality Momentum (monthly rebalance, runs at open)
//
// Per-user budget caps are loaded from the algo_allocations table.
// Protected by CRON_SECRET bearer token (set in Vercel env vars).
import { supabaseAdmin }      from '@/lib/supabase'
import { createAlpacaClient } from '@/lib/alpaca'
import { decrypt }            from '@/lib/crypto'
import { runAllStrategies }   from '@/lib/strategies/engine'
import { NextResponse }       from 'next/server'

export const maxDuration = 60

/** Returns current ET time in total minutes since midnight (approximate). */
function etMinutes(): number {
  const now = new Date()
  // Market hours are always EDT (UTC-4) in summer; getClock() handles the
  // authoritative "is market open" gate, so a ±1hr approximation is fine here.
  return (now.getUTCHours() - 4) * 60 + now.getUTCMinutes()
}

function isFirstMondayOfMonth(): boolean {
  const d = new Date()
  return d.getDay() === 1 && d.getDate() <= 7
}

export async function GET(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const etMin = etMinutes()
  const OPEN       = 9 * 60 + 30    // 9:30 AM ET
  const ORB_DONE   = 10 * 60         // 10:00 AM ET (after opening range forms)
  const DAY_CUTOFF = 15 * 60 + 30   // 3:30 PM ET (no new day trades after this)

  const runSwing    = etMin >= OPEN     && etMin < OPEN + 30    // first 30-min window
  const runDay      = etMin >= ORB_DONE && etMin <= DAY_CUTOFF
  const runLongterm = isFirstMondayOfMonth() && etMin >= OPEN && etMin < OPEN + 30

  // If nothing is scheduled for this cycle, exit early
  if (!runSwing && !runDay && !runLongterm) {
    return NextResponse.json({ ok: true, ran: 0, reason: 'Outside all strategy windows' })
  }

  // Fetch all Pro/trial users
  const { data: proUsers } = await supabaseAdmin
    .from('users')
    .select('id, subscription_tier, subscription_status, trial_ends_at')
    .or('subscription_tier.eq.pro,subscription_status.eq.trial')

  if (!proUsers?.length) return NextResponse.json({ ok: true, ran: 0 })

  let ran = 0, totalOrders = 0

  for (const user of proUsers) {
    const isActive =
      (user.subscription_tier === 'pro' && user.subscription_status === 'active') ||
      (user.subscription_status === 'trial' && new Date(user.trial_ends_at) > new Date())
    if (!isActive) continue

    // Get the user's Alpaca connection
    const { data: conn } = await supabaseAdmin
      .from('brokerage_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('broker', 'alpaca')
      .eq('is_active', true)
      .single()
    if (!conn) continue

    // Load per-strategy budget allocations
    const { data: allocs } = await supabaseAdmin
      .from('algo_allocations')
      .select('day_budget, swing_budget, longterm_budget')
      .eq('user_id', user.id)
      .single()

    const allocations = {
      dayBudget:      Number(allocs?.day_budget)      || 0,
      swingBudget:    Number(allocs?.swing_budget)    || 0,
      longtermBudget: Number(allocs?.longterm_budget) || 0,
    }
    // Skip users who haven't set any budgets
    if (allocations.dayBudget + allocations.swingBudget + allocations.longtermBudget === 0) continue

    const alpaca = createAlpacaClient({
      apiKey:    decrypt(conn.api_key_encrypted as string),
      apiSecret: decrypt(conn.api_secret_encrypted as string),
      paper:     conn.paper_mode as boolean,
    })

    // Authoritative market-open check via Alpaca
    const clock = await alpaca.getClock().catch(() => null)
    if (!clock?.isOpen) continue

    try {
      const { ordersPlaced, errors } = await runAllStrategies(
        alpaca,
        allocations,
        { runDay, runSwing, runLongterm },
      )
      if (errors.length) console.error(`[CRON scan] user=${user.id}`, errors)
      totalOrders += ordersPlaced
      ran++
    } catch (e) {
      console.error(`[CRON scan] user=${user.id} fatal:`, (e as Error).message)
    }
  }

  return NextResponse.json({ ok: true, ran, totalOrders, timestamp: new Date().toISOString() })
}
