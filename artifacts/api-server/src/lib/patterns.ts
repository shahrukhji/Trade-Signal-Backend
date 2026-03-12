import type { Candle } from "./broker-adapter.js";

export interface PatternResult {
  candlestick: string[];
  chart: string[];
}

function body(c: Candle): number { return Math.abs(c.close - c.open); }
function range(c: Candle): number { return c.high - c.low; }
function isBull(c: Candle): boolean { return c.close > c.open; }
function isBear(c: Candle): boolean { return c.close < c.open; }
function upperShadow(c: Candle): number { return c.high - Math.max(c.open, c.close); }
function lowerShadow(c: Candle): number { return Math.min(c.open, c.close) - c.low; }

export function detectCandlestickPatterns(candles: Candle[]): string[] {
  const patterns: string[] = [];
  if (candles.length < 5) return patterns;

  const n = candles.length;
  const c = candles[n - 1];
  const c1 = candles[n - 2];
  const c2 = candles[n - 3];

  const bodyC = body(c);
  const rangeC = range(c);
  const upperC = upperShadow(c);
  const lowerC = lowerShadow(c);

  if (rangeC > 0) {
    if (bodyC / rangeC < 0.1) {
      patterns.push("Doji");
      if (lowerC > bodyC * 2 && upperC < bodyC) patterns.push("DragonflyDoji");
      if (upperC > bodyC * 2 && lowerC < bodyC) patterns.push("GravestoneDoji");
    }
    if (bodyC / rangeC < 0.3) patterns.push("SpinningTop");
  }

  if (isBull(c) && lowerC >= bodyC * 2 && upperC <= bodyC * 0.5 && c.close > c1.close) {
    patterns.push("Hammer");
  }

  if (isBear(c) && lowerC >= bodyC * 2 && upperC <= bodyC * 0.5) {
    patterns.push("HangingMan");
  }

  if (upperC >= bodyC * 2 && lowerC <= bodyC * 0.5 && isBull(c)) {
    patterns.push("InvertedHammer");
  }

  if (upperC >= bodyC * 2 && lowerC <= bodyC * 0.5 && isBear(c)) {
    patterns.push("ShootingStar");
  }

  if (isBull(c) && bodyC / rangeC > 0.85) patterns.push("BullMarubozu");
  if (isBear(c) && bodyC / rangeC > 0.85) patterns.push("BearMarubozu");

  if (isBear(c1) && isBull(c) && c.open < c1.close && c.close > c1.open) {
    patterns.push("BullEngulfing");
  }
  if (isBull(c1) && isBear(c) && c.open > c1.close && c.close < c1.open) {
    patterns.push("BearEngulfing");
  }

  if (isBull(c1) && isBear(c) && c.open < c1.close && c.close > c1.open) {
    patterns.push("BullHarami");
  }
  if (isBear(c1) && isBull(c) && c.open > c1.close && c.close < c1.open) {
    patterns.push("BearHarami");
  }

  if (
    isBear(c2) && body(c2) > range(c2) * 0.6 &&
    Math.abs(c1.close - c1.open) < body(c2) * 0.3 &&
    isBull(c) && c.close > (c2.open + c2.close) / 2
  ) {
    patterns.push("MorningStar");
  }

  if (
    isBull(c2) && body(c2) > range(c2) * 0.6 &&
    Math.abs(c1.close - c1.open) < body(c2) * 0.3 &&
    isBear(c) && c.close < (c2.open + c2.close) / 2
  ) {
    patterns.push("EveningStar");
  }

  const last3 = [candles[n - 3], candles[n - 2], c];
  if (last3.every(x => isBull(x)) && last3.every((x, i) => i === 0 || x.close > last3[i - 1].close)) {
    patterns.push("ThreeWhiteSoldiers");
  }
  if (last3.every(x => isBear(x)) && last3.every((x, i) => i === 0 || x.close < last3[i - 1].close)) {
    patterns.push("ThreeBlackCrows");
  }

  if (
    isBear(c1) && isBull(c) &&
    c.open > c1.low && c.open < (c1.open + c1.close) / 2 &&
    c.close > (c1.open + c1.close) / 2 && c.close < c1.open
  ) {
    patterns.push("PiercingLine");
  }

  if (
    isBull(c1) && isBear(c) &&
    c.open < c1.high && c.open > (c1.open + c1.close) / 2 &&
    c.close < (c1.open + c1.close) / 2 && c.close > c1.open
  ) {
    patterns.push("DarkCloud");
  }

  const tweezerBottom =
    Math.abs(c.low - c1.low) < rangeC * 0.02 &&
    isBear(c1) && isBull(c);
  if (tweezerBottom) patterns.push("TweezerBottom");

  const tweezerTop =
    Math.abs(c.high - c1.high) < rangeC * 0.02 &&
    isBull(c1) && isBear(c);
  if (tweezerTop) patterns.push("TweezerTop");

  return patterns;
}

