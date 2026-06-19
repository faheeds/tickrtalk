import { requireUser, getActiveBrokerConnection } from './auth'
import { createAlpacaClient } from './alpaca'
import { decrypt } from './crypto'
import { NextResponse } from 'next/server'

export async function getUserAlpaca() {
  // requireUser throws if not authenticated — catch so the caller gets a proper JSON response
  const userId = await requireUser().catch(() => null)
  if (!userId) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      alpaca: null, userId: null,
    }
  }

  const conn = await getActiveBrokerConnection(userId, 'alpaca')

  if (!conn) {
    return {
      error: NextResponse.json({ error: 'No Alpaca connection. Add your API key in Settings.' }, { status: 428 }),
      alpaca: n