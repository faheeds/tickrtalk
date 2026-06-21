import type { Bar } from './types'

// ── True Range / ATR (Wilder smoothing) ──────────────────────────────────────
export function calcATR(bars: Bar[], period = 14): number[] {
  const tr: number[] = []
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high, l = bars[i].low, pc = bars[i - 1].close
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)))
  }
  if (tr.length < period) return []
  const atr: number[] = []
  let seed = tr.slice(0, period).reduce((a, b) => a + b, 0) / period
  atr.push(seed)
  for (let i = period; i < tr.length; i++) {
    seed = (seed * (period - 1) + tr[i]) / period
    atr.push(seed)
  }
  return atr  // length = bars.length - period
}

// ── SuperTrend ────────────────────────────────────────────────────────────────
export interface SuperTrendResult {
  supertrend: (number | null)[]  // same length as bars
  direction:  (1 | -1 | null)[]  // 1 = bullish, -1 = bearish
}

export function calcSuperTrend(bars: Bar[], period = 10, multiplier = 3.0): SuperTrendResult {
  const n   = bars.length
  const atr = calcATR(bars, period)  // length = n - period
  const st:  (number | null)[]  = new Array(n).fill(null)
  const dir: (1 | -1 | null)[] = new Array(n).fill(null)

  for (let i = period; i < n; i++) {
    const atrVal = atr[i - period]
    if (!atrVal || isNaN(atrVal)) continue
    const hl2 = (bars[i].high + bars[i].low) / 2
    let upper = hl2 + multiplier * atrVal
    let lower = hl2 - multiplier * atrVal

    if (i > period && st[i - 1] !== null) {
      const prevST = st[i - 1]!
      if (dir[i - 1] === 1)  lower = Math.max(lower, prevST)
      if (dir[i - 1] === -1) upper = Math.min(upper, prevST)
    }

    if (i === period) {
      st[i]  = bars[i].close > upper ? lower : upper
      dir[i] = bars[i].close > upper ? 1 : -1
    } else {
      const prev = st[i - 1]!
      const pd   = dir[i - 1]!
      if (pd === 1) {
        st[i]  = Math.max(lower, prev)
        dir[i] = bars[i].close < st[i]! ? -1 : 1
      } else {
        st[i]  = Math.min(upper, prev)
        dir[i] = bars[i].close > st[i]! ? 1 : -1
      }
    }
  }
  return { supertrend: st, direction: dir }
}

// ── Simple Moving Average ─────────────────────────────────────────────────────
export function calcSMA(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null
    return values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  })
}

// ── Exponential Moving Average ────────────────────────────────────────────────
export function calcEMA(values: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1)
  const out: (number | null)[] = []
  let ema: number | null = null
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(null); continue }
    if (ema === null) { ema = values.slice(0, period).reduce((a, b) => a + b, 0) / period }
    else { ema = values[i] * k + ema * (1 - k) }
    out.push(+ema.toFixed(4))
  }
  return out
}

// ── Relative Strength Index ───────────────────────────────────────────────────
export function calcRSI(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [null]
  let ag = 0, al = 0
  for (let i = 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1]
    const g = d > 0 ? d : 0
    const l = d < 0 ? -d : 0
    if (i < period) { ag += g / period; al += l / period; out.push(null); continue }
    if (i === period) {
      out.push(al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(2))
      continue
    }
    ag = (ag * (period - 1) + g) / period
    al = (al * (period - 1) + l) / period
    out.push(al === 0 ? 100 : +(100 - 100 / (1 + ag / al)).toFixed(2))
  }
  return out
}

// ── Intraday VWAP (cumulative from first bar of session) ──────────────────────
export function calcVWAP(bars: Bar[]): number[] {
  let cumTPV = 0, cumVol = 0
  return bars.map(b => {
    cumTPV += ((b.high + b.low + b.close) / 3) * b.volume
    cumVol += b.volume
    return cumVol > 0 ? cumTPV / cumVol : b.close
  })
}
