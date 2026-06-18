/**
 * POST /api/snaptrade/register
 *
 * Registers the current Clerk user with SnapTrade (idempotent).
 * Saves the encrypted userSecret in users.snaptrade_user_secret.
 * Returns { ok, registered, alreadyRegistered }.
 */
import { requireUser } from '@/lib/auth'
import { encrypt } from '@/lib/crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { registerUser, listUsers, snapTradeConfigured } from '@/lib/snaptrade'
import { NextResponse } from 'next/server'

export async function POST() {
  if (!snapTradeConfigured()) {
    return NextResponse.json(
      { error: 'SnapTrade is not configured. Add SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY to your environment variables.' },
      { status: 503 },
    )
  }

  const userId = await requireUser().catch(() => null)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if already registered
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('snaptrade_user_secret')
    .eq('id', userId)
    .single()

  if (user?.snaptrade_user_secret) {
    return NextResponse.json({ ok: true, alreadyRegistered: true })
  }

  // Register with SnapTrade
  try {
    const result = await registerUser(userId)
    const encrypted = encrypt(result.userSecret)

    await supabaseAdmin
      .from('users')
      .update({ snaptrade_user_secret: encrypted })
      .eq('id', userId)

    return NextResponse.json({ ok: true, registered: true })
  } catch (err) {
    const msg = (err as Error).message ?? ''
    console.error('SnapTrade register error:', msg)

    // Personal plan: "Personal keys can only register one user" (code 1012)
    // This means there is an orphaned SnapTrade user from a previous session.
    // The user must delete it via the SnapTrade dashboard before registering again.
    if (msg.includes('1012') || msg.includes('Personal keys')) {
      // Log the existing user(s) to help diagnose
      try {
        const users = await listUsers()
        console.log('SnapTrade registered users (Personal plan):', users)
      } catch (e) {
        console.log('SnapTrade listUsers also failed:', e)
      }

      return NextResponse.json(
        {
          error: 'SNAPTRADE_1012',
          detail: 'A SnapTrade user is already registered under your API keys. Delete it at app.snaptrade.com → Users, then try again.',
        },
        { status: 400 },
      )
    }

    return NextResponse.json(
      { error: msg || 'Failed to register with SnapTrade' },
      { status: 500 },
    )
  }
}

/** GET — check registration status */
export async function GET() {
  const userId = await requireUser().catch(() => null)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: user } = await supabaseAdmin
    .from('users')
    .select('snaptrade_user_secret')
    .eq('id', userId)
    .single()

  return NextResponse.json({ registered: !!user?.snaptrade_user_secret })
}
