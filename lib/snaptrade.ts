/**
 * SnapTrade API client
 *
 * Authentication (from docs.snaptrade.com/docs/request-signatures):
 *  1. Build payload: { content: <body|null>, path: "/api/v1/...", query: "clientId=...&timestamp=..." }
 *  2. Canonicalize: sort all keys alphabetically, no whitespace
 *  3. Sign: HMAC-SHA256(canonical_json, consumerKey_as_utf8_string), base64-encode result
 *  4. Send: clientId + timestamp as query params; signature in `Signature` header
 */
import { createHmac } from 'crypto'

const BASE         = 'https://api.snaptrade.com/api/v1'
const CLIENT_ID    = process.env.SNAPTRADE_CLIENT_ID    ?? ''
const CONSUMER_KEY = process.env.SNAPTRADE_CONSUMER_KEY ?? ''

export function snapTradeConfigured(): boolean {
  return !!(process.env.SNAPTRADE_CLIENT_ID && process.env.SNAPTRADE_CONSUMER_KEY)
}

// ── Canonical JSON (keys sorted alphabetically at every nesting level) ────────
function canonicalJson(obj: unknown): string {
  // Collect every key name that appears anywhere in the object tree
  const allKeys: string[] = []
  const seen: Record<string, null> = {}
  JSON.stringify(obj, function (key, value) {
    if (!(key in seen)) { allKeys.push(key); seen[key] = null }
    return value
  })
  allKeys.sort()
  return JSON.stringify(obj, allKeys)
}

// ── Signature ─────────────────────────────────────────────────────────────────
function computeSignature(
  fullPath: string,   // e.g. /api/v1/snapTrade/registerUser
  queryString: string, // e.g. clientId=X&timestamp=Y  (no leading ?)
  body: unknown,       // request body object, or null for GET / empty
): string {
  const sigObject = {
    content: (body == null || body === '') ? null : body,
    path:    fullPath,
    query:   queryString,
  }
  const message = canonicalJson(sigObject)
  // Consumer key is used as-is (UTF-8 string), NOT base64-decoded
  return createHmac('sha256', CONSUMER_KEY)
    .update(message)
    .digest('base64')
}

// ── Core fetch helper ─────────────────────────────────────────────────────────
async function st(
  method:  string,
  path:    string,
  query?:  Record<string, string>,
  body?:   unknown,
): Promise<unknown> {
  const timestamp = Math.floor(Date.now() / 1000).toString()

  // Build query string: clientId + timestamp FIRST (order matters for signing)
  const params = new URLSearchParams({ clientId: CLIENT_ID, timestamp })
  if (query) Object.entries(query).forEach(([k, v]) => params.set(k, v))
  const queryString = params.toString()

  const fullPath = `/api/v1${path}`
  const url      = `${BASE}${path}?${queryString}`

  // Signature covers the full payload (body, path, query)
  const signature = computeSignature(fullPath, queryString, body ?? null)

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Signature':    signature,
    },
    body: body != null ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`SnapTrade ${method} ${path} → ${res.status}: ${text}`)
  }

  const ct = res.headers.get('content-type') ?? ''
  return ct.includes('application/json') ? res.json() : {}
}

// ── User management ──────────────────────────────────────────────────────────

export async function registerUser(
  userId: string,
): Promise<{ userId: string; userSecret: string }> {
  return st('POST', '/snapTrade/registerUser', undefined, { userId }) as Promise<{
    userId: string
    userSecret: string
  }>
}

export async function deleteUser(userId: string, userSecret: string): Promise<void> {
  await st('DELETE', '/snapTrade/deleteUser', { userId, userSecret })
}

// ── OAuth portal ──────────────────────────────────────────────────────────────

export interface LoginResponse {
  redirectURI: string
}

export async function generateLoginLink(
  userId: string,
  userSecret: string,
  opts: {
    broker?:            string
    reconnect?:         string
    immediateRedirect?: boolean
    customRedirect?:    string
  } = {},
): Promise<LoginResponse> {
  // Only include non-null fields in body so content doesn't have undefined values
  const bodyObj: Record<string, unknown> = {}
  if (opts.broker)           bodyObj.broker            = opts.broker
  if (opts.reconnect)        bodyObj.reconnect         = opts.reconnect
  if (opts.customRedirect)   bodyObj.customRedirect    = opts.customRedirect
  bodyObj.immediateRedirect = opts.immediateRedirect ?? true

  return st('POST', '/snapTrade/login', { userId, userSecret }, bodyObj) as Promise<LoginResponse>
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export interface SnapTradeAccount {
  id:                      string
  brokerage_authorization: string
  name:                    string
  number:                  string
  institution_name:        string
  meta: { type: string; status: string }
}

export async function listAccounts(
  userId: string,
  userSecret: string,
): Promise<SnapTradeAccount[]> {
  return st('GET', '/accounts', { userId, userSecret }) as Promise<SnapTradeAccount[]>
}

// ── Authorizations ────────────────────────────────────────────────────────────

export interface SnapTradeAuthorization {
  id:           string
  created_date: string
  updated_date: string
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

// ── Activities ────────────────────────────────────────────────────────────────

export interface SnapTradeActivity {
  id:              string
  trade_date:      string
  settlement_date: string
  symbol: { id: string; symbol: string; description: string }
  currency: { code: string }
  account: { id: string; name: string; institution_name: string }
  type:        string   // BUY | SELL | DIVIDEND | FEE | …
  amount:      number | null
  price:       number | null
  units:       number | null
  description: string
}

export async function getActivities(
  userId: string,
  userSecret: string,
  opts: {
    startDate?: string
    endDate?:   string
    accounts?:  string[]
    types?:     string
  } = {},
): Promise<SnapTradeActivity[]> {
  const q: Record<string, string> = { userId, userSecret }
  if (opts.startDate)        q.startDate = opts.startDate
  if (opts.endDate)          q.endDate   = opts.endDate
  if (opts.accounts?.length) q.accounts  = opts.accounts.join(',')
  if (opts.types)            q.types     = opts.types
  return st('GET', '/activities', q) as Promise<SnapTradeActivity[]>
}
