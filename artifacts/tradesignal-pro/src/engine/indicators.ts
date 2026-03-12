// ═══════════════════════════════════════════════════════════
// TradeSignal Pro — Technical Indicator Mathematics Engine
// Every indicator calculated from raw OHLCV data
// Made with ❤️ by Shahrukh
// ═══════════════════════════════════════════════════════════

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface IndicatorResult {
  value: number;
  values?: number[];
  signal?: string;
  interpretation?: string;
}

// ═══════════════════════════════════════
// 1. SIMPLE MOVING AVERAGE (SMA)
// ═══════════════════════════════════════
export function SMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  if (data.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  result[period - 1] = sum / period;

  for (let i = period; i < data.length; i++) {
    sum = sum - data[i - period] + data[i];
    result[i] = sum / period;
  }
  return result;
}

// ═══════════════════════════════════════
// 2. EXPONENTIAL MOVING AVERAGE (EMA)
// ═══════════════════════════════════════
export function EMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  if (data.length < period) return result;

  const multiplier = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  result[period - 1] = sum / period;

  for (let i = period; i < data.length; i++) {
    result[i] = (data[i] - result[i - 1]) * multiplier + result[i - 1];
  }
  return result;
}

// ═══════════════════════════════════════
// 3. RSI — RELATIVE STRENGTH INDEX
// ═══════════════════════════════════════
export function RSI(closes: number[], period: number = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;

  const changes: number[] = [];
  for (let i = 1; i < closes.length; i++) changes.push(closes[i] - closes[i - 1]);

  const gains = changes.map(c => (c > 0 ? c : 0));
  const losses = changes.map(c => (c < 0 ? Math.abs(c) : 0));

  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    avgGain += gains[i];
    avgLoss += losses[i];
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period; i < changes.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
    result[i + 1] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

// ═══════════════════════════════════════
// 4. MACD
// ═══════════════════════════════════════
export interface MACDResult {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
}

export function MACD(
  closes: number[],
  fastPeriod: number = 12,
  slowPeriod: number = 26,
  signalPeriod: number = 9
): MACDResult {
  const fastEMA = EMA(closes, fastPeriod);
  const slowEMA = EMA(closes, slowPeriod);

  const macdLine: number[] = new Array(closes.length).fill(NaN);
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(fastEMA[i]) && !isNaN(slowEMA[i])) {
      macdLine[i] = fastEMA[i] - slowEMA[i];
    }
  }

  const validMacd = macdLine.filter(v => !isNaN(v));
  const signalEMA = EMA(validMacd, signalPeriod);

  const signalLine: number[] = new Array(closes.length).fill(NaN);
  let validIdx = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(macdLine[i])) {
      if (validIdx < signalEMA.length) signalLine[i] = signalEMA[validIdx];
      validIdx++;
    }
  }

  const histogram: number[] = new Array(closes.length).fill(NaN);
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(macdLine[i]) && !isNaN(signalLine[i])) {
      histogram[i] = macdLine[i] - signalLine[i];
    }
  }

  return { macdLine, signalLine, histogram };
}

// ═══════════════════════════════════════
// 5. BOLLINGER BANDS
// ═══════════════════════════════════════
export interface BollingerResult {
  upper: number[];
  middle: number[];
  lower: number[];
  bandwidth: number[];
  percentB: number[];
}

export function BollingerBands(
  closes: number[],
  period: number = 20,
  stdDevMultiplier: number = 2
): BollingerResult {
  const middle = SMA(closes, period);
  const upper: number[] = new Array(closes.length).fill(NaN);
  const lower: number[] = new Array(closes.length).fill(NaN);
  const bandwidth: number[] = new Array(closes.length).fill(NaN);
  const percentB: number[] = new Array(closes.length).fill(NaN);

  for (let i = period - 1; i < closes.length; i++) {
    const window = closes.slice(i - period + 1, i + 1);
    const mean = middle[i];
    if (isNaN(mean)) continue;

    let sumSq = 0;
    for (const val of window) sumSq += (val - mean) ** 2;
    const stdDev = Math.sqrt(sumSq / period);

    upper[i] = mean + stdDevMultiplier * stdDev;
    lower[i] = mean - stdDevMultiplier * stdDev;
    bandwidth[i] = ((upper[i] - lower[i]) / mean) * 100;
    if (upper[i] !== lower[i]) {
      percentB[i] = (closes[i] - lower[i]) / (upper[i] - lower[i]);
    }
  }
  return { upper, middle, lower, bandwidth, percentB };
}

