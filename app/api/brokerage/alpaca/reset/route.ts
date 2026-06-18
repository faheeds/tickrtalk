/**
 * POST /api/brokerage/alpaca/reset
 *
 * Cancels all open orders and closes all open positions on the user's
 * connected Alpaca paper account.
 *
 * NOTE: This does NOT reset the account cash balance back to $100 k.
 * To reset the balance, the user must visit:
 *   https://app.alpaca.markets → Paper Trading → Settings → Reset Account
 */
import { requireUser }        from '@/lib/auth'
import { supabaseAdmin }      from '@/lib/supabase'
import { decrypt }            from '@/lib/crypto'
import { createAlpacaClient } from '@/lib/alpaca'
import { NextResponse }       from 'next/server'

export async function POST() {
  const userId = await requireUser().catch(() => null)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch the user's active Alpaca connection
  const { data: conn } = await supabaseAdmin
    .from('brokerage_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('broker', 'alpaca')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!conn) {
    return NextResponse.json(
      { error: 'No active Alpaca connection found.' },
      { status: 428 },
    )
  }

  if (!conn.paper_mode) {
    return NextResponse.json(
      { error: 'Reset is only allowed for paper trading accounts.' },
      { status: 403 },
    )
  }

  const alpaca = createAlpacaClient({
    apiKey:    decrypt(conn.api_key_encrypted),
    apiSecret: decrypt(conn.api_secret_encrypted),
    paper:     true,
  })

  const errors: string[] = []

  // 1 — Cancel all open orders
  const cancelResult = await alpaca.cancelAllOrders()
  if (!cancelResult.ok) {
    errors.push(`Cancel orders: ${cancelResult.message}`)
  }

  // 2 — Close all open positions (includes cancelling attached bracket orders)
  const closeResult = await alpaca.closeAllPositions()
  if (!closeResult.ok) {
    // If there are simply no positions this can 404/422 — not a real error
    const msg = closeResult.message ?? ''
    if (!msg.includes('404') && !msg.toLowerCase().includes('no position')) {
      errors.push(`Close positions: ${msg}`)
    }
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { ok: false, errors },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    message: 'All orders cancelled and all positions closed.',
    nextStep: 'To reset your cash balance back to $100,000, visit https://app.alpaca.markets → Paper Trading → Settings → Reset Account.',
  })
}
