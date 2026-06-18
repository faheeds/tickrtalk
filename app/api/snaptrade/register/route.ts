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
import { registerUser, deleteUser, listUsers, snapTradeConfigured } from '@/lib/snaptrade'
import { currentUser } from '@clerk/nextjs/server'
import { stripe } from '@/lib/stripe'
import { NextResponse } from 'next/server'

/** Ensures a users row exists for this Clerk user, creating one if missing.
 *  This handles local dev where the Clerk webhook can't reach localhost. */
async function ensureUserRow(userId: string): Promise<void> {
  const { data } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('id', userId)
    .single()

  if (data) return // row already exists

  // Fetch user details from Clerk to create a complete row
  const clerkUser = await currentUser()
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? ''

  // Create Stripe customer if we have an email
  let stripeCustomerId = ''
  try {
    const customer = await stripe.customers.create({ email, metadata: { clerkId: userId } })
    stripeCustomerId = customer.id
  } catch {
    // Non-fatal — we'll proceed without Stripe for now
  }

  await supabaseAdmin.from('users').insert({
    id: userId,
    email,
    stripe_customer_id: stripeCustomerId || null,
    subscription_status: 'trial',
    subscription_tier: 'basic',
    trial_ends_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  })

  // Seed empty portfolio + watchlist + algo_params
  await supabaseAdmin.from('portfolios').insert({ user_id: userId }).maybeSingle()
  await supabaseAdmin.from('watchlists').insert({ user_id: userId }).maybeSingle()
  await supabaseAdmin.from('algo_params').insert({ user_id: userId }).maybeSingle()
}

async function saveSecret(userId: string, encrypted: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from('users')
    .update({ snaptrade_user_secret: encrypted })
    .eq('id', userId)

  if (error) throw new Error(`Supabase update failed: ${error.message}`)
}

export async function POST() {
  if (!snapTradeConfigured()) {
    return NextResponse.json(
      { error: 'SnapTrade is not configured. Add SNAPTRADE_CLIENT_ID and SNAPTRADE_CONSUMER_KEY to your environment variables.' },
      { status: 503 },
    )
  }

  const userId = await requireUser().catch(() => null)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Ensure the users row exists (handles local dev where webhook can't fire)
  try {
    await ensureUserRow(userId)
  } catch (err) {
    console.error('ensureUserRow failed:', err)
  }

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
    await saveSecret(userId, encrypted)
    return NextResponse.json({ ok: true, registered: true })
  } catch (err) {
    const msg = (err as Error).message ?? ''
    console.error('SnapTrade register error:', msg)

    // Code 1010: userId already exists in SnapTrade but we have no secret stored.
    // Fix: delete the orphaned user and re-register to get a fresh secret.
    if (msg.includes('1010') || msg.includes('already exist')) {
      try {
        await deleteUser(userId, '')
      } catch {
        return NextResponse.json(
          {
            error: 'SNAPTRADE_1010',
            detail: 'Your SnapTrade user exists but the secret was lost. Delete your user at app.snaptrade.com → Users, then try again.',
          },
          { status: 400 },
        )
      }

      try {
        const result = await registerUser(userId)
        const encrypted = encrypt(result.userSecret)
        await saveSecret(userId, encrypted)
        return NextResponse.json({ ok: true, registered: true })
      } catch (retryErr) {
        const retryMsg = (retryErr as Error).message ?? ''
        return NextResponse.json(
          { error: retryMsg || 'Failed to re-register after reset' },
          { status: 500 },
        )
      }
    }

    // Code 1012: Personal plan — only one user allowed and slot is taken by another userId.
    if (msg.includes('1012') || msg.includes('Personal keys')) {
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