// ═══════════════════════════════════════
// 6. STOCHASTIC OSCILLATOR
// ═══════════════════════════════════════
export interface StochasticResult {
  k: number[];
  d: number[];
}

export function Stochastic(
  highs: number[],
  lows: number[],
  closes: number[],
  kPeriod: number = 14,
  dPeriod: number = 3,
  smooth: number = 3
): StochasticResult {
  const rawK: number[] = new Array(closes.length).fill(NaN);

  for (let i = kPeriod - 1; i < closes.length; i++) {
    let highestHigh = -Infinity, lowestLow = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (highs[j] > highestHigh) highestHigh = highs[j];
      if (lows[j] < lowestLow) lowestLow = lows[j];
    }
    const range = highestHigh - lowestLow;
    rawK[i] = range === 0 ? 50 : ((closes[i] - lowestLow) / range) * 100;
  }

  const validRawK = rawK.filter(v => !isNaN(v));
  let k: number[];
  if (smooth > 1) {
    const smoothedK = SMA(validRawK, smooth);
    k = new Array(closes.length).fill(NaN);
    let idx = 0;
    for (let i = 0; i < closes.length; i++) {
      if (!isNaN(rawK[i])) {
        if (idx < smoothedK.length && !isNaN(smoothedK[idx])) k[i] = smoothedK[idx];
        idx++;
      }
    }
  } else {
    k = [...rawK];
  }

  const validK = k.filter(v => !isNaN(v));
  const smaD = SMA(validK, dPeriod);
  const d: number[] = new Array(closes.length).fill(NaN);
  let dIdx = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(k[i])) {
      if (dIdx < smaD.length && !isNaN(smaD[dIdx])) d[i] = smaD[dIdx];
      dIdx++;
    }
  }
  return { k, d };
}

// ═══════════════════════════════════════
// 7. ATR — AVERAGE TRUE RANGE
// ═══════════════════════════════════════
export function ATR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;

  const trueRanges: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < closes.length; i++) {
    trueRanges.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }

  let atr = 0;
  for (let i = 0; i < period; i++) atr += trueRanges[i];
  atr /= period;
  result[period - 1] = atr;

  for (let i = period; i < closes.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    result[i] = atr;
  }
  return result;
}

// ═══════════════════════════════════════
// 8. SUPERTREND
// ═══════════════════════════════════════
export interface SupertrendResult {
  value: number[];
  signal: string[];
  direction: number[];
}

export function Supertrend(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 10,
  multiplier: number = 3
): SupertrendResult {
  const atrValues = ATR(highs, lows, closes, period);
  const len = closes.length;
  const value: number[] = new Array(len).fill(NaN);
  const signal: string[] = new Array(len).fill('NEUTRAL');
  const direction: number[] = new Array(len).fill(0);
  const finalUpperBand: number[] = new Array(len).fill(0);
  const finalLowerBand: number[] = new Array(len).fill(0);

  for (let i = period - 1; i < len; i++) {
    if (isNaN(atrValues[i])) continue;
    const hl2 = (highs[i] + lows[i]) / 2;
    const basicUpper = hl2 + multiplier * atrValues[i];
    const basicLower = hl2 - multiplier * atrValues[i];

    if (i === period - 1) {
      finalUpperBand[i] = basicUpper;
      finalLowerBand[i] = basicLower;
    } else {
      finalUpperBand[i] = (basicUpper < finalUpperBand[i - 1] || closes[i - 1] > finalUpperBand[i - 1])
        ? basicUpper : finalUpperBand[i - 1];
      finalLowerBand[i] = (basicLower > finalLowerBand[i - 1] || closes[i - 1] < finalLowerBand[i - 1])
        ? basicLower : finalLowerBand[i - 1];
    }

    if (i === period - 1) {
      direction[i] = closes[i] > finalUpperBand[i] ? 1 : -1;
    } else {
      if (value[i - 1] === finalUpperBand[i - 1]) {
        direction[i] = closes[i] > finalUpperBand[i] ? 1 : -1;
      } else {
        direction[i] = closes[i] < finalLowerBand[i] ? -1 : 1;
      }
    }
    value[i] = direction[i] === 1 ? finalLowerBand[i] : finalUpperBand[i];
    signal[i] = direction[i] === 1 ? 'BUY' : 'SELL';
  }
  return { value, signal, direction };
}

