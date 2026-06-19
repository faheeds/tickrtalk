/**
 * GET /api/snaptrade/debug
 *
 * Diagnostic endpoint — returns raw SnapTrade data so we can see exactly
 * what activities, holdings, and account types are coming back.
 * REMOVE THIS ROUTE before going to production.
 */
import { requireUser } from '@/lib/auth'
import { decrypt } from '@/lib/crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { getActivities, getHoldings, listAccounts, listAuthorizations } from '@/lib/snaptrade'
import { NextResponse } from 'next/server'

function fiveYearsAgo(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 5)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  const userId = await requireUser().catch(() => null)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1 — Check DB record
  const { data: user } = await supabaseAdmin
    .from('users')
    .select('snaptrade_user_secret')
    .eq('id', userId)
    .single()

  const hasSecret = !!user?.snaptrade_user_secret

  if (!hasSecret) {
    return NextResponse.json({
      stage: 'no_secret',
      message: 'No snaptrade_user_secret in DB — user has never registered with SnapTrade',
    })
  }

  // 2 — Try decrypting
  let userSecret: string
  try {
    userSecret = decrypt(user.snaptrade_user_secret)
  } catch (e) {
    return NextResponse.json({
      stage: 'decrypt_failed',
      message: 'Failed to decrypt snaptrade_user_secret — was it encrypted with a different key?',
      error: (e as Error).message,
    })
  }

  const startDate = fiveYearsAgo()
  const endDate   = new Date().toISOString().slice(0, 10)

  // 3 — Fetch everything in parallel
  const [accounts, authorizations, activities, holdings] = await Promise.allSettled([
    listAccounts(userId, userSecret),
    listAuthorizations(userId, userSecret),
    getActivities(userId, userSecret, { startDate, endDate }),
    getHoldings(userId, userSecret),
  ])

  const accountsData      = accounts.status === 'fulfilled'       ? accounts.value       : { error: (accounts as PromiseRejectedResult).reason?.message }
  const authsData         = authorizations.status === 'fulfilled' ? authorizations.value : { error: (authorizations as PromiseRejectedResult).reason?.message }
  const activitiesData    = activities.status === 'fulfilled'     ? activities.value     : { error: (activities as PromiseRejectedResult).reason?.message }
  const holdingsData      = holdings.status === 'fulfilled'       ? holdings.value       : { error: (holdings as PromiseRejectedResult).reason?.message }

  // Summarise activity types
  const activityArray = Array.isArray(activitiesData) ? activitiesData : []
  const allTypes = [...new Set(activityArray.map((a: { type?: string }) => a.type).filter(Boolean))]
  const first10  = activityArray.slice(0, 10).map((a: {
    id: string; trade_date: string; type: string; units: number; price: number
    symbol?: { symbol: string }; account?: { institution_name: string }
  }) => ({
    id:           a.id,
    date:         a.trade_date,
    type:         a.type,
    symbol:       a.symbol?.symbol,
    qty:          a.units,
    price:        a.price,
    broker:       a.account?.institution_name,
  }))

  return NextResponse.json({
    stage:          'ok',
    userId,
    startDate,
    endDate,
    accounts:       accountsData,
    authorizations: authsData,
    activityCount:  activityArray.length,
    allActivityTypes: allTypes,
    first10Activities: first10,
    holdings:       holdingsData,
  }, { status: 200 })
}
