export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export function EMA(data: number[], period: number): number[] {
  const result = new Array(data.length).fill(NaN);
  const k = 2 / (period + 1);
  let started = false;
  let prev = 0;
  for (let i = 0; i < data.length; i++) {
    if (!started) {
      if (i >= period - 1) {
        let sum = 0;
        for (let j = i - period + 1; j <= i; j++) sum += data[j];
        prev = sum / period;
        result[i] = prev;
        started = true;
      }
    } else {
      prev = data[i] * k + prev * (1 - k);
      result[i] = prev;
    }
  }
  return result;
}

export function SMA(data: number[], period: number): number[] {
  const result = new Array(data.length).fill(NaN);
  for (let i = period - 1; i < data.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    result[i] = sum / period;
  }
  return result;
}

export function RSI(closes: number[], period = 14): number[] {
  const result = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  let avgG = gains / period, avgL = losses / period;
  result[period] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + Math.max(diff, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-diff, 0)) / period;
    result[i] = avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
  }
  return result;
}

export function BollingerBands(closes: number[], period = 20, stdDev = 2) {
  const mid = SMA(closes, period);
  const upper = new Array(closes.length).fill(NaN);
  const lower = new Array(closes.length).fill(NaN);
  for (let i = period - 1; i < closes.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += Math.pow(closes[j] - mid[i], 2);
    const sd = Math.sqrt(sum / period);
    upper[i] = mid[i] + stdDev * sd;
    lower[i] = mid[i] - stdDev * sd;
  }
  return { upper, middle: mid, lower };
}

export function ATR(highs: number[], lows: number[], closes: number[], period = 14): number[] {
  const tr = new Array(closes.length).fill(NaN);
  for (let i = 1; i < closes.length; i++) {
    tr[i] = Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i - 1]), Math.abs(lows[i] - closes[i - 1]));
  }
  const result = SMA(tr.slice(1), period).map(v => v);
  return [NaN, ...result];
}

export function VWAP(candles: OHLCV[]): number[] {
  const result = new Array(candles.length).fill(NaN);
  let cumVol = 0, cumTP = 0;
  for (let i = 0; i < candles.length; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    cumVol += candles[i].volume;
    cumTP += tp * candles[i].volume;
    result[i] = cumVol > 0 ? cumTP / cumVol : NaN;
  }
  return result;
}

export function computeScore(closes: number[], highs: number[], lows: number[], volumes: number[]): {
  score: number; signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL'; indicators: string[];
} {
  if (closes.length < 30) return { score: 50, signal: 'NEUTRAL', indicators: [] };
  const rsi = RSI(closes);
  const ema9 = EMA(closes, 9);
  const ema21 = EMA(closes, 21);
  const ema50 = EMA(closes, 50);
  const sma20 = SMA(volumes, 20);
  const n = closes.length - 1;

  let bullish = 0, bearish = 0;
  const indicators: string[] = [];

  const rsiVal = rsi[n];
  if (!isNaN(rsiVal)) {
    if (rsiVal < 35) { bullish++; indicators.push('RSI Oversold'); }
    else if (rsiVal > 65) { bearish++; indicators.push('RSI Overbought'); }
  }

  if (!isNaN(ema9[n]) && !isNaN(ema21[n])) {
    if (ema9[n] > ema21[n] && ema9[n - 1] <= ema21[n - 1]) { bullish += 2; indicators.push('EMA Crossover'); }
    else if (ema9[n] > ema21[n]) { bullish++; indicators.push('EMA Bullish'); }
    else if (ema9[n] < ema21[n]) { bearish++; indicators.push('EMA Bearish'); }
  }

  if (!isNaN(ema50[n])) {
    if (closes[n] > ema50[n]) bullish++; else bearish++;
  }

  const avgVol = sma20[n];
  if (!isNaN(avgVol) && volumes[n] > avgVol * 1.5) { indicators.push('Vol Surge'); bullish += 0.5; }

  const priceChange = (closes[n] - closes[n - 1]) / closes[n - 1];
  if (priceChange > 0.02) bullish++;
  else if (priceChange < -0.02) bearish++;

  const net = bullish - bearish;
  const score = Math.min(100, Math.max(0, Math.round(50 + net * 12)));
  let signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  if (score >= 75) signal = 'STRONG_BUY';
  else if (score >= 60) signal = 'BUY';
  else if (score <= 25) signal = 'STRONG_SELL';
  else if (score <= 40) signal = 'SELL';
  else signal = 'NEUTRAL';

  return { score, signal, indicators };
}