// ═══════════════════════════════════════
// 9. ADX — AVERAGE DIRECTIONAL INDEX
// ═══════════════════════════════════════
export interface ADXResult {
  adx: number[];
  plusDI: number[];
  minusDI: number[];
  dx: number[];
}

export function ADX(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): ADXResult {
  const len = closes.length;
  const adx: number[] = new Array(len).fill(NaN);
  const plusDI: number[] = new Array(len).fill(NaN);
  const minusDI: number[] = new Array(len).fill(NaN);
  const dx: number[] = new Array(len).fill(NaN);
  if (len < period * 2) return { adx, plusDI, minusDI, dx };

  const plusDM: number[] = [], minusDM: number[] = [], trueRanges: number[] = [];
  for (let i = 1; i < len; i++) {
    const upMove = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
    trueRanges.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1])
    ));
  }

  let smoothPlusDM = 0, smoothMinusDM = 0, smoothTR = 0;
  for (let i = 0; i < period; i++) {
    smoothPlusDM += plusDM[i];
    smoothMinusDM += minusDM[i];
    smoothTR += trueRanges[i];
  }

  let pdi = smoothTR === 0 ? 0 : (smoothPlusDM / smoothTR) * 100;
  let mdi = smoothTR === 0 ? 0 : (smoothMinusDM / smoothTR) * 100;
  plusDI[period] = pdi;
  minusDI[period] = mdi;
  const diSum = pdi + mdi;
  dx[period] = diSum === 0 ? 0 : (Math.abs(pdi - mdi) / diSum) * 100;

  const dxValues: number[] = [dx[period]];
  for (let i = period; i < plusDM.length; i++) {
    smoothPlusDM = smoothPlusDM - smoothPlusDM / period + plusDM[i];
    smoothMinusDM = smoothMinusDM - smoothMinusDM / period + minusDM[i];
    smoothTR = smoothTR - smoothTR / period + trueRanges[i];
    pdi = smoothTR === 0 ? 0 : (smoothPlusDM / smoothTR) * 100;
    mdi = smoothTR === 0 ? 0 : (smoothMinusDM / smoothTR) * 100;
    plusDI[i + 1] = pdi;
    minusDI[i + 1] = mdi;
    const sum = pdi + mdi;
    const dxVal = sum === 0 ? 0 : (Math.abs(pdi - mdi) / sum) * 100;
    dx[i + 1] = dxVal;
    dxValues.push(dxVal);
  }

  if (dxValues.length >= period) {
    let adxSum = 0;
    for (let i = 0; i < period; i++) adxSum += dxValues[i];
    let adxVal = adxSum / period;
    const startIdx = period + period;
    if (startIdx < len) adx[startIdx] = adxVal;
    for (let i = period; i < dxValues.length; i++) {
      adxVal = (adxVal * (period - 1) + dxValues[i]) / period;
      const fullIdx = i + period + 1;
      if (fullIdx < len) adx[fullIdx] = adxVal;
    }
  }
  return { adx, plusDI, minusDI, dx };
}

// ═══════════════════════════════════════
// 10. VWAP
// ═══════════════════════════════════════
export function VWAP(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[]
): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  let cumulativeTPV = 0, cumulativeVol = 0;
  for (let i = 0; i < closes.length; i++) {
    const tp = (highs[i] + lows[i] + closes[i]) / 3;
    cumulativeTPV += tp * volumes[i];
    cumulativeVol += volumes[i];
    result[i] = cumulativeVol === 0 ? tp : cumulativeTPV / cumulativeVol;
  }
  return result;
}

// ═══════════════════════════════════════
// 11. OBV — ON BALANCE VOLUME
// ═══════════════════════════════════════
export function OBV(closes: number[], volumes: number[]): number[] {
  const result: number[] = new Array(closes.length).fill(0);
  result[0] = volumes[0];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) result[i] = result[i - 1] + volumes[i];
    else if (closes[i] < closes[i - 1]) result[i] = result[i - 1] - volumes[i];
    else result[i] = result[i - 1];
  }
  return result;
}

// ═══════════════════════════════════════
// 12. CCI — COMMODITY CHANNEL INDEX
// ═══════════════════════════════════════
export function CCI(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 20
): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  for (let i = period - 1; i < closes.length; i++) {
    let tpSum = 0;
    for (let j = i - period + 1; j <= i; j++) tpSum += tp[j];
    const tpSMA = tpSum / period;
    let mdSum = 0;
    for (let j = i - period + 1; j <= i; j++) mdSum += Math.abs(tp[j] - tpSMA);
    const meanDev = mdSum / period;
    result[i] = meanDev === 0 ? 0 : (tp[i] - tpSMA) / (0.015 * meanDev);
  }
  return result;
}

