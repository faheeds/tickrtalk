/**
 * Per-user Alpaca client factory.
 * Accepts decrypted API key + secret and returns all the same
 * helpers as the original alpaca-client.js, but scoped to one user.
 */
import axios, { AxiosInstance } from 'axios'

export interface AlpacaCreds {
  apiKey:    string
  apiSecret: string
  paper:     boolean
}

export function createAlpacaClient(creds: AlpacaCreds) {
  const TRADE_BASE = creds.paper
    ? 'https://paper-api.alpaca.markets'
    : 'https://api.alpaca.markets'
  const DATA_BASE  = 'https://data.alpaca.markets'
  const FEED       = 'iex'
  const TIMEOUT    = 10_000

  const headers = () => ({
    'APCA-API-KEY-ID':     creds.apiKey,
    'APCA-API-SECRET-KEY': creds.apiSecret,
  })

  async function tradeGet(path: string, params = {}) {
    const r = await axios.get(TRADE_BASE + path, { headers: headers(), params, timeout: TIMEOUT })
    return r.data
  }
  async function tradePost(path: string, body = {}) {
    const r = await axios.post(TRADE_BASE + path, body, { headers: headers(), timeout: TIMEOUT })
    return r.data
  }
  async function tradeDelete(path: string) {
    const r = await axios.delete(TRADE_BASE + path, { headers: headers(), timeout: TIMEOUT })
    return r.data
  }
  async function dataGet(path: string, params = {}) {
    const r = await axios.get(DATA_BASE + path, { headers: headers(), params, timeout: TIMEOUT })
    return r.data
  }

  async function getAccount() {
    const a = await tradeGet('/v2/account')
    return {
      status:           a.status,
      buyingPower:      +parseFloat(a.buying_power).toFixed(2),
      cash:             +parseFloat(a.cash).toFixed(2),
      portfolioValue:   +parseFloat(a.portfolio_value).toFixed(2),
      equity:           +parseFloat(a.equity).toFixed(2),
      lastEquity:       +parseFloat(a.last_equity).toFixed(2),
      dayPnl:           +(parseFloat(a.equity) - parseFloat(a.last_equity)).toFixed(2),
      dayPnlPct:        +((parseFloat(a.equity) - parseFloat(a.last_equity)) / parseFloat(a.last_equity) * 100).toFixed(2),
      patternDayTrader: a.pattern_day_trader,
      tradingBlocked:   a.trading_blocked,
      paper:            creds.paper,
    }
  }

  async function getPositions() {
    const positions = await tradeGet('/v2/positions')
    return positions.map((p: any) => ({
      symbol:        p.symbol,
      qty:           +parseFloat(p.qty).toFixed(0),
      side:          p.side,
      avgEntryPrice: +parseFloat(p.avg_entry_price).toFixed(2),
      currentPrice:  +parseFloat(p.current_price).toFixed(2),
      marketValue:   +parseFloat(p.market_value).toFixed(2),
      costBasis:     +parseFloat(p.cost_basis).toFixed(2),
      unrealizedPnl: +parseFloat(p.unrealized_pl).toFixed(2),
      unrealizedPct: +parseFloat(p.unrealized_plpc * 100).toFixed(2),
      todayPnl:      +parseFloat(p.unrealized_intraday_pl).toFixed(2),
      todayPct:      +parseFloat(p.unrealized_intraday_plpc * 100).toFixed(2),
    }))
  }

  async function getOrders(status = 'open') {
    return tradeGet('/v2/orders', { status, limit: 100, direction: 'desc' })
  }

  async function getBars(symbol: string, months = 18, timeframe = '1Day') {
    const end   = new Date()
    const start = new Date()
    start.setMonth(start.getMonth() - months)
    try {
      const data = await dataGet(`/v2/stocks/${symbol}/bars`, {
        timeframe, start: start.toISOString().slice(0, 10),
        end: end.toISOString().slice(0, 10), feed: FEED, limit: 10000,
      })
      let bars = data.bars || []
      let next = data.next_page_token
      while (next) {
        const page = await dataGet(`/v2/stocks/${symbol}/bars`, {
          timeframe, start: start.toISOString().slice(0, 10),
          end: end.toISOString().slice(0, 10), feed: FEED, limit: 10000, page_token: next,
        })
        bars = bars.concat(page.bars || [])
        next = page.next_page_token
      }
      return bars
        .filter((b: any) => b.c && b.o && b.h && b.l)
        .sort((a: any, b: any) => new Date(a.t).getTime() - new Date(b.t).getTime())
        .map((b: any) => ({ date: new Date(b.t), open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v, vwap: b.vw || null }))
    } catch { return [] }
  }

  async function getBulkQuotes(symbols: string[]) {
    const results: Record<string, any> = {}
    const CHUNK = 100
    for (let i = 0; i < symbols.length; i += CHUNK) {
      const batch = symbols.slice(i, i + CHUNK)
      try {
        const data = await dataGet('/v2/stocks/snapshots', { symbols: batch.join(','), feed: FEED })
        for (const [sym, s] of Object.entries(data) as any) {
          const price = s?.latestTrade?.p || s?.minuteBar?.c || null
          results[sym] = {
            symbol: sym,
            price:  price ? +price.toFixed(2) : null,
            open:   s?.dailyBar?.o || null,
            high:   s?.dailyBar?.h || null,
            low:    s?.dailyBar?.l || null,
            prevClose: s?.prevDailyBar?.c || null,
            changesPct: s?.dailyBar && s?.prevDailyBar
              ? +((s.dailyBar.c - s.prevDailyBar.c) / s.prevDailyBar.c * 100).toFixed(2) : null,
            volume: s?.dailyBar?.v || null,
            vwap:   s?.dailyBar?.vw || null,
          }
        }
      } catch {}
      if (i + CHUNK < symbols.length) await new Promise(r => setTimeout(r, 200))
    }
    return results
  }

  async function getClock() {
    try {
      const c = await tradeGet('/v2/clock')
      return { isOpen: c.is_open, nextOpen: c.next_open, nextClose: c.next_close, timestamp: c.timestamp }
    } catch { return null }
  }

  async function placeOrder(opts: {
    symbol: string; qty: number; side: 'buy' | 'sell'
    limitPrice?: number; stopPrice?: number; targetPrice?: number; strategy?: string
  }) {
    const { symbol, side, strategy = 'ALGO' } = opts
    let { qty, limitPrice, stopPrice, targetPrice } = opts

    if (side !== 'buy' && side !== 'sell')
      return { ok: false, message: `Cash-only: side "${side}" not allowed` }

    if (side === 'sell') {
      const positions = await getPositions().catch(() => [])
      const held = positions.find((p: any) => p.symbol === symbol)
      if (!held) return { ok: false, message: `No position in ${symbol} (no shorting)` }
      qty = Math.min(Math.round(qty), held.qty)
    }

    if (side === 'buy') {
      const account = await getAccount().catch(() => null)
      const cash = account?.cash ?? null
      if (cash !== null && limitPrice) {
        qty = Math.min(Math.round(qty), Math.max(1, Math.floor(cash / limitPrice)))
      }
    }

    const hasBracket = stopPrice && targetPrice
    const body: any = {
      symbol, qty: Math.max(1, Math.round(qty)), side,
      type: limitPrice ? 'limit' : 'market', time_in_force: 'day',
      ...(limitPrice && { limit_price: limitPrice.toFixed(2) }),
      ...(hasBracket && {
        order_class: 'bracket',
        stop_loss:   { stop_price:  stopPrice!.toFixed(2) },
        take_profit: { limit_price: targetPrice!.toFixed(2) },
      }),
      client_order_id: `tickrtalk_${strategy}_${Date.now()}`,
    }

    try {
      const order = await tradePost('/v2/orders', body)
      return { ok: true, orderId: order.id, status: order.status, order }
    } catch (e: any) {
      return { ok: false, message: e.response?.data?.message || e.message }
    }
  }

  return { getAccount, getPositions, getOrders, getBars, getBulkQuotes, getClock, placeOrder }
}