export function detectChartPatterns(candles: Candle[]): string[] {
  const patterns: string[] = [];
  if (candles.length < 20) return patterns;

  const n = candles.length;
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const closes = candles.map(c => c.close);

  function findLocalMax(arr: number[], lookback: number): { idx: number; val: number }[] {
    const result: { idx: number; val: number }[] = [];
    for (let i = lookback; i < arr.length - lookback; i++) {
      const slice = arr.slice(i - lookback, i + lookback + 1);
      if (arr[i] === Math.max(...slice)) result.push({ idx: i, val: arr[i] });
    }
    return result;
  }

  function findLocalMin(arr: number[], lookback: number): { idx: number; val: number }[] {
    const result: { idx: number; val: number }[] = [];
    for (let i = lookback; i < arr.length - lookback; i++) {
      const slice = arr.slice(i - lookback, i + lookback + 1);
      if (arr[i] === Math.min(...slice)) result.push({ idx: i, val: arr[i] });
    }
    return result;
  }

  const peaks = findLocalMax(highs, 5);
  const troughs = findLocalMin(lows, 5);

  if (peaks.length >= 2) {
    const p1 = peaks[peaks.length - 2];
    const p2 = peaks[peaks.length - 1];
    const diffPct = Math.abs(p1.val - p2.val) / p1.val;
    if (diffPct < 0.03 && p2.idx > p1.idx) {
      patterns.push("DoubleTop");
    }
  }

  if (troughs.length >= 2) {
    const t1 = troughs[troughs.length - 2];
    const t2 = troughs[troughs.length - 1];
    const diffPct = Math.abs(t1.val - t2.val) / t1.val;
    if (diffPct < 0.03 && t2.idx > t1.idx) {
      patterns.push("DoubleBottom");
    }
  }

  if (peaks.length >= 3 && troughs.length >= 2) {
    const [p1, p2, p3] = peaks.slice(-3);
    const [t1, t2] = troughs.slice(-2);
    if (
      p1 && p2 && p3 && t1 && t2 &&
      p2.val > p1.val && p2.val > p3.val &&
      Math.abs(t1.val - t2.val) / t1.val < 0.03 &&
      p1.idx < t1.idx && t1.idx < p2.idx && p2.idx < t2.idx && t2.idx < p3.idx
    ) {
      patterns.push("HeadAndShoulders");
    }
  }

  if (peaks.length >= 3 && troughs.length >= 2) {
    const recentPeaks = peaks.slice(-3);
    const recentTroughs = troughs.slice(-2);
    const [p1, p2, p3] = recentPeaks;
    const [t1, t2] = recentTroughs;
    if (
      p1 && p2 && p3 && t1 && t2 &&
      p2.val < p1.val && p2.val < p3.val &&
      Math.abs(t1.val - t2.val) / t1.val < 0.03
    ) {
      patterns.push("InverseHeadAndShoulders");
    }
  }

  const recentHighs = highs.slice(-20);
  const recentLows = lows.slice(-20);
  const highSlope = (recentHighs[19] - recentHighs[0]) / 20;
  const lowSlope = (recentLows[19] - recentLows[0]) / 20;

  if (highSlope > 0 && lowSlope > 0 && highSlope > lowSlope * 1.5) {
    patterns.push("RisingWedge");
  }
  if (highSlope < 0 && lowSlope < 0 && Math.abs(lowSlope) > Math.abs(highSlope) * 1.5) {
    patterns.push("FallingWedge");
  }
  if (highSlope > 0 && Math.abs(lowSlope) < highSlope * 0.2) {
    patterns.push("AscendingTriangle");
  }
  if (lowSlope < 0 && Math.abs(highSlope) < Math.abs(lowSlope) * 0.2) {
    patterns.push("DescendingTriangle");
  }
  if (highSlope < 0 && lowSlope > 0) {
    patterns.push("SymmetricalTriangle");
  }

  if (peaks.length >= 2 && troughs.length >= 2) {
    const lastPeak = peaks[peaks.length - 1];
    const prevPeak = peaks[peaks.length - 2];
    if (lastPeak && prevPeak && lastPeak.val > prevPeak.val && closes[n - 1] > lastPeak.val * 0.98) {
      if (highSlope > 0 && lowSlope > 0) patterns.push("ChannelUp");
    }
    if (lastPeak && prevPeak && lastPeak.val < prevPeak.val) {
      if (highSlope < 0 && lowSlope < 0) patterns.push("ChannelDown");
    }
  }

  const midHigh = Math.max(...highs.slice(n - 10, n - 5));
  const currentClose = closes[n - 1];
  if (currentClose > midHigh * 1.02) {
    const minInBase = Math.min(...lows.slice(n - 20, n - 10));
    const maxInBase = Math.max(...highs.slice(n - 20, n - 10));
    if ((maxInBase - minInBase) / minInBase < 0.1) {
      patterns.push("Rectangle");
    }
  }

  return patterns;
}

export function detectPatterns(candles: Candle[]): PatternResult {
  return {
    candlestick: detectCandlestickPatterns(candles),
    chart: detectChartPatterns(candles),
  };
}