// ═══════════════════════════════════════
// 13. WILLIAMS %R
// ═══════════════════════════════════════
export function WilliamsR(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number = 14
): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let highestHigh = -Infinity, lowestLow = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      if (highs[j] > highestHigh) highestHigh = highs[j];
      if (lows[j] < lowestLow) lowestLow = lows[j];
    }
    const range = highestHigh - lowestLow;
    result[i] = range === 0 ? -50 : ((highestHigh - closes[i]) / range) * -100;
  }
  return result;
}

// ═══════════════════════════════════════
// 14. MFI — MONEY FLOW INDEX
// ═══════════════════════════════════════
export function MFI(
  highs: number[],
  lows: number[],
  closes: number[],
  volumes: number[],
  period: number = 14
): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const rawMF = tp.map((t, i) => t * volumes[i]);

  for (let i = period; i < closes.length; i++) {
    let posMF = 0, negMF = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (tp[j] > tp[j - 1]) posMF += rawMF[j];
      else if (tp[j] < tp[j - 1]) negMF += rawMF[j];
    }
    result[i] = negMF === 0 ? 100 : 100 - 100 / (1 + posMF / negMF);
  }
  return result;
}

// ═══════════════════════════════════════
// 15. PARABOLIC SAR
// ═══════════════════════════════════════
export interface ParabolicSARResult {
  value: number[];
  signal: string[];
}

export function ParabolicSAR(
  highs: number[],
  lows: number[],
  closes: number[],
  step: number = 0.02,
  max: number = 0.2
): ParabolicSARResult {
  const len = closes.length;
  const value: number[] = new Array(len).fill(NaN);
  const signal: string[] = new Array(len).fill('NEUTRAL');
  if (len < 2) return { value, signal };

  let isUpTrend = closes[1] > closes[0];
  let af = step;
  let ep = isUpTrend ? highs[0] : lows[0];
  let sar = isUpTrend ? lows[0] : highs[0];
  value[0] = sar;
  signal[0] = isUpTrend ? 'BUY' : 'SELL';

  for (let i = 1; i < len; i++) {
    let newSar = sar + af * (ep - sar);
    if (isUpTrend) {
      if (i >= 2) newSar = Math.min(newSar, lows[i - 1], lows[i - 2]);
      else newSar = Math.min(newSar, lows[i - 1]);
      if (newSar > lows[i]) {
        isUpTrend = false; newSar = ep; af = step; ep = lows[i];
      } else {
        if (highs[i] > ep) { ep = highs[i]; af = Math.min(af + step, max); }
      }
    } else {
      if (i >= 2) newSar = Math.max(newSar, highs[i - 1], highs[i - 2]);
      else newSar = Math.max(newSar, highs[i - 1]);
      if (newSar < highs[i]) {
        isUpTrend = true; newSar = ep; af = step; ep = highs[i];
      } else {
        if (lows[i] < ep) { ep = lows[i]; af = Math.min(af + step, max); }
      }
    }
    sar = newSar;
    value[i] = sar;
    signal[i] = isUpTrend ? 'BUY' : 'SELL';
  }
  return { value, signal };
}

// ═══════════════════════════════════════
// 16. PIVOT POINTS
// ═══════════════════════════════════════
export interface PivotPoints {
  pivot: number; r1: number; r2: number; r3: number;
  s1: number; s2: number; s3: number;
}

export function calculatePivotPoints(high: number, low: number, close: number): PivotPoints {
  const pivot = (high + low + close) / 3;
  const range = high - low;
  return {
    pivot: Math.round(pivot * 100) / 100,
    r1: Math.round((2 * pivot - low) * 100) / 100,
    r2: Math.round((pivot + range) * 100) / 100,
    r3: Math.round((high + 2 * (pivot - low)) * 100) / 100,
    s1: Math.round((2 * pivot - high) * 100) / 100,
    s2: Math.round((pivot - range) * 100) / 100,
    s3: Math.round((low - 2 * (high - pivot)) * 100) / 100,
  };
}

