/**
 * POST /api/snaptrade/connect
 *
 * Generates a SnapTrade OAuth portal URL for the current user.
 * Body: { broker?: string, reconnect?: string }
 * Returns { redirectURI }
 */
import { requireUser } from '@/lib/auth'
import { decrypt } from '@/lib/crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { generateLoginLink } from '@/lib/snaptrade'
import { NextRequest, NextResponse } from 'next/server'

async function getUserSecret(userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('snaptrade_user_secret')
    .eq('id', userId)
    .single()

  if (!data?.snaptrade_user_secret) return null
  try {
    return decrypt(data.snaptrade_user_secret)
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  const userId = await requireUser().catch(() => null)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const userSecret = await getUserSecret(userId)
  if (!userSecret) {
    return NextResponse.json(
      { error: 'Not registered with SnapTrade. Call /api/snaptrade/register first.' },
      { status: 428 },
    )
  }

  const body = await req.json().catch(() => ({}))
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://tickrtalk.io'

  try {
    const result = await generateLoginLink(userId, userSecret, {
      broker:            body.broker,
      reconnect:         body.reconnect,
      immediateRedirect: true,
      customRedirect:    `${appUrl}/dashboard/settings?tab=brokers&connected=snaptrade`,
    })
    return NextResponse.json({ redirectURI: result.redirectURI })
  } catch (err) {
    console.error('SnapTrade connect error:', err)
    return NextResponse.json(
      { error: (err as Error).message ?? 'Failed to generate connection link' },
      { status: 500 },
    )
  }
}
