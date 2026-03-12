import {
  EMA,
  SMA,
  MACD,
  RSI,
  BollingerBands,
  ATR,
  ADX,
  Stochastic,
  OBV,
  ROC,
  CCI,
  WilliamsR,
} from "technicalindicators";
import type { Candle } from "./broker-adapter.js";

export interface IndicatorResult {
  ema9: number | null;
  ema21: number | null;
  ema50: number | null;
  ema200: number | null;
  sma20: number | null;
  macd: { macdLine: number; signalLine: number; histogram: number; crossover: "BULLISH" | "BEARISH" | null } | null;
  rsi: { value: number; divergence: "BULL" | "BEAR" | null } | null;
  bollingerBands: { upper: number; middle: number; lower: number; squeeze: boolean } | null;
  atr: number | null;
  adx: { adx: number; plusDI: number; minusDI: number } | null;
  stochastic: { k: number; d: number; signal: "BULLISH" | "BEARISH" | null } | null;
  obv: number | null;
  vwap: number | null;
  cci: number | null;
  williamsR: number | null;
  roc: number | null;
  volumeAvg: number | null;
  volumeRatio: number | null;
  supertrend: { signal: "BUY" | "SELL"; value: number; flip: boolean } | null;
  pivotPoints: {
    pp: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number;
  } | null;
}

function last<T>(arr: T[]): T { return arr[arr.length - 1]; }
function lastN<T>(arr: T[], n: number): T[] { return arr.slice(-n); }

function calcVWAP(candles: Candle[]): number | null {
  if (candles.length === 0) return null;
  let cumTPV = 0;
  let cumVol = 0;
  for (const c of candles) {
    const tp = (c.high + c.low + c.close) / 3;
    cumTPV += tp * c.volume;
    cumVol += c.volume;
  }
  return cumVol === 0 ? null : cumTPV / cumVol;
}

function calcSupertrend(candles: Candle[], period = 10, multiplier = 3): { signal: "BUY" | "SELL"; value: number; flip: boolean } | null {
  if (candles.length < period + 1) return null;
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);

  const atrValues = ATR.calculate({ high: highs, low: lows, close: closes, period });
  if (atrValues.length < 2) return null;

  const offset = candles.length - atrValues.length;
  const n = atrValues.length;

  const upperBands: number[] = [];
  const lowerBands: number[] = [];
  const supertrends: number[] = [];
  const signals: ("BUY" | "SELL")[] = [];

  for (let i = 0; i < n; i++) {
    const ci = i + offset;
    const hl2 = (candles[ci].high + candles[ci].low) / 2;
    const ub = hl2 + multiplier * atrValues[i];
    const lb = hl2 - multiplier * atrValues[i];
    upperBands.push(ub);
    lowerBands.push(lb);

    if (i === 0) {
      supertrends.push(closes[ci] > ub ? lb : ub);
      signals.push(closes[ci] > ub ? "BUY" : "SELL");
    } else {
      const prevST = supertrends[i - 1];
      const prevClose = closes[ci - 1];
      let st: number;

      const finalUB = (ub < upperBands[i - 1] || prevClose > upperBands[i - 1]) ? ub : upperBands[i - 1];
      const finalLB = (lb > lowerBands[i - 1] || prevClose < lowerBands[i - 1]) ? lb : lowerBands[i - 1];
      upperBands[i] = finalUB;
      lowerBands[i] = finalLB;

      if (prevST === upperBands[i - 1]) {
        st = closes[ci] <= finalUB ? finalUB : finalLB;
      } else {
        st = closes[ci] >= finalLB ? finalLB : finalUB;
      }
      supertrends.push(st);
      signals.push(closes[ci] > st ? "BUY" : "SELL");
    }
  }

  const currentSignal = signals[n - 1];
  const prevSignal = signals[n - 2];
  return {
    signal: currentSignal,
    value: supertrends[n - 1],
    flip: currentSignal !== prevSignal,
  };
}

function calcPivotPoints(candle: Candle): { pp: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number } {
  const { high: H, low: L, close: C } = candle;
  const pp = (H + L + C) / 3;
  return {
    pp,
    r1: 2 * pp - L,
    r2: pp + (H - L),
    r3: H + 2 * (pp - L),
    s1: 2 * pp - H,
    s2: pp - (H - L),
    s3: L - 2 * (H - pp),
  };
}

function detectMACDCrossover(macdArr: ReturnType<typeof MACD.calculate>): "BULLISH" | "BEARISH" | null {
  if (macdArr.length < 2) return null;
  const prev = macdArr[macdArr.length - 2];
  const curr = macdArr[macdArr.length - 1];
  if (!prev || !curr) return null;
  const prevDiff = (prev.MACD ?? 0) - (prev.signal ?? 0);
  const currDiff = (curr.MACD ?? 0) - (curr.signal ?? 0);
  if (prevDiff < 0 && currDiff > 0) return "BULLISH";
  if (prevDiff > 0 && currDiff < 0) return "BEARISH";
  return null;
}