// ═══════════════════════════════════════
// 17. SUPPORT & RESISTANCE DETECTION
// ═══════════════════════════════════════
export function findSupportResistance(
  candles: OHLCV[],
  lookback: number = 50,
  sensitivity: number = 3,
  clusterPercent: number = 0.005
): { supports: number[]; resistances: number[] } {
  const start = Math.max(0, candles.length - lookback);
  const relevantCandles = candles.slice(start);
  const currentPrice = relevantCandles[relevantCandles.length - 1].close;

  const swingHighs: number[] = [], swingLows: number[] = [];
  for (let i = sensitivity; i < relevantCandles.length - sensitivity; i++) {
    let isSwingHigh = true, isSwingLow = true;
    for (let j = 1; j <= sensitivity; j++) {
      if (relevantCandles[i].high <= relevantCandles[i - j].high || relevantCandles[i].high <= relevantCandles[i + j].high) isSwingHigh = false;
      if (relevantCandles[i].low >= relevantCandles[i - j].low || relevantCandles[i].low >= relevantCandles[i + j].low) isSwingLow = false;
    }
    if (isSwingHigh) swingHighs.push(relevantCandles[i].high);
    if (isSwingLow) swingLows.push(relevantCandles[i].low);
  }

  function clusterLevels(levels: number[]): number[] {
    if (levels.length === 0) return [];
    levels.sort((a, b) => a - b);
    const clusters: number[][] = [[levels[0]]];
    for (let i = 1; i < levels.length; i++) {
      const last = clusters[clusters.length - 1];
      const lastAvg = last.reduce((a, b) => a + b) / last.length;
      if (Math.abs(levels[i] - lastAvg) / lastAvg < clusterPercent) last.push(levels[i]);
      else clusters.push([levels[i]]);
    }
    return clusters
      .filter(c => c.length >= 2)
      .sort((a, b) => b.length - a.length)
      .map(c => Math.round((c.reduce((a, b) => a + b) / c.length) * 100) / 100)
      .slice(0, 5);
  }

  const clustered = clusterLevels([...swingHighs, ...swingLows]);
  let supports = clustered.filter(l => l < currentPrice).sort((a, b) => b - a).slice(0, 3);
  let resistances = clustered.filter(l => l > currentPrice).sort((a, b) => a - b).slice(0, 3);

  if (supports.length < 2) {
    const recentLows = relevantCandles.map(c => c.low).sort((a, b) => a - b);
    while (supports.length < 3 && recentLows.length > 0) {
      const low = recentLows.shift()!;
      if (low < currentPrice && !supports.some(s => Math.abs(s - low) / low < 0.005)) supports.push(Math.round(low * 100) / 100);
    }
  }
  if (resistances.length < 2) {
    const recentHighs = relevantCandles.map(c => c.high).sort((a, b) => b - a);
    while (resistances.length < 3 && recentHighs.length > 0) {
      const high = recentHighs.shift()!;
      if (high > currentPrice && !resistances.some(r => Math.abs(r - high) / high < 0.005)) resistances.push(Math.round(high * 100) / 100);
    }
  }
  return {
    supports: supports.sort((a, b) => b - a).slice(0, 3),
    resistances: resistances.sort((a, b) => a - b).slice(0, 3),
  };
}

// ═══════════════════════════════════════
// 18. RSI DIVERGENCE DETECTION
// ═══════════════════════════════════════
export interface DivergenceResult {
  bullishDivergence: boolean;
  bearishDivergence: boolean;
  description: string;
}

export function detectRSIDivergence(
  closes: number[],
  rsiValues: number[],
  lookback: number = 20
): DivergenceResult {
  const result: DivergenceResult = { bullishDivergence: false, bearishDivergence: false, description: '' };
  const len = closes.length;
  if (len < lookback + 5) return result;

  let priceLow1 = Infinity, priceLow2 = Infinity;
  let rsiLow1 = Infinity, rsiLow2 = Infinity;
  let priceHigh1 = -Infinity, priceHigh2 = -Infinity;
  let rsiHigh1 = -Infinity, rsiHigh2 = -Infinity;

  for (let i = len - 5; i < len; i++) {
    if (closes[i] < priceLow1) { priceLow1 = closes[i]; rsiLow1 = rsiValues[i] || 50; }
    if (closes[i] > priceHigh1) { priceHigh1 = closes[i]; rsiHigh1 = rsiValues[i] || 50; }
  }
  for (let i = len - lookback; i < len - 5; i++) {
    if (closes[i] < priceLow2) { priceLow2 = closes[i]; rsiLow2 = rsiValues[i] || 50; }
    if (closes[i] > priceHigh2) { priceHigh2 = closes[i]; rsiHigh2 = rsiValues[i] || 50; }
  }

  if (priceLow1 < priceLow2 && rsiLow1 > rsiLow2 && !isNaN(rsiLow1) && !isNaN(rsiLow2)) {
    result.bullishDivergence = true;
    result.description = `Bullish RSI Divergence: Price made lower low (₹${priceLow1.toFixed(2)} vs ₹${priceLow2.toFixed(2)}) but RSI made higher low (${rsiLow1.toFixed(1)} vs ${rsiLow2.toFixed(1)}). Reversal UP likely.`;
  }
  if (priceHigh1 > priceHigh2 && rsiHigh1 < rsiHigh2 && !isNaN(rsiHigh1) && !isNaN(rsiHigh2)) {
    result.bearishDivergence = true;
    result.description = `Bearish RSI Divergence: Price made higher high (₹${priceHigh1.toFixed(2)} vs ₹${priceHigh2.toFixed(2)}) but RSI made lower high (${rsiHigh1.toFixed(1)} vs ${rsiHigh2.toFixed(1)}). Reversal DOWN likely.`;
  }
  return result;
}

