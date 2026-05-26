import { requireUser, getActiveBrokerConnection } from './auth'
import { createAlpacaClient } from './alpaca'
import { decrypt } from './crypto'
import { NextResponse } from 'next/server'

export async function getUserAlpaca() {
  const userId = await requireUser()
  const conn   = await getActiveBrokerConnection(userId, 'alpaca')

  if (!conn) {
    return {
      error: NextResponse.json({ error: 'No Alpaca connection. Add your API key in Settings.' }, { status: 428 }),
      alpaca: null, userId: null,
    }
  }

  const apiKey    = decrypt(conn.api_key_encrypted)
  const apiSecret = decrypt(conn.api_secret_encrypted)

  const alpaca = createAlpacaClient({ apiKey, apiSecret, paper: conn.paper_mode })
  return { alpaca, userId, error: null }
}