function detectRSIDivergence(closes: number[], rsiValues: number[], lookback = 14): "BULL" | "BEAR" | null {
  if (closes.length < lookback * 2 || rsiValues.length < lookback) return null;
  const n = Math.min(lookback, rsiValues.length);
  const recentCloses = closes.slice(-n);
  const recentRSI = rsiValues.slice(-n);
  const midClose = Math.floor(n / 2);
  const closesRisingThenFalling = recentCloses[0] > recentCloses[midClose] && recentCloses[midClose] < recentCloses[n - 1];
  const rsiRisingThroughout = recentRSI[0] < recentRSI[n - 1];
  if (closesRisingThenFalling && rsiRisingThroughout) return "BULL";

  const closesFallingThenRising = recentCloses[0] < recentCloses[midClose] && recentCloses[midClose] > recentCloses[n - 1];
  const rsiFallingThroughout = recentRSI[0] > recentRSI[n - 1];
  if (closesFallingThenRising && rsiFallingThroughout) return "BEAR";

  return null;
}

export function calculateIndicators(candles: Candle[]): IndicatorResult {
  if (candles.length < 20) {
    return {
      ema9: null, ema21: null, ema50: null, ema200: null, sma20: null,
      macd: null, rsi: null, bollingerBands: null, atr: null, adx: null,
      stochastic: null, obv: null, vwap: null, cci: null, williamsR: null,
      roc: null, volumeAvg: null, volumeRatio: null, supertrend: null, pivotPoints: null,
    };
  }

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  const ema9Arr = EMA.calculate({ values: closes, period: 9 });
  const ema21Arr = EMA.calculate({ values: closes, period: 21 });
  const ema50Arr = EMA.calculate({ values: closes, period: 50 });
  const ema200Arr = EMA.calculate({ values: closes, period: 200 });
  const sma20Arr = SMA.calculate({ values: closes, period: 20 });

  const macdArr = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, SimpleMAOscillator: false, SimpleMASignal: false });
  const rsiArr = RSI.calculate({ values: closes, period: 14 });
  const bbArr = BollingerBands.calculate({ values: closes, period: 20, stdDev: 2 });
  const atrArr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const adxArr = ADX.calculate({ high: highs, low: lows, close: closes, period: 14 });

  const stochArr = candles.length >= 17
    ? Stochastic.calculate({ high: highs, low: lows, close: closes, period: 14, signalPeriod: 3 })
    : [];

  const obvArr = OBV.calculate({ close: closes, volume: volumes });
  const cciArr = CCI.calculate({ high: highs, low: lows, close: closes, period: 20 });
  const wrArr = WilliamsR.calculate({ high: highs, low: lows, close: closes, period: 14 });
  const rocArr = ROC.calculate({ values: closes, period: 12 });

  const lastMacd = last(macdArr);
  const lastBB = last(bbArr);
  const lastADX = last(adxArr);
  const lastStoch = last(stochArr);

  const prevStoch = stochArr.length > 1 ? stochArr[stochArr.length - 2] : null;
  let stochSignal: "BULLISH" | "BEARISH" | null = null;
  if (lastStoch && prevStoch) {
    if (prevStoch.k < prevStoch.d && lastStoch.k > lastStoch.d) stochSignal = "BULLISH";
    else if (prevStoch.k > prevStoch.d && lastStoch.k < lastStoch.d) stochSignal = "BEARISH";
  }

  const volAvg = volumes.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, volumes.length);
  const currentVol = last(volumes);

  const macdCrossover = detectMACDCrossover(macdArr);
  const rsiDivergence = detectRSIDivergence(closes, rsiArr);

  const vwap = calcVWAP(candles);
  const supertrend = calcSupertrend(candles);

  const squeeze = lastBB
    ? (lastBB.upper - lastBB.lower) / lastBB.middle < 0.04
    : false;

  const prevCandle = candles[candles.length - 2] ?? candles[candles.length - 1];
  const pivotPoints = calcPivotPoints(prevCandle);

  return {
    ema9: last(ema9Arr) ?? null,
    ema21: last(ema21Arr) ?? null,
    ema50: last(ema50Arr) ?? null,
    ema200: last(ema200Arr) ?? null,
    sma20: last(sma20Arr) ?? null,
    macd: lastMacd ? {
      macdLine: lastMacd.MACD ?? 0,
      signalLine: lastMacd.signal ?? 0,
      histogram: lastMacd.histogram ?? 0,
      crossover: macdCrossover,
    } : null,
    rsi: rsiArr.length > 0 ? {
      value: last(rsiArr),
      divergence: rsiDivergence,
    } : null,
    bollingerBands: lastBB ? {
      upper: lastBB.upper,
      middle: lastBB.middle,
      lower: lastBB.lower,
      squeeze,
    } : null,
    atr: last(atrArr) ?? null,
    adx: lastADX ? { adx: lastADX.adx, plusDI: lastADX.pdi, minusDI: lastADX.mdi } : null,
    stochastic: lastStoch ? { k: lastStoch.k, d: lastStoch.d, signal: stochSignal } : null,
    obv: last(obvArr) ?? null,
    vwap,
    cci: last(cciArr) ?? null,
    williamsR: last(wrArr) ?? null,
    roc: last(rocArr) ?? null,
    volumeAvg: volAvg,
    volumeRatio: volAvg > 0 ? currentVol / volAvg : null,
    supertrend,
    pivotPoints,
  };
}
