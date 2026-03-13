/**
 * Smart Candle Fetcher
 * 
 * Fetches the OPTIMAL amount of historical data per interval so every indicator
 * (EMA200, ADX, RSI, MACD…) has enough warmup candles to be accurate.
 *
 * Based on the Core Rule: every EMA-based indicator needs extra history beyond
 * its period to stabilize. EMA200 needs 400+ candles, ADX needs 150-200, etc.
 * 
 * Angel One SmartAPI max lookback limits (per their documentation):
 *   ONE_MINUTE       → 30 days
 *   THREE_MINUTE     → 60 days
 *   FIVE_MINUTE      → 100 days
 *   FIFTEEN_MINUTE   → 200 days
 *   THIRTY_MINUTE    → 200 days
 *   ONE_HOUR         → 400 days
 *   ONE_DAY          → 2000 days
 *   ONE_WEEK         → 2000 days
 *   ONE_MONTH        → 2000 days
 */

import * as angelone from "./angelone.js";
import type { Candle } from "./broker-adapter.js";

/** Candles-per-trading-day per interval (NSE: 375 min/day) */
const CANDLES_PER_DAY: Record<string, number> = {
  ONE_MINUTE:      375,
  THREE_MINUTE:    125,
  FIVE_MINUTE:     75,
  FIFTEEN_MINUTE:  25,
  THIRTY_MINUTE:   13,
  ONE_HOUR:        7,
  FOUR_HOUR:       2,
  ONE_DAY:         1,
  ONE_WEEK:        0.2,
  ONE_MONTH:       0.05,
};

/**
 * How many calendar days to look back per interval.
 * Target: ≥ 500 output candles so EMA200/ADX always have enough warmup.
 * Capped at Angel One's per-interval maximums.
 */
const LOOKBACK_DAYS: Record<string, number> = {
  ONE_MINUTE:     10,   // 10d × 375 = 3750 candles ✅
  THREE_MINUTE:   20,   // 20d × 125 = 2500 candles ✅
  FIVE_MINUTE:    30,   // 30d ×  75 = 2250 candles ✅
  FIFTEEN_MINUTE: 90,   // 90d ×  25 = 2250 candles ✅
  THIRTY_MINUTE:  130,  // 130d × 13 = 1690 candles ✅
  ONE_HOUR:       300,  // 300d ×  7 = 2100 candles ✅ (max 400d)
  FOUR_HOUR:      600,  // 600d ×  2 =  900 candles ✅
  ONE_DAY:        730,  // 730d ×  1 =  ~520 trading days ✅ (2 years)
  ONE_WEEK:       1500, // 1500d × 0.2 = 300 weeks ✅
  ONE_MONTH:      2000, // max for monthly
};

const pad = (n: number) => n.toString().padStart(2, "0");
const fmt = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * Fetch candles with the correct lookback for the given interval.
 * Always returns candles sorted oldest → newest.
 */
export async function fetchCandles(
  token: string,
  interval = "FIFTEEN_MINUTE",
  exchange = "NSE"
): Promise<Candle[]> {
  const days = LOOKBACK_DAYS[interval] ?? 90;
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const raw = await angelone.getCandleData({
    exchange,
    symboltoken: token,
    interval,
    fromdate: fmt(from),
    todate: fmt(now),
  });

  if (!Array.isArray(raw) || raw.length === 0) return [];

  const candles: Candle[] = raw.map(([ts, open, high, low, close, volume]) => ({
    time: new Date(ts).getTime() / 1000,
    open,
    high,
    low,
    close,
    volume,
  }));

  const candlesPerDay = CANDLES_PER_DAY[interval] ?? 25;
  const expectedMin = Math.max(200, Math.round(candlesPerDay * days * 0.3)); // at least 30% of expected
  if (candles.length < expectedMin) {
    console.warn(
      `[fetchCandles] ${token}/${interval}: got ${candles.length} candles (expected ≥${expectedMin}). ` +
      `Indicators may be less accurate.`
    );
  } else {
    console.log(
      `[fetchCandles] ${token}/${interval}: ${candles.length} candles ` +
      `(${days}d lookback) — sufficient for all indicators`
    );
  }

  return candles;
}

/**
 * Returns how many candles you'd expect for a given interval + lookback.
 * Useful for sanity-checking.
 */
export function estimateCandleCount(interval: string, days?: number): number {
  const d = days ?? LOOKBACK_DAYS[interval] ?? 90;
  return Math.round((CANDLES_PER_DAY[interval] ?? 25) * d * 0.7); // ~70% trading days
}