// ═══════════════════════════════════════
// 19. VOLUME ANALYSIS
// ═══════════════════════════════════════
export interface VolumeAnalysis {
  currentVolume: number;
  averageVolume: number;
  volumeRatio: number;
  isVolumeSpike: boolean;
  isHighVolume: boolean;
  isLowVolume: boolean;
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  buyingVolume: number;
  sellingVolume: number;
  description: string;
}

export function analyzeVolume(candles: OHLCV[], period: number = 20): VolumeAnalysis {
  const len = candles.length;
  const currentVolume = candles[len - 1].volume;
  let avgVol = 0;
  const start = Math.max(0, len - period);
  for (let i = start; i < len; i++) avgVol += candles[i].volume;
  avgVol /= (len - start);
  const ratio = avgVol > 0 ? currentVolume / avgVol : 1;

  let recent5Vol = 0, prev5Vol = 0;
  for (let i = len - 5; i < len; i++) recent5Vol += candles[i].volume;
  for (let i = len - 10; i < len - 5; i++) { if (i >= 0) prev5Vol += candles[i].volume; }
  recent5Vol /= 5;
  prev5Vol /= 5;

  let volumeTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (prev5Vol > 0) {
    const tr = recent5Vol / prev5Vol;
    if (tr > 1.2) volumeTrend = 'increasing';
    else if (tr < 0.8) volumeTrend = 'decreasing';
  }

  let buyVol = 0, sellVol = 0;
  for (let i = Math.max(0, len - 10); i < len; i++) {
    if (candles[i].close > candles[i].open) buyVol += candles[i].volume;
    else sellVol += candles[i].volume;
  }

  let description = '';
  if (ratio > 2) description = `Volume spike ${ratio.toFixed(1)}x above average — Very strong interest`;
  else if (ratio > 1.5) description = `Above average volume (${ratio.toFixed(1)}x) — Confirms price movement`;
  else if (ratio < 0.5) description = `Low volume (${ratio.toFixed(1)}x average) — Weak conviction, move may not sustain`;
  else description = `Normal volume (${ratio.toFixed(1)}x average)`;
  if (buyVol > sellVol * 1.5) description += '. Buying pressure dominant.';
  else if (sellVol > buyVol * 1.5) description += '. Selling pressure dominant.';

  return {
    currentVolume, averageVolume: Math.round(avgVol),
    volumeRatio: Math.round(ratio * 100) / 100,
    isVolumeSpike: ratio > 2, isHighVolume: ratio > 1.5, isLowVolume: ratio < 0.5,
    volumeTrend, buyingVolume: buyVol, sellingVolume: sellVol, description,
  };
}

// ═══════════════════════════════════════
// 20. SWING HIGH / SWING LOW DETECTION
// ═══════════════════════════════════════
export function findSwingLow(candles: OHLCV[], lookback: number = 20): number {
  const start = Math.max(0, candles.length - lookback);
  let lowest = Infinity;
  for (let i = start; i < candles.length; i++) {
    if (candles[i].low < lowest) lowest = candles[i].low;
  }
  return lowest;
}

export function findSwingHigh(candles: OHLCV[], lookback: number = 20): number {
  const start = Math.max(0, candles.length - lookback);
  let highest = -Infinity;
  for (let i = start; i < candles.length; i++) {
    if (candles[i].high > highest) highest = candles[i].high;
  }
  return highest;
}
