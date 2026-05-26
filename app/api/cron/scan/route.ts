/**
 * Vercel Cron — runs every 5 minutes during market hours (Mon–Fri 9:30–5pm ET)
 * Scans the universe for signals for all active Pro subscribers.
 * Protected by CRON_SECRET header (set in Vercel env vars).
 */
import { supabaseAdmin } from '@/lib/supabase'
import { createAlpacaClient } from '@/lib/alpaca'
import { decrypt }       from '@/lib/crypto'
import { getVerdict }    from '@/lib/halal'
import { NextResponse }  from 'next/server'

export const maxDuration = 60

export async function GET(req: Request) {
  // Verify cron secret
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get all active Pro users with Alpaca connections
  const { data: proUsers } = await supabaseAdmin
    .from('users')
    .select('id, subscription_tier, subscription_status, trial_ends_at')
    .or('subscription_tier.eq.pro,subscription_status.eq.trial')

  if (!proUsers?.length) return NextResponse.json({ ok: true, ran: 0 })

  let ran = 0
  for (const user of proUsers) {
    // Check still eligible
    const isTrial = user.subscription_status === 'trial' && new Date(user.trial_ends_at) > new Date()
    const isPro   = user.subscription_tier === 'pro' && user.subscription_status === 'active'
    if (!isTrial && !isPro) continue

    const { data: conn } = await supabaseAdmin
      .from('brokerage_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('broker', 'alpaca')
      .eq('is_active', true)
      .single()

    if (!conn) continue

    const alpaca = createAlpacaClient({
      apiKey:    decrypt(conn.api_key_encrypted),
      apiSecret: decrypt(conn.api_secret_encrypted),
      paper:     conn.paper_mode,
    })

    // Check market is open
    const clock = await alpaca.getClock().catch(() => null)
    if (!clock?.isOpen) continue

    // Log scan ran — actual algo execution would go here
    // (porting the full autoTradeScan from algo-engine.js)
    console.log(`[CRON] Scan ran for user ${user.id}`)
    ran++
  }

  return NextResponse.json({ ok: true, ran, timestamp: new Date().toISOString() })
}
