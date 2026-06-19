/**
 * GET /api/snaptrade/debug
 * Diagnostic endpoint — REMOVE before production.
 */
import { requireUser } from '@/lib/auth'
import { decrypt } from '@/lib/crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { getActivities, getAccountPositions, listAccounts, listAuthorizations } from '@/lib/snaptrade'
import { NextResponse } from 'next/server'

function fiveYearsAgo(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 5)
  return d.toISOString().slice(0, 10)
}

export async function GET() {
  const userId = await requireUser().catch(() => null)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: user } = await supabaseAdmin
    .from('users').select('snaptrade_user_secret').eq('id', userId).single()

  if (!user?.snaptrade_user_secret) {
    return NextResponse.json({ stage: 'no_secret' })
  }

  let userSecret: string
  try {
    userSecret = decrypt(user.snaptrade_user_secret)
  } catch (e) {
    return NextResponse.json({ stage: 'decrypt_failed', error: (e as Error).message })
  }

  const startDate = fiveYearsAgo()
  const endDate   = new Date().toISOString().slice(0, 10)

  // 1. Accounts + authorizations
  const [accountsResult, authsResult] = await Promise.allSettled([
    listAccounts(userId, userSecret),
    listAuthorizations(userId, userSecret),
  ])
  const accounts = accountsResult.status === 'fulfilled' ? accountsResult.value : []
  const accountIds = accounts.map((a: { id: string }) => a.id)

  // 2. Activities — global (no account filter)
  const activitiesGlobalResult = await Promise.allSettled([
    getActivities(userId, userSecret, { startDate, endDate }),
  ])
  const activitiesGlobal = activitiesGlobalResult[0].status === 'fulfilled'
    ? activitiesGlobalResult[0].value : []

  // 3. Activities — with explicit account IDs
  const activitiesWithAcctsResult = await Promise.allSettled([
    accountIds.length > 0
      ? getActivities(userId, userSecret, { startDate, endDate, accounts: accountIds })
      : Promise.resolve([]),
  ])
  const activitiesWithAccts = activitiesWithAcctsResult[0].status === 'fulfilled'
    ? activitiesWithAcctsResult[0].value : []

  // 4. Per-account positions
  const positionResults = await Promise.allSettled(
    accounts.map((acc: { id: string; institution_name: string; name: string }) =>
      getAccountPositions(userId, userSecret, acc.id)
        .then(pos => ({ accountId: acc.id, name: acc.name, positionCount: pos.length, positions: pos.slice(0, 5) }))
    )
  )
  const positionsByAccount = positionResults.map((r, i) =>
    r.status === 'fulfilled' ? r.value : { accountId: accounts[i]?.id, error: (r as PromiseRejectedResult).reason?.message }
  )

  // Summarise
  const summarise = (acts: { type?: string; trade_date?: string; symbol?: { symbol?: string }; units?: number | null; price?: number | null; account?: { institution_name?: string } }[]) =>
    acts.slice(0, 10).map(a => ({
      date: a.trade_date, type: a.type, symbol: a.symbol?.symbol,
      qty: a.units, price: a.price, broker: a.account?.institution_name,
    }))

  return NextResponse.json({
    stage: 'ok',
    userId,
    startDate,
    endDate,
    accountCount: accounts.length,
    accounts: accounts.map((a: { id: string; name: string; institution_name: string; sync_status?: unknown }) => ({
      id: a.id, name: a.name, institution: a.institution_name, sync: a.sync_status,
    })),
    authorizations: authsResult.status === 'fulfilled' ? authsResult.value : { error: (authsResult as PromiseRejectedResult).reason?.message },
    activitiesGlobal: {
      count: (activitiesGlobal as unknown[]).length,
      types: [...new Set((activitiesGlobal as { type?: string }[]).map(a => a.type))],
      first10: summarise(activitiesGlobal as { type?: string; trade_date?: string; symbol?: { symbol?: string }; units?: number | null; price?: number | null; account?: { institution_name?: string } }[]),
    },
    activitiesWithAccountIds: {
      count: (activitiesWithAccts as unknown[]).length,
      types: [...new Set((activitiesWithAccts as { type?: string }[]).map(a => a.type))],
      first10: summarise(activitiesWithAccts as { type?: string; trade_date?: string; symbol?: { symbol?: string }; units?: number | null; price?: number | null; account?: { institution_name?: string } }[]),
    },
    positionsByAccount,
  })
}
