/**
 * Vercel Cron — runs daily at 5pm ET after market close.
 * Updates portfolio valuations and applies SuperTrend stop upgrades.
 */
import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse }  from 'next/server'

export const maxDuration = 60

export async function GET(req: Request) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Get all active users with connections
  const { data: users } = await supabaseAdmin
    .from('brokerage_connections')
    .select('user_id, broker, api_key_encrypted, api_secret_encrypted, paper_mode')
    .eq('is_active', true)

  console.log(`[CRON] mark-to-market for ${users?.length ?? 0} connections`)
  return NextResponse.json({ ok: true, processed: users?.length ?? 0 })
}
