import { calculateIndicators, type IndicatorResult } from "./indicators.js";
import { detectPatterns, type PatternResult } from "./patterns.js";
import type { Candle } from "./broker-adapter.js";

export type SignalLabel =
  | "STRONG_BUY" | "BUY" | "WEAK_BUY" | "NEUTRAL"
  | "WEAK_SELL" | "SELL" | "STRONG_SELL";

export interface SignalResult {
  symbol: string;
  signal: SignalLabel;
  score: number;
  confidence: number;
  entry: number;
  target1: number;
  target2: number;
  target3: number;
  stopLoss: number;
  riskReward: number;
  reasons: string[];
  indicators: IndicatorResult;
  patterns: PatternResult;
}

function scoreLabel(score: number): SignalLabel {
  if (score >= 12) return "STRONG_BUY";
  if (score >= 7) return "BUY";
  if (score >= 3) return "WEAK_BUY";
  if (score >= -2) return "NEUTRAL";
  if (score >= -6) return "WEAK_SELL";
  if (score >= -11) return "SELL";
  return "STRONG_SELL";
}

export function generateSignal(symbol: string, candles: Candle[]): SignalResult {
  const indicators = calculateIndicators(candles);
  const patterns = detectPatterns(candles);
  const reasons: string[] = [];
  let score = 0;

  const price = candles[candles.length - 1]?.close ?? 0;
  const { ema9, ema21, ema50, ema200, macd, rsi, bollingerBands, adx, stochastic, vwap, volumeRatio, supertrend, pivotPoints } = indicators;

  if (ema9 !== null && ema21 !== null) {
    if (ema9 > ema21) { score += 1; reasons.push("EMA9 > EMA21 (+1)"); }
    else { score -= 1; reasons.push("EMA9 < EMA21 (-1)"); }
  }
  if (ema21 !== null && ema50 !== null) {
    if (ema21 > ema50) { score += 1; reasons.push("EMA21 > EMA50 (+1)"); }
  }
  if (ema50 !== null && ema200 !== null) {
    if (ema50 > ema200) { score += 2; reasons.push("EMA50 > EMA200 (+2)"); }
    else { score -= 2; reasons.push("EMA50 < EMA200 (-2)"); }
  }
  if (ema200 !== null && price > 0) {
    if (price > ema200) { score += 2; reasons.push("Price > EMA200 (+2)"); }
    else { score -= 2; reasons.push("Price < EMA200 (-2)"); }
  }

  if (macd) {
    if (macd.crossover === "BULLISH") { score += 3; reasons.push("MACD Bull Cross (+3)"); }
    else if (macd.crossover === "BEARISH") { score -= 3; reasons.push("MACD Bear Cross (-3)"); }
    if (macd.histogram > 0) { score += 1; reasons.push("MACD Histogram rising (+1)"); }
  }

  if (supertrend) {
    if (supertrend.signal === "BUY") { score += 2; reasons.push("Supertrend BUY (+2)"); }
    else { score -= 2; reasons.push("Supertrend SELL (-2)"); }
  }

  if (rsi) {
    const rv = rsi.value;
    if (rv < 25) { score += 3; reasons.push(`RSI ${rv.toFixed(1)} < 25 (+3)`); }
    else if (rv < 30) { score += 2; reasons.push(`RSI ${rv.toFixed(1)} < 30 (+2)`); }
    else if (rv < 40) { score += 1; reasons.push(`RSI ${rv.toFixed(1)} < 40 (+1)`); }
    else if (rv > 75) { score -= 3; reasons.push(`RSI ${rv.toFixed(1)} > 75 (-3)`); }
    else if (rv > 70) { score -= 2; reasons.push(`RSI ${rv.toFixed(1)} > 70 (-2)`); }
    else if (rv > 60) { score -= 1; reasons.push(`RSI ${rv.toFixed(1)} > 60 (-1)`); }

    if (rsi.divergence === "BULL") { score += 3; reasons.push("Bull RSI Divergence (+3)"); }
    else if (rsi.divergence === "BEAR") { score -= 3; reasons.push("Bear RSI Divergence (-3)"); }
  }

  if (stochastic) {
    const { k, d, signal } = stochastic;
    if (signal === "BULLISH" && k < 20 && d < 20) { score += 2; reasons.push("Stoch Bull Cross Oversold (+2)"); }
    else if (signal === "BEARISH" && k > 80 && d > 80) { score -= 2; reasons.push("Stoch Bear Cross Overbought (-2)"); }
  }

  if (volumeRatio !== null) {
    const candle = candles[candles.length - 1];
    const bullCandle = candle.close > candle.open;
    if (volumeRatio >= 2) {
      score += bullCandle ? 2 : -2;
      reasons.push(`Volume ${volumeRatio.toFixed(1)}x avg (${bullCandle ? "+2" : "-2"})`);
    } else if (volumeRatio >= 1.5) {
      score += bullCandle ? 1 : -1;
      reasons.push(`Volume ${volumeRatio.toFixed(1)}x avg (${bullCandle ? "+1" : "-1"})`);
    }
  }

  if (vwap !== null && price > 0) {
    if (price > vwap) { score += 1; reasons.push("Price > VWAP (+1)"); }
    else { score -= 1; reasons.push("Price < VWAP (-1)"); }
  }

  if (bollingerBands) {
    const { upper, lower, squeeze } = bollingerBands;
    if (price <= lower) { score += 2; reasons.push("Price at BB Lower (+2)"); }
    else if (price >= upper) { score -= 2; reasons.push("Price at BB Upper (-2)"); }
    if (squeeze) reasons.push("BB Squeeze detected");
  }

  if (pivotPoints && price > 0) {
    const { s1, s2, r1, r2 } = pivotPoints;
    const nearSupport = price > s1 * 0.995 && price < s1 * 1.005;
    const breakAboveR1 = price > r1 * 1.002;
    const breakBelowS2 = price < s2 * 0.998;
    if (nearSupport) { score += 2; reasons.push("Near Pivot Support (+2)"); }
    if (breakAboveR1) { score += 3; reasons.push("Breakout above R1 (+3)"); }
    if (breakBelowS2) { score -= 3; reasons.push("Breakdown below S2 (-3)"); }
  }

  if (adx) {
    if (adx.adx > 25) {
      if (adx.plusDI > adx.minusDI) { score += 1; reasons.push("ADX strong +DI dominates (+1)"); }
      else { score -= 1; reasons.push("ADX strong -DI dominates (-1)"); }
    }
  }

  const candleScoreMap: Record<string, number> = {
    Hammer: 2, BullEngulfing: 2, MorningStar: 3, ThreeWhiteSoldiers: 3,
    InvertedHammer: 1, PiercingLine: 2, TweezerBottom: 1, BullHarami: 1,
    DragonflyDoji: 1,
    ShootingStar: -2, BearEngulfing: -2, EveningStar: -3, ThreeBlackCrows: -3,
    HangingMan: -2, DarkCloud: -2, TweezerTop: -1, BearHarami: -1,
    GravestoneDoji: -1,
  };

  for (const pattern of patterns.candlestick) {
    const s = candleScoreMap[pattern] ?? 0;
    if (s !== 0) {
      score += s;
      reasons.push(`${pattern} (${s > 0 ? "+" : ""}${s})`);
    }
  }

  const chartScoreMap: Record<string, number> = {
    DoubleBottom: 3, InverseHeadAndShoulders: 3, FallingWedge: 2, AscendingTriangle: 2,
    DoubleTop: -3, HeadAndShoulders: -3, RisingWedge: -2, DescendingTriangle: -2,
    ChannelUp: 1, ChannelDown: -1,
  };

  for (const pattern of patterns.chart) {
    const s = chartScoreMap[pattern] ?? 0;
    if (s !== 0) {
      score += s;
      reasons.push(`${pattern} chart pattern (${s > 0 ? "+" : ""}${s})`);
    }
  }

  const lows20 = candles.slice(-20).map(c => c.low);
  const minLow = Math.min(...lows20);
  const atr = indicators.atr ?? (price * 0.01);
  const slFromLow = minLow * 0.995;
  const slFromATR = price - atr * 1.5;
  const stopLoss = Math.max(slFromLow, slFromATR);

  const risk = price - stopLoss;
  const target1 = price + risk * 1.5;
  const target2 = price + risk * 2.5;
  const target3 = price + risk * 3.5;
  const riskReward = risk > 0 ? (target1 - price) / risk : 0;

  let finalLabel = scoreLabel(score);
  if (riskReward < 1.5 && (finalLabel === "BUY" || finalLabel === "STRONG_BUY" || finalLabel === "WEAK_BUY")) {
    finalLabel = "NEUTRAL";
    reasons.push("R:R too low — overridden to NEUTRAL");
  }

  const confidence = Math.min(95, Math.max(10, 50 + score * 3));

  return {
    symbol,
    signal: finalLabel,
    score,
    confidence,
    entry: price,
    target1,
    target2,
    target3,
    stopLoss,
    riskReward,
    reasons,
    indicators,
    patterns,
  };
}
