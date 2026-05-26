import { createHmac } from 'crypto'

const BASE         = 'https://api.snaptrade.com/api/v1'
const CLIENT_ID    = process.env.SNAPTRADE_CLIENT_ID    ?? ''
const CONSUMER_KEY = process.env.SNAPTRADE_CONSUMER_KEY ?? ''

export function snapTradeConfigured(): boolean {
  return !!(process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CONSUMER_KEY)
}

// ── Auth query params (SnapTrade requires these in the query string) ──────────
// Consumer key must be base64-decoded before use as HMAC secret.
// Signature must be base64-encoded (not hex).
function authParams(): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000).toString()
  const keyBytes  = Buffer.from(CONSUMER_KEY, 'base64')
  const signature = createHmac('sha256', keyBytes)
    .update(timestamp)
    .digest('base64')
  return { clientId: CLIENT_ID, timestamp, signature }
}

// ── Helper ───────────────────────────────────────────────────────────────────
async function st(
  method: string,
  path: string,
  query?: Record<string, string>,
  body?: unknown,
): Promise<unknown> {
  const url = new URL(`${BASE}${path}`)

  // Auth params always go in the query string
  const auth = authParams()
  Object.entries(auth).forEach(([k, v]) => url.searchParams.set(k, v))

  // Extra query params (userId, userSecret, filters, etc.)
  if (query) Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v))

  const res = await fetch(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`SnapTrade ${method} ${path} → ${res.status}: ${text}`)
  }

  const ct = res.headers.get('content-type') ?? ''
  return ct.includes('application/json') ? res.json() : {}
}

// ── User management ──────────────────────────────────────────────────────────

/** Register a new SnapTrade user and return their userSecret */
export async function registerUser(userId: string): Promise<{ userId: string; userSecret: string }> {
  return st('POST', '/snapTrade/registerUser', undefined, { userId }) as Promise<{
    userId: string
    userSecret: string
  }>
}

/** Delete a SnapTrade user and all their broker connections */
export async function deleteUser(userId: string, userSecret: string): Promise<void> {
  await st('DELETE', '/snapTrade/deleteUser', { userId, userSecret })
}

// ── OAuth link ───────────────────────────────────────────────────────────────

export interface LoginResponse {
  redirectURI: string
}

/**
 * Generate a SnapTrade OAuth portal URL.
 * `broker` is optional — if provided, skips broker selection screen.
 * `reconnect` is an authorizationId to refresh existing connection.
 */
export async function generateLoginLink(
  userId: string,
  userSecret: string,
  opts: {
    broker?: string
    reconnect?: string
    immediateRedirect?: boolean
    customRedirect?: string
  } = {},
): Promise<LoginResponse> {
  return st('POST', '/snapTrade/login', { userId, userSecret }, {
    broker:             opts.broker,
    reconnect:          opts.reconnect,
    immediateRedirect:  opts.immediateRedirect ?? true,
    customRedirect:     opts.customRedirect,
  }) as Promise<LoginResponse>
}

// ── Accounts ─────────────────────────────────────────────────────────────────

export interface SnapTradeAccount {
  id:             string  // accountId
  brokerage_authorization: string  // authorizationId
  name:           string
  number:         string
  institution_name: string
  meta: {
    type: string  // REGISTERED | CASH | MARGIN
    status: string
  }
}

export async function listAccounts(userId: string, userSecret: string): Promise<SnapTradeAccount[]> {
  return st('GET', '/accounts', { userId, userSecret }) as Promise<SnapTradeAccount[]>
}

// ── Authorizations (broker connections) ──────────────────────────────────────

export interface SnapTradeAuthorization {
  id:            string
  created_date:  string
  updated_date:  string
  brokerage: {
    id:           string
    name:         string
    display_name: string
    logo_url:     string
    status:       string
  }
}

export async function listAuthorizations(
  userId: string,
  userSecret: string,
): Promise<SnapTradeAuthorization[]> {
  return st('GET', '/authorizations', { userId, userSecret }) as Promise<SnapTradeAuthorization[]>
}

export async function deleteAuthorization(
  userId: string,
  userSecret: string,
  authorizationId: string,
): Promise<void> {
  await st('DELETE', `/authorizations/${authorizationId}`, { userId, userSecret })
}

// ── Trade history ─────────────────────────────────────────────────────────────

export interface SnapTradeActivity {
  id:              string
  trade_date:      string   // ISO date
  settlement_date: string
  symbol: {
    id:     string
    symbol: string
    description: string
  }
  currency: { code: string }
  account:  { id: string; name: string; institution_name: string }
  type:        string  // BUY | SELL | DIVIDEND | FEE | …
  amount:      number | null
  price:       number | null
  units:       number | null
  description: string
}

export async function getActivities(
  userId: string,
  userSecret: string,
  opts: {
    startDate?: string  // YYYY-MM-DD
    endDate?:   string
    accounts?:  string[]  // accountIds
    types?:     string    // e.g. "BUY,SELL"
  } = {},
): Promise<SnapTradeActivity[]> {
  const q: Record<string, string> = { userId, userSecret }
  if (opts.startDate)             q.startDate = opts.startDate
  if (opts.endDate)               q.endDate   = opts.endDate
  if (opts.accounts?.length)      q.accounts  = opts.accounts.join(',')
  if (opts.types)                 q.types     = opts.types

  return st('GET', '/activities', q) as Promise<SnapTradeActivity[]>
}

// ── Brokerages list ──────────────────────────────────────────────────────────

export interface SnapTradeBrokerage {
  id:            string
  name:          string
  display_name:  string
  description:   string
  logo_url:      string
  status:        string
  url:           string
  aws_s3_logo_url: string | null
  country_supported: string[]
}

export async function listBrokerages(): Promise<SnapTradeBrokerage[]> {
  return st('GET', '/brokerages') as Promise<SnapTradeBrokerage[]>
}
