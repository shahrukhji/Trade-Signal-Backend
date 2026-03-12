// ═══════════════════════════════════════════════════════════
// TradeSignal Pro — CORE SIGNAL GENERATION ENGINE
// Multi-Indicator Confluence Scoring System
// Made with ❤️ by Shahrukh
// ═══════════════════════════════════════════════════════════

import {
  OHLCV, SMA, EMA, RSI, MACD, BollingerBands, Stochastic, ATR,
  Supertrend, ADX, VWAP, OBV, CCI, WilliamsR, MFI, ParabolicSAR,
  calculatePivotPoints, findSupportResistance, detectRSIDivergence,
  analyzeVolume, findSwingLow, findSwingHigh,
} from './indicators';

import { detectAllPatterns, DetectedPattern } from './patterns';

// ═══════════════════════════════════════
// SIGNAL OUTPUT TYPES
// ═══════════════════════════════════════

export type SignalType = 'STRONG_BUY' | 'BUY' | 'WEAK_BUY' | 'NEUTRAL' | 'WEAK_SELL' | 'SELL' | 'STRONG_SELL';

export interface SignalReason {
  indicator: string;
  value: string;
  interpretation: string;
  type: 'bullish' | 'bearish' | 'neutral';
  score: number;
  icon: string;
}

export interface TradeSetup {
  entry: number;
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  riskPerShare: number;
  rewardPerShare: number;
  riskRewardRatio: number;
  positionSizeForRisk: (capitalRiskAmount: number) => number;
}

export interface AllIndicatorValues {
  rsi: number;
  macd: { line: number; signal: number; histogram: number; crossover: string };
  ema9: number; ema21: number; ema50: number; ema200: number;
  sma20: number; sma50: number; sma200: number;
  supertrend: { signal: string; value: number };
  bollinger: { upper: number; middle: number; lower: number; percentB: number; bandwidth: number };
  stochastic: { k: number; d: number };
  adx: { adx: number; plusDI: number; minusDI: number };
  atr: number; vwap: number; obv: number; cci: number; williamsR: number; mfi: number;
  parabolicSar: { value: number; signal: string };
  volume: { current: number; average: number; ratio: number; trend: string };
  pivots: { pivot: number; r1: number; r2: number; r3: number; s1: number; s2: number; s3: number };
  supports: number[];
  resistances: number[];
}

export interface LiveSignal {
  id: string;
  symbol: string;
  stockName: string;
  exchange: string;
  timeframe: string;
  timestamp: number;
  signal: SignalType;
  signalEmoji: string;
  score: number;
  maxPossibleScore: number;
  confidence: number;
  currentPrice: number;
  tradeSetup: TradeSetup;
  reasons: SignalReason[];
  bullishReasons: SignalReason[];
  bearishReasons: SignalReason[];
  neutralReasons: SignalReason[];
  detectedPatterns: DetectedPattern[];
  candlePatterns: DetectedPattern[];
  chartPatterns: DetectedPattern[];
  indicators: AllIndicatorValues;
  volumeAnalysis: string;
  rsiDivergence: string;
  trendDirection: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  trendStrength: 'STRONG' | 'MODERATE' | 'WEAK';
  summary: string;
  status: 'active' | 'target_hit' | 'sl_hit' | 'expired';
}

// ═══════════════════════════════════════
// MAIN SIGNAL GENERATOR
// ═══════════════════════════════════════

