import { getUserAlpaca }  from '@/lib/getUserAlpaca'
import { supabaseAdmin }  from '@/lib/supabase'
import { getVerdictMap }  from '@/lib/halal'
import { requireUser }    from '@/lib/auth'
import { NextResponse }   from 'next/server'

export async function GET() {
  const userId = await requireUser().catch(() => null)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: wl } = await supabaseAdmin.from('watchlists').select('symbols').eq('user_id', userId).single()
  const symbols = wl?.symbols ?? []
  if (!symbols.length) return NextResponse.json({ symbols: [], quotes: {}, verdicts: {} })

  const { alpaca, error } = await getUserAlpaca()
  const quotes = alpaca ? await alpaca.getBulkQuotes(symbols) : {}
  const verdictMap = getVerdictMap()
  const verdicts: Record<string, string> = {}
  for (const sym of symbols) verdicts[sym] = verdictMap[sym] ?? 'UNKNOWN'

  return NextResponse.json({ symbols, quotes, verdicts })
}