export function generateLiveSignal(
  candles: OHLCV[],
  symbol: string,
  stockName: string,
  exchange: string = 'NSE',
  timeframe: string = '15m'
): LiveSignal {
  const len = candles.length;
  const currentCandle = candles[len - 1];
  const currentPrice = currentCandle.close;

  const closes = candles.map(c => c.close);
  const highs = candles.map(c => c.high);
  const lows = candles.map(c => c.low);
  const volumes = candles.map(c => c.volume);

  // ═══════════════════════════════════════
  // STEP 1: CALCULATE ALL INDICATORS
  // ═══════════════════════════════════════

  const ema9Values = EMA(closes, 9);
  const ema21Values = EMA(closes, 21);
  const ema50Values = EMA(closes, 50);
  const ema200Values = EMA(closes, 200);
  const sma20Values = SMA(closes, 20);
  const sma50Values = SMA(closes, 50);
  const sma200Values = SMA(closes, 200);
  const rsiValues = RSI(closes, 14);
  const macdResult = MACD(closes, 12, 26, 9);
  const bbResult = BollingerBands(closes, 20, 2);
  const stochResult = Stochastic(highs, lows, closes, 14, 3, 3);
  const atrValues = ATR(highs, lows, closes, 14);
  const supertrendResult = Supertrend(highs, lows, closes, 10, 3);
  const adxResult = ADX(highs, lows, closes, 14);
  const vwapValues = VWAP(highs, lows, closes, volumes);
  const obvValues = OBV(closes, volumes);
  const cciValues = CCI(highs, lows, closes, 20);
  const williamsRValues = WilliamsR(highs, lows, closes, 14);
  const mfiValues = MFI(highs, lows, closes, volumes, 14);
  const psarResult = ParabolicSAR(highs, lows, closes);

  const last = (arr: number[]): number => {
    for (let i = arr.length - 1; i >= 0; i--) if (!isNaN(arr[i])) return arr[i];
    return 0;
  };
  const prevLast = (arr: number[]): number => {
    let count = 0;
    for (let i = arr.length - 1; i >= 0; i--) {
      if (!isNaN(arr[i])) { count++; if (count === 2) return arr[i]; }
    }
    return 0;
  };

  const ema9 = last(ema9Values);
  const ema21 = last(ema21Values);
  const ema50 = last(ema50Values);
  const ema200 = last(ema200Values);
  const sma20 = last(sma20Values);
  const sma50 = last(sma50Values);
  const sma200 = last(sma200Values);
  const rsi = last(rsiValues);
  const macdLine = last(macdResult.macdLine);
  const macdSignal = last(macdResult.signalLine);
  const macdHist = last(macdResult.histogram);
  const prevMacdLine = prevLast(macdResult.macdLine);
  const prevMacdSignal = prevLast(macdResult.signalLine);
  const prevMacdHist = prevLast(macdResult.histogram);
  const bbUpper = last(bbResult.upper);
  const bbMiddle = last(bbResult.middle);
  const bbLower = last(bbResult.lower);
  const bbPercentB = last(bbResult.percentB);
  const bbBandwidth = last(bbResult.bandwidth);
  const stochK = last(stochResult.k);
  const stochD = last(stochResult.d);
  const prevStochK = prevLast(stochResult.k);
  const prevStochD = prevLast(stochResult.d);
  const atr = last(atrValues);
  const stSignal = supertrendResult.signal[len - 1] || 'NEUTRAL';
  const stValue = last(supertrendResult.value);
  const adxVal = last(adxResult.adx);
  const plusDI = last(adxResult.plusDI);
  const minusDI = last(adxResult.minusDI);
  const vwap = last(vwapValues);
  const obv = last(obvValues);
  const cci = last(cciValues);
  const williamsR = last(williamsRValues);
  const mfi = last(mfiValues);
  const psarValue = last(psarResult.value);
  const psarSignal = psarResult.signal[len - 1] || 'NEUTRAL';

  let macdCrossover = 'NONE';
  if (prevMacdLine <= prevMacdSignal && macdLine > macdSignal) macdCrossover = 'BULLISH_CROSSOVER';
  else if (prevMacdLine >= prevMacdSignal && macdLine < macdSignal) macdCrossover = 'BEARISH_CROSSOVER';

  const volAnalysis = analyzeVolume(candles, 20);
  const { supports, resistances } = findSupportResistance(candles, 50);
  const dayHigh = candles.slice(-20).reduce((m, c) => Math.max(m, c.high), -Infinity);
  const dayLow = candles.slice(-20).reduce((m, c) => Math.min(m, c.low), Infinity);
  const pivots = calculatePivotPoints(dayHigh, dayLow, currentPrice);
  const divergence = detectRSIDivergence(closes, rsiValues, 20);
  const allPatterns = detectAllPatterns(candles);
  const candlePats = allPatterns.filter(p => p.category === 'candlestick');
  const chartPats = allPatterns.filter(p => p.category === 'chart');

  // ═══════════════════════════════════════
  // STEP 2: MULTI-INDICATOR SCORING
  // ═══════════════════════════════════════

  let score = 0;
  const reasons: SignalReason[] = [];

  // ─── EMA ANALYSIS (Max ±8 points) ───
  if (ema9 > ema21) {
    score += 1;
    reasons.push({ indicator: 'EMA 9/21', value: `${ema9.toFixed(2)} > ${ema21.toFixed(2)}`, interpretation: 'EMA 9 above EMA 21 — Short-term momentum is bullish', type: 'bullish', score: 1, icon: '✅' });
  } else if (ema9 < ema21) {
    score -= 1;
    reasons.push({ indicator: 'EMA 9/21', value: `${ema9.toFixed(2)} < ${ema21.toFixed(2)}`, interpretation: 'EMA 9 below EMA 21 — Short-term momentum is bearish', type: 'bearish', score: -1, icon: '❌' });
  }

  if (ema21 > ema50) {
    score += 1;
    reasons.push({ indicator: 'EMA 21/50', value: `${ema21.toFixed(2)} > ${ema50.toFixed(2)}`, interpretation: 'EMA 21 above EMA 50 — Medium-term trend is bullish', type: 'bullish', score: 1, icon: '✅' });
  } else if (ema21 < ema50) {
    score -= 1;
    reasons.push({ indicator: 'EMA 21/50', value: `${ema21.toFixed(2)} < ${ema50.toFixed(2)}`, interpretation: 'EMA 21 below EMA 50 — Medium-term trend is bearish', type: 'bearish', score: -1, icon: '❌' });
  }

  if (ema50 > 0 && ema200 > 0) {
    if (ema50 > ema200) {
      score += 2;
      reasons.push({ indicator: 'Golden Cross Zone', value: `EMA50 ${ema50.toFixed(2)} > EMA200 ${ema200.toFixed(2)}`, interpretation: 'EMA 50 above EMA 200 — GOLDEN CROSS zone. Long-term bull market structure. Historically very bullish.', type: 'bullish', score: 2, icon: '✅' });
    } else {
      score -= 2;
      reasons.push({ indicator: 'Death Cross Zone', value: `EMA50 ${ema50.toFixed(2)} < EMA200 ${ema200.toFixed(2)}`, interpretation: 'EMA 50 below EMA 200 — DEATH CROSS zone. Long-term bear market structure.', type: 'bearish', score: -2, icon: '❌' });
    }
  }

  if (sma20 > 0 && currentPrice > sma20) {
    score += 1;
    reasons.push({ indicator: 'Price vs SMA 20', value: `₹${currentPrice.toFixed(2)} > ₹${sma20.toFixed(2)}`, interpretation: 'Price above 20 SMA — Immediate trend bullish. Price has short-term support.', type: 'bullish', score: 1, icon: '✅' });
  } else if (sma20 > 0) {
    score -= 1;
    reasons.push({ indicator: 'Price vs SMA 20', value: `₹${currentPrice.toFixed(2)} < ₹${sma20.toFixed(2)}`, interpretation: 'Price below 20 SMA — Immediate trend bearish.', type: 'bearish', score: -1, icon: '❌' });
  }

  if (ema200 > 0 && currentPrice > ema200) {
    score += 2;
    reasons.push({ indicator: 'Price vs 200 EMA', value: `₹${currentPrice.toFixed(2)} > ₹${ema200.toFixed(2)}`, interpretation: 'Price above 200 EMA — Major uptrend intact. Institutional support present.', type: 'bullish', score: 2, icon: '✅' });
  } else if (ema200 > 0) {
    score -= 2;
    reasons.push({ indicator: 'Price vs 200 EMA', value: `₹${currentPrice.toFixed(2)} < ₹${ema200.toFixed(2)}`, interpretation: 'Price below 200 EMA — Major downtrend. Avoid long positions until reclaimed.', type: 'bearish', score: -2, icon: '❌' });
  }

  // ─── MACD ANALYSIS (Max ±5 points) ───
  if (macdCrossover === 'BULLISH_CROSSOVER') {
    score += 3;
    reasons.push({ indicator: 'MACD Crossover', value: `MACD ${macdLine.toFixed(3)} crossed above Signal ${macdSignal.toFixed(3)}`, interpretation: 'BULLISH MACD CROSSOVER! MACD line just crossed above signal line — Strong momentum shift from bearish to bullish. One of the most reliable buy signals.', type: 'bullish', score: 3, icon: '✅' });
  } else if (macdCrossover === 'BEARISH_CROSSOVER') {
    score -= 3;
    reasons.push({ indicator: 'MACD Crossover', value: `MACD ${macdLine.toFixed(3)} crossed below Signal ${macdSignal.toFixed(3)}`, interpretation: 'BEARISH MACD CROSSOVER! MACD line crossed below signal line — Momentum shifting from bullish to bearish. Strong sell signal.', type: 'bearish', score: -3, icon: '❌' });
  }

  if (macdHist > 0 && macdHist > prevMacdHist) {
    score += 1;
    reasons.push({ indicator: 'MACD Histogram', value: `${macdHist.toFixed(3)} (increasing)`, interpretation: 'MACD Histogram growing positive — Bullish momentum is accelerating.', type: 'bullish', score: 1, icon: '✅' });
  } else if (macdHist < 0 && macdHist < prevMacdHist) {
    score -= 1;
    reasons.push({ indicator: 'MACD Histogram', value: `${macdHist.toFixed(3)} (decreasing)`, interpretation: 'MACD Histogram growing negative — Bearish momentum intensifying.', type: 'bearish', score: -1, icon: '❌' });
  }

  if (macdLine > 0 && macdSignal > 0) {
    score += 1;
    reasons.push({ indicator: 'MACD Position', value: `Both above zero line`, interpretation: 'Both MACD and Signal above zero — Confirmed bullish territory.', type: 'bullish', score: 1, icon: '✅' });
  } else if (macdLine < 0 && macdSignal < 0) {
    score -= 1;
    reasons.push({ indicator: 'MACD Position', value: `Both below zero line`, interpretation: 'Both MACD and Signal below zero — Confirmed bearish territory.', type: 'bearish', score: -1, icon: '❌' });
  }

  // ─── RSI ANALYSIS (Max ±5 points) ───
  if (rsi < 25) {
    score += 3;
    reasons.push({ indicator: 'RSI', value: `${rsi.toFixed(1)}`, interpretation: `RSI at ${rsi.toFixed(1)} — DEEPLY OVERSOLD! Extreme selling exhaustion. Very high probability of bounce.`, type: 'bullish', score: 3, icon: '✅' });
  } else if (rsi < 30) {
    score += 2;
    reasons.push({ indicator: 'RSI', value: `${rsi.toFixed(1)}`, interpretation: `RSI at ${rsi.toFixed(1)} — Oversold zone. Selling pressure likely exhausted. Bounce expected.`, type: 'bullish', score: 2, icon: '✅' });
  } else if (rsi < 40) {
    score += 1;
    reasons.push({ indicator: 'RSI', value: `${rsi.toFixed(1)}`, interpretation: `RSI at ${rsi.toFixed(1)} — Approaching oversold. Momentum weakening.`, type: 'bullish', score: 1, icon: '✅' });
  } else if (rsi > 80) {
    score -= 3;
    reasons.push({ indicator: 'RSI', value: `${rsi.toFixed(1)}`, interpretation: `RSI at ${rsi.toFixed(1)} — EXTREMELY OVERBOUGHT! Pullback imminent. Very risky to buy here.`, type: 'bearish', score: -3, icon: '❌' });
  } else if (rsi > 70) {
    score -= 2;
    reasons.push({ indicator: 'RSI', value: `${rsi.toFixed(1)}`, interpretation: `RSI at ${rsi.toFixed(1)} — Overbought zone. Consider taking profits.`, type: 'bearish', score: -2, icon: '❌' });
  } else if (rsi > 60) {
    score -= 1;
    reasons.push({ indicator: 'RSI', value: `${rsi.toFixed(1)}`, interpretation: `RSI at ${rsi.toFixed(1)} — Approaching overbought. Momentum still bullish but slowing.`, type: 'bearish', score: -1, icon: '⚠️' });
  } else {
    reasons.push({ indicator: 'RSI', value: `${rsi.toFixed(1)}`, interpretation: `RSI at ${rsi.toFixed(1)} — Neutral zone. No extreme reading.`, type: 'neutral', score: 0, icon: '⚪' });
  }

  // RSI Divergence (Max ±3 points)
  if (divergence.bullishDivergence) {
    score += 3;
    reasons.push({ indicator: 'RSI Divergence', value: 'Bullish Divergence', interpretation: divergence.description, type: 'bullish', score: 3, icon: '✅' });
  }
  if (divergence.bearishDivergence) {
    score -= 3;
    reasons.push({ indicator: 'RSI Divergence', value: 'Bearish Divergence', interpretation: divergence.description, type: 'bearish', score: -3, icon: '❌' });
  }

  // ─── SUPERTREND (Max ±2 points) ───
  if (stSignal === 'BUY') {
    score += 2;
    reasons.push({ indicator: 'Supertrend', value: `BUY at ₹${stValue.toFixed(2)}`, interpretation: `Supertrend is GREEN (bullish) at ₹${stValue.toFixed(2)} — Price is in uptrend with support at supertrend level.`, type: 'bullish', score: 2, icon: '✅' });
  } else if (stSignal === 'SELL') {
    score -= 2;
    reasons.push({ indicator: 'Supertrend', value: `SELL at ₹${stValue.toFixed(2)}`, interpretation: `Supertrend is RED (bearish) at ₹${stValue.toFixed(2)} — Price in downtrend with resistance at supertrend level.`, type: 'bearish', score: -2, icon: '❌' });
  }

  // ─── STOCHASTIC (Max ±2 points) ───
  if (stochK < 20 && stochK > stochD && prevStochK <= prevStochD) {
    score += 2;
    reasons.push({ indicator: 'Stochastic', value: `%K=${stochK.toFixed(1)}, %D=${stochD.toFixed(1)}`, interpretation: `Stochastic BULLISH crossover in OVERSOLD zone! %K crossed above %D below 20 — One of the strongest momentum buy signals.`, type: 'bullish', score: 2, icon: '✅' });
  } else if (stochK > 80 && stochK < stochD && prevStochK >= prevStochD) {
    score -= 2;
    reasons.push({ indicator: 'Stochastic', value: `%K=${stochK.toFixed(1)}, %D=${stochD.toFixed(1)}`, interpretation: `Stochastic BEARISH crossover in OVERBOUGHT zone! %K crossed below %D above 80 — Strong sell signal.`, type: 'bearish', score: -2, icon: '❌' });
  } else if (stochK < 20) {
    score += 1;
    reasons.push({ indicator: 'Stochastic', value: `%K=${stochK.toFixed(1)}`, interpretation: `Stochastic in oversold zone — Bounce potential building.`, type: 'bullish', score: 1, icon: '✅' });
  } else if (stochK > 80) {
    score -= 1;
    reasons.push({ indicator: 'Stochastic', value: `%K=${stochK.toFixed(1)}`, interpretation: `Stochastic in overbought zone — Pullback risk elevated.`, type: 'bearish', score: -1, icon: '❌' });
  }

  // ─── BOLLINGER BANDS (Max ±2 points) ───
  if (bbPercentB <= 0.05) {
    score += 2;
    reasons.push({ indicator: 'Bollinger Bands', value: `Price at lower band (₹${bbLower.toFixed(2)})`, interpretation: `Price touching LOWER Bollinger Band — Mean reversion bounce expected. Price at 2 standard deviations below average.`, type: 'bullish', score: 2, icon: '✅' });
  } else if (bbPercentB >= 0.95) {
    score -= 2;
    reasons.push({ indicator: 'Bollinger Bands', value: `Price at upper band (₹${bbUpper.toFixed(2)})`, interpretation: `Price touching UPPER Bollinger Band — Mean reversion pullback expected.`, type: 'bearish', score: -2, icon: '❌' });
  }
  if (bbBandwidth < 3) {
    reasons.push({ indicator: 'BB Squeeze', value: `Bandwidth: ${bbBandwidth.toFixed(2)}%`, interpretation: `Bollinger Band SQUEEZE detected! Bands very narrow — Volatility extremely low. A BIG move is imminent.`, type: 'neutral', score: 0, icon: '⚠️' });
  }

  // ─── VOLUME ANALYSIS (Max ±3 points) ───
  const currentCandleBullish = currentCandle.close > currentCandle.open;
  if (volAnalysis.isVolumeSpike) {
    const s = currentCandleBullish ? 2 : -2;
    score += s;
    reasons.push({ indicator: 'Volume Spike', value: `${volAnalysis.volumeRatio.toFixed(1)}x average`, interpretation: `VOLUME SPIKE ${volAnalysis.volumeRatio.toFixed(1)}x with ${currentCandleBullish ? 'BULLISH' : 'BEARISH'} candle — ${currentCandleBullish ? 'Massive buying. Smart money entering.' : 'Heavy selling pressure. Institutional distribution.'}`, type: currentCandleBullish ? 'bullish' : 'bearish', score: s, icon: currentCandleBullish ? '✅' : '❌' });
  } else if (volAnalysis.isHighVolume) {
    const s = currentCandleBullish ? 1 : -1;
    score += s;
    reasons.push({ indicator: 'Volume', value: `${volAnalysis.volumeRatio.toFixed(1)}x average`, interpretation: `Above average volume (${volAnalysis.volumeRatio.toFixed(1)}x) — Confirms ${currentCandleBullish ? 'buying' : 'selling'} conviction.`, type: currentCandleBullish ? 'bullish' : 'bearish', score: s, icon: currentCandleBullish ? '✅' : '❌' });
  } else if (volAnalysis.isLowVolume) {
    reasons.push({ indicator: 'Volume', value: `${volAnalysis.volumeRatio.toFixed(1)}x average`, interpretation: `LOW volume — Weak conviction. Wait for volume confirmation.`, type: 'neutral', score: 0, icon: '⚠️' });
  }

  // ─── VWAP (Max ±1 point) ───
  if (vwap > 0 && currentPrice > vwap) {
    score += 1;
    reasons.push({ indicator: 'VWAP', value: `Price ₹${currentPrice.toFixed(2)} > VWAP ₹${vwap.toFixed(2)}`, interpretation: 'Price above VWAP — Bullish intraday bias. Buyers willing to pay above average.', type: 'bullish', score: 1, icon: '✅' });
  } else if (vwap > 0) {
    score -= 1;
    reasons.push({ indicator: 'VWAP', value: `Price ₹${currentPrice.toFixed(2)} < VWAP ₹${vwap.toFixed(2)}`, interpretation: 'Price below VWAP — Bearish intraday bias. Sellers dominating.', type: 'bearish', score: -1, icon: '❌' });
  }

  // ─── MFI (Max ±2 points) ───
  if (mfi < 20) {
    score += 2;
    reasons.push({ indicator: 'MFI', value: `${mfi.toFixed(1)}`, interpretation: `Money Flow Index at ${mfi.toFixed(1)} — OVERSOLD with volume confirmation. Stronger signal than RSI alone.`, type: 'bullish', score: 2, icon: '✅' });
  } else if (mfi > 80) {
    score -= 2;
    reasons.push({ indicator: 'MFI', value: `${mfi.toFixed(1)}`, interpretation: `Money Flow Index at ${mfi.toFixed(1)} — OVERBOUGHT with volume confirmation. Unsustainable money flow.`, type: 'bearish', score: -2, icon: '❌' });
  }

  // ─── CCI (Max ±1 point) ───
  if (cci < -100) {
    score += 1;
    reasons.push({ indicator: 'CCI', value: `${cci.toFixed(1)}`, interpretation: `CCI at ${cci.toFixed(1)} — Oversold territory. Price significantly below statistical norm.`, type: 'bullish', score: 1, icon: '✅' });
  } else if (cci > 100) {
    score -= 1;
    reasons.push({ indicator: 'CCI', value: `${cci.toFixed(1)}`, interpretation: `CCI at ${cci.toFixed(1)} — Overbought territory. Price significantly above statistical norm.`, type: 'bearish', score: -1, icon: '❌' });
  }

  // ─── ADX (Max ±1 point) ───
  if (adxVal > 25 && plusDI > minusDI) {
    score += 1;
    reasons.push({ indicator: 'ADX', value: `ADX=${adxVal.toFixed(1)}, +DI=${plusDI.toFixed(1)} > -DI=${minusDI.toFixed(1)}`, interpretation: `Strong BULLISH trend confirmed. ADX above 25 with +DI dominant — Trade with the uptrend.`, type: 'bullish', score: 1, icon: '✅' });
  } else if (adxVal > 25 && minusDI > plusDI) {
    score -= 1;
    reasons.push({ indicator: 'ADX', value: `ADX=${adxVal.toFixed(1)}, -DI=${minusDI.toFixed(1)} > +DI=${plusDI.toFixed(1)}`, interpretation: `Strong BEARISH trend confirmed. ADX above 25 with -DI dominant.`, type: 'bearish', score: -1, icon: '❌' });
  } else if (adxVal < 20) {
    reasons.push({ indicator: 'ADX', value: `${adxVal.toFixed(1)}`, interpretation: `ADX at ${adxVal.toFixed(1)} — NO clear trend. Market is ranging/sideways. Trend-following strategies may give false signals.`, type: 'neutral', score: 0, icon: '⚠️' });
  }

  // ─── PARABOLIC SAR (Max ±1 point) ───
  if (psarSignal === 'BUY') {
    score += 1;
    reasons.push({ indicator: 'Parabolic SAR', value: `BUY (SAR at ₹${psarValue.toFixed(2)})`, interpretation: `SAR dots below price — Uptrend. Trail stop at ₹${psarValue.toFixed(2)}.`, type: 'bullish', score: 1, icon: '✅' });
  } else if (psarSignal === 'SELL') {
    score -= 1;
    reasons.push({ indicator: 'Parabolic SAR', value: `SELL (SAR at ₹${psarValue.toFixed(2)})`, interpretation: `SAR dots above price — Downtrend. Resistance at ₹${psarValue.toFixed(2)}.`, type: 'bearish', score: -1, icon: '❌' });
  }

  // ─── SUPPORT & RESISTANCE (Max ±3 points) ───
  const nearestSupport = supports[0] || 0;
  const nearestResistance = resistances[0] || Infinity;

  if (nearestSupport > 0 && Math.abs(currentPrice - nearestSupport) / currentPrice < 0.01) {
    score += 2;
    reasons.push({ indicator: 'Support Level', value: `₹${nearestSupport.toFixed(2)}`, interpretation: `Price AT strong support level ₹${nearestSupport.toFixed(2)} — This level has held multiple times. Bounce expected. Good risk-reward entry.`, type: 'bullish', score: 2, icon: '✅' });
  } else if (nearestSupport > 0 && currentPrice < nearestSupport * 0.99) {
    score -= 3;
    reasons.push({ indicator: 'Support Break', value: `Below ₹${nearestSupport.toFixed(2)}`, interpretation: `BREAKDOWN below support ₹${nearestSupport.toFixed(2)}! Previous support now becomes resistance. Bearish breakdown confirmed.`, type: 'bearish', score: -3, icon: '❌' });
  }

  if (nearestResistance < Infinity && Math.abs(currentPrice - nearestResistance) / currentPrice < 0.01) {
    score -= 1;
    reasons.push({ indicator: 'Resistance Level', value: `₹${nearestResistance.toFixed(2)}`, interpretation: `Price near resistance ₹${nearestResistance.toFixed(2)} — May face rejection. Watch for breakout or pullback.`, type: 'bearish', score: -1, icon: '⚠️' });
  } else if (nearestResistance > 0 && nearestResistance < Infinity && currentPrice > nearestResistance * 1.01) {
    score += 3;
    reasons.push({ indicator: 'Resistance Break', value: `Above ₹${nearestResistance.toFixed(2)}`, interpretation: `BREAKOUT above resistance ₹${nearestResistance.toFixed(2)}! Previous resistance now support. Bullish breakout confirmed.`, type: 'bullish', score: 3, icon: '✅' });
  }

  // ─── CANDLESTICK PATTERNS ───
  for (const pattern of candlePats) {
    let patternScore = 0;
    if (pattern.reliability === 'high') patternScore = pattern.type === 'bullish' ? 3 : pattern.type === 'bearish' ? -3 : 0;
    else if (pattern.reliability === 'medium') patternScore = pattern.type === 'bullish' ? 2 : pattern.type === 'bearish' ? -2 : 0;
    else patternScore = pattern.type === 'bullish' ? 1 : pattern.type === 'bearish' ? -1 : 0;
    score += patternScore;
    reasons.push({ indicator: `Candle: ${pattern.name}`, value: `${pattern.type} (${pattern.reliability} reliability)`, interpretation: pattern.description, type: pattern.type, score: patternScore, icon: pattern.type === 'bullish' ? '🕯️✅' : pattern.type === 'bearish' ? '🕯️❌' : '🕯️⚪' });
  }

  // ─── CHART PATTERNS ───
  for (const pattern of chartPats) {
    const patternScore = pattern.reliability === 'high'
      ? (pattern.type === 'bullish' ? 3 : pattern.type === 'bearish' ? -3 : 0)
      : (pattern.type === 'bullish' ? 2 : pattern.type === 'bearish' ? -2 : 0);
    score += patternScore;
    reasons.push({ indicator: `Chart: ${pattern.name}`, value: `${pattern.type} pattern`, interpretation: pattern.description, type: pattern.type, score: patternScore, icon: pattern.type === 'bullish' ? '📐✅' : pattern.type === 'bearish' ? '📐❌' : '📐⚪' });
  }

  // ═══════════════════════════════════════
  // STEP 3: CLASSIFY SIGNAL
  // ═══════════════════════════════════════

  let signal: SignalType;
  let signalEmoji: string;

  if (score >= 12) { signal = 'STRONG_BUY'; signalEmoji = '🟢🟢🟢'; }
  else if (score >= 7) { signal = 'BUY'; signalEmoji = '🟢🟢'; }
  else if (score >= 3) { signal = 'WEAK_BUY'; signalEmoji = '🟢'; }
  else if (score >= -2) { signal = 'NEUTRAL'; signalEmoji = '⚪'; }
  else if (score >= -6) { signal = 'WEAK_SELL'; signalEmoji = '🔴'; }
  else if (score >= -11) { signal = 'SELL'; signalEmoji = '🔴🔴'; }
  else { signal = 'STRONG_SELL'; signalEmoji = '🔴🔴🔴'; }

  const confidence = Math.min(95, Math.max(10, 50 + Math.abs(score) * 3));

  // ═══════════════════════════════════════
  // STEP 4: CALCULATE TRADE SETUP
  // ═══════════════════════════════════════

  const isBuySignal = signal.includes('BUY');
  let stopLoss: number, target1: number, target2: number, target3: number;

  if (isBuySignal) {
    stopLoss = Math.round(Math.min(findSwingLow(candles, 15), currentPrice - atr * 2) * 100) / 100;
    const risk = currentPrice - stopLoss;
    target1 = Math.round((currentPrice + risk * 1.5) * 100) / 100;
    target2 = Math.round((currentPrice + risk * 2.5) * 100) / 100;
    target3 = Math.round((currentPrice + risk * 3.5) * 100) / 100;
  } else if (signal.includes('SELL')) {
    stopLoss = Math.round(Math.max(findSwingHigh(candles, 15), currentPrice + atr * 2) * 100) / 100;
    const risk = stopLoss - currentPrice;
    target1 = Math.round((currentPrice - risk * 1.5) * 100) / 100;
    target2 = Math.round((currentPrice - risk * 2.5) * 100) / 100;
    target3 = Math.round((currentPrice - risk * 3.5) * 100) / 100;
  } else {
    stopLoss = Math.round((currentPrice - atr * 2) * 100) / 100;
    target1 = Math.round((currentPrice + atr * 2) * 100) / 100;
    target2 = Math.round((currentPrice + atr * 3) * 100) / 100;
    target3 = Math.round((currentPrice + atr * 4) * 100) / 100;
  }

  const riskPerShare = Math.abs(currentPrice - stopLoss);
  const rewardPerShare = Math.abs(target2 - currentPrice);
  const riskRewardRatio = riskPerShare > 0 ? Math.round((rewardPerShare / riskPerShare) * 10) / 10 : 0;

  if (riskRewardRatio < 1.5 && signal !== 'NEUTRAL') {
    reasons.push({ indicator: 'Risk Management', value: `R:R = 1:${riskRewardRatio}`, interpretation: `Risk-Reward ratio too low (1:${riskRewardRatio}). Minimum required is 1:1.5. Wait for better setup.`, type: 'neutral', score: 0, icon: '⚠️' });
    if (Math.abs(score) < 10) { signal = 'NEUTRAL'; signalEmoji = '⚪'; }
  }

  const tradeSetup: TradeSetup = {
    entry: currentPrice, stopLoss, target1, target2, target3,
    riskPerShare: Math.round(riskPerShare * 100) / 100,
    rewardPerShare: Math.round(rewardPerShare * 100) / 100,
    riskRewardRatio,
    positionSizeForRisk: (capitalRiskAmount: number) => riskPerShare > 0 ? Math.floor(capitalRiskAmount / riskPerShare) : 0,
  };

  // ═══════════════════════════════════════
  // STEP 5: DETERMINE OVERALL TREND
  // ═══════════════════════════════════════

  let trendDirection: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS' = 'SIDEWAYS';
  let trendStrength: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK';

  const trendScore = (ema9 > ema21 ? 1 : -1) + (ema21 > ema50 ? 1 : -1) + (ema50 > ema200 ? 1 : -1);
  if (trendScore >= 2) trendDirection = 'UPTREND';
  else if (trendScore <= -2) trendDirection = 'DOWNTREND';

  if (adxVal > 40) trendStrength = 'STRONG';
  else if (adxVal > 25) trendStrength = 'MODERATE';

  // ═══════════════════════════════════════
  // STEP 6: BUILD SUMMARY
  // ═══════════════════════════════════════

  const bullishCount = reasons.filter(r => r.type === 'bullish').length;
  const bearishCount = reasons.filter(r => r.type === 'bearish').length;

  let summary = `${symbol} is showing a ${signal.replace('_', ' ')} signal with ${confidence}% confidence. `;
  summary += `${bullishCount} indicators are bullish, ${bearishCount} are bearish. `;
  summary += `Trend is ${trendDirection} (${trendStrength}). `;
  if (isBuySignal) {
    summary += `Entry at ₹${currentPrice.toFixed(2)}, targets ₹${target1.toFixed(2)}/₹${target2.toFixed(2)}/₹${target3.toFixed(2)}, SL at ₹${stopLoss.toFixed(2)}. R:R 1:${riskRewardRatio}.`;
  } else if (signal.includes('SELL')) {
    summary += `Short entry at ₹${currentPrice.toFixed(2)}, targets ₹${target1.toFixed(2)}/₹${target2.toFixed(2)}, SL at ₹${stopLoss.toFixed(2)}.`;
  } else {
    summary += `No clear trade setup. Wait for confirmation.`;
  }

  // ═══════════════════════════════════════
  // STEP 7: RETURN COMPLETE SIGNAL
  // ═══════════════════════════════════════

  const allIndicators: AllIndicatorValues = {
    rsi,
    macd: { line: macdLine, signal: macdSignal, histogram: macdHist, crossover: macdCrossover },
    ema9, ema21, ema50, ema200, sma20, sma50, sma200,
    supertrend: { signal: stSignal, value: stValue },
    bollinger: { upper: bbUpper, middle: bbMiddle, lower: bbLower, percentB: bbPercentB, bandwidth: bbBandwidth },
    stochastic: { k: stochK, d: stochD },
    adx: { adx: adxVal, plusDI, minusDI },
    atr, vwap, obv, cci, williamsR, mfi,
    parabolicSar: { value: psarValue, signal: psarSignal },
    volume: { current: volAnalysis.currentVolume, average: volAnalysis.averageVolume, ratio: volAnalysis.volumeRatio, trend: volAnalysis.volumeTrend },
    pivots, supports, resistances,
  };

  return {
    id: `SIG-${symbol}-${Date.now()}`,
    symbol, stockName, exchange, timeframe,
    timestamp: Date.now(),
    signal, signalEmoji, score, maxPossibleScore: 40, confidence,
    currentPrice, tradeSetup,
    reasons: reasons.sort((a, b) => Math.abs(b.score) - Math.abs(a.score)),
    bullishReasons: reasons.filter(r => r.type === 'bullish').sort((a, b) => b.score - a.score),
    bearishReasons: reasons.filter(r => r.type === 'bearish').sort((a, b) => a.score - b.score),
    neutralReasons: reasons.filter(r => r.type === 'neutral'),
    detectedPatterns: allPatterns, candlePatterns: candlePats, chartPatterns: chartPats,
    indicators: allIndicators,
    volumeAnalysis: volAnalysis.description,
    rsiDivergence: divergence.description,
    trendDirection, trendStrength, summary,
    status: 'active',
  };
}
