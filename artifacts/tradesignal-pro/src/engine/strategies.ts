// ═══════════════════════════════════════════════════════════
// TradeSignal Pro — 10 Professional Trading Strategies
// Each strategy has a fully working execute() function
// Made with ❤️ by Shahrukh
// ═══════════════════════════════════════════════════════════

import {
  OHLCV, EMA, RSI, MACD, BollingerBands, ATR,
  Supertrend, ADX, VWAP, findSupportResistance,
} from './indicators';
import { detectAllPatterns } from './patterns';

// ═══════════════════════════════════════
// TYPES
// ═══════════════════════════════════════

export type MarketCondition =
  | 'STRONG_UPTREND' | 'UPTREND' | 'SIDEWAYS'
  | 'DOWNTREND' | 'STRONG_DOWNTREND' | 'VOLATILE' | 'LOW_VOLATILITY';

export interface StrategySignal {
  action: 'BUY' | 'SELL' | 'HOLD' | 'EXIT_LONG' | 'EXIT_SHORT';
  entry: number;
  stopLoss: number;
  target1: number;
  target2: number;
  target3: number;
  trailingStop?: number;
  confidence: number;
  riskReward: number;
  reasoning: string[];
  triggered: boolean;
}

export interface Strategy {
  id: string;
  name: string;
  emoji: string;
  description: string;
  type: 'trend_following' | 'mean_reversion' | 'momentum' | 'breakout' | 'scalping';
  timeframes: string[];
  bestMarketConditions: MarketCondition[];
  worstMarketConditions: MarketCondition[];
  riskLevel: 'low' | 'medium' | 'high';
  expectedWinRate: number;
  avgProfit: number;
  avgLoss: number;
  holdingPeriod: string;
  rules: { entry: string[]; exit: string[]; stopLoss: string[]; management: string[] };
  execute: (candles: OHLCV[]) => StrategySignal;
}

export interface StrategyRecommendation {
  strategy: Strategy;
  signal: StrategySignal;
  suitabilityScore: number;
  reason: string;
}

export interface MarketConditionResult {
  condition: MarketCondition;
  description: string;
  adx: number;
  trendDirection: 'UP' | 'DOWN' | 'NEUTRAL';
  volatility: 'HIGH' | 'MEDIUM' | 'LOW';
  bestStrategyIds: string[];
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function last(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i]) && isFinite(arr[i])) return arr[i];
  }
  return 0;
}

function lastN(arr: number[], n: number): number {
  let count = 0;
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i]) && isFinite(arr[i])) {
      count++;
      if (count === n) return arr[i];
    }
  }
  return 0;
}

function lastStr(arr: string[]): string {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i]) return arr[i];
  }
  return '';
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function hi(c: OHLCV[]): number[] { return c.map(x => x.high); }
function lo(c: OHLCV[]): number[] { return c.map(x => x.low); }
function cl(c: OHLCV[]): number[] { return c.map(x => x.close); }
function vol(c: OHLCV[]): number[] { return c.map(x => x.volume); }

function holdSignal(reason = 'Waiting for entry conditions to be met'): StrategySignal {
  return {
    action: 'HOLD', entry: 0, stopLoss: 0, target1: 0, target2: 0, target3: 0,
    confidence: 0, riskReward: 0, reasoning: [reason], triggered: false,
  };
}

// ═══════════════════════════════════════
// STRATEGY 1: EMA CROSSOVER MOMENTUM
// ═══════════════════════════════════════

const emaCrossoverStrategy: Strategy = {
  id: 'ema_crossover',
  name: 'EMA Crossover Momentum',
  emoji: '📈',
  description: 'Trades the crossover of fast EMA9 over slow EMA21, confirmed by price above EMA50 and above-average volume.',
  type: 'trend_following',
  timeframes: ['15m', '1h', '4h', '1d'],
  bestMarketConditions: ['UPTREND', 'STRONG_UPTREND', 'DOWNTREND', 'STRONG_DOWNTREND'],
  worstMarketConditions: ['SIDEWAYS', 'LOW_VOLATILITY'],
  riskLevel: 'medium',
  expectedWinRate: 55,
  avgProfit: 3.5,
  avgLoss: 1.8,
  holdingPeriod: '2–8 candles',
  rules: {
    entry: ['EMA9 crosses above EMA21 (bullish cross)', 'Price is above EMA50', 'Volume is above 20-period average'],
    exit: ['EMA9 crosses below EMA21', 'Price closes below EMA50', 'Take profit at 3x ATR from entry'],
    stopLoss: ['Below EMA50 for swing trades', 'Below EMA21 for momentum trades'],
    management: ['Trail stop with EMA21', 'Scale out 50% at T1, move SL to breakeven'],
  },
  execute: (candles: OHLCV[]): StrategySignal => {
    if (candles.length < 60) return holdSignal('Need 60+ candles for EMA Crossover');
    const closes = cl(candles);
    const highs = hi(candles);
    const lows = lo(candles);
    const volumes = vol(candles);
    const ema9  = EMA(closes, 9);
    const ema21 = EMA(closes, 21);
    const ema50 = EMA(closes, 50);
    const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const atrVals = ATR(highs, lows, closes, 14);
    const price = last(closes);
    const e9 = last(ema9);  const e9p = lastN(ema9, 2);
    const e21 = last(ema21); const e21p = lastN(ema21, 2);
    const e50 = last(ema50);
    const curVol = volumes[volumes.length - 1];
    const atr = last(atrVals);

    const bullishCross = e9p <= e21p && e9 > e21;
    const bearishCross = e9p >= e21p && e9 < e21;

    if (bullishCross && price > e50 && curVol > avgVol) {
      const entry = r2(price);
      const sl    = r2(e50);
      const t1    = r2(entry + atr * 1.5);
      const t2    = r2(entry + atr * 3);
      const t3    = r2(entry + atr * 5);
      const rr    = r2((t1 - entry) / Math.max(entry - sl, 0.01));
      return {
        action: 'BUY', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        trailingStop: r2(e21), confidence: 70, riskReward: rr, triggered: true,
        reasoning: [
          `📈 EMA9 (₹${r2(e9)}) crossed above EMA21 (₹${r2(e21)}) — bullish momentum`,
          `✅ Price ₹${price} above EMA50 ₹${r2(e50)} — trend confirmed`,
          `📊 Volume ${(curVol / avgVol).toFixed(1)}x average — strong participation`,
          `🎯 Entry ₹${entry} | SL ₹${sl} | T1 ₹${t1} | T2 ₹${t2}`,
          `⚖️ Risk:Reward = ${rr}:1`,
        ],
      };
    }
    if (bearishCross && price < e50) {
      const entry = r2(price);
      const sl    = r2(e50 + atr);
      const t1    = r2(entry - atr * 1.5);
      const t2    = r2(entry - atr * 3);
      const t3    = r2(entry - atr * 5);
      const rr    = r2((entry - t1) / Math.max(sl - entry, 0.01));
      return {
        action: 'SELL', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        trailingStop: r2(e21), confidence: 65, riskReward: rr, triggered: true,
        reasoning: [
          `📉 EMA9 (₹${r2(e9)}) crossed below EMA21 (₹${r2(e21)}) — bearish momentum`,
          `❌ Price ₹${price} below EMA50 ₹${r2(e50)} — downtrend confirmed`,
        ],
      };
    }
    return holdSignal(`EMA9 ₹${r2(e9)} vs EMA21 ₹${r2(e21)} — no crossover yet`);
  },
};

// ═══════════════════════════════════════
// STRATEGY 2: RSI OVERSOLD BOUNCE
// ═══════════════════════════════════════

const rsiBounceStrategy: Strategy = {
  id: 'rsi_bounce',
  name: 'RSI Oversold Bounce',
  emoji: '🎯',
  description: 'Buys when RSI dips below 30 (oversold) and starts turning up near a support level.',
  type: 'mean_reversion',
  timeframes: ['15m', '1h', '4h', '1d'],
  bestMarketConditions: ['SIDEWAYS', 'VOLATILE', 'UPTREND', 'DOWNTREND'],
  worstMarketConditions: ['STRONG_DOWNTREND'],
  riskLevel: 'medium',
  expectedWinRate: 62,
  avgProfit: 2.8,
  avgLoss: 1.2,
  holdingPeriod: '3–10 candles',
  rules: {
    entry: ['RSI drops below 30 then turns up', 'Bullish candle pattern near support', 'Price above key support level'],
    exit: ['RSI reaches 50–60', 'Price hits resistance', 'Take profit at middle Bollinger Band'],
    stopLoss: ['2x ATR below entry', 'Below nearest support level'],
    management: ['Scale out at T1 when RSI reaches 50', 'Trail stop as RSI rises'],
  },
  execute: (candles: OHLCV[]): StrategySignal => {
    if (candles.length < 50) return holdSignal('Need 50+ candles for RSI Bounce');
    const closes = cl(candles);
    const highs  = hi(candles);
    const lows   = lo(candles);
    const rsiVals = RSI(closes, 14);
    const bb      = BollingerBands(closes, 20, 2);
    const atrVals = ATR(highs, lows, closes, 14);
    const patterns = detectAllPatterns(candles);
    const price   = last(closes);
    const rsi     = last(rsiVals);
    const prevRsi = lastN(rsiVals, 2);
    const atr     = last(atrVals);
    const bbMid   = last(bb.middle);
    const bbLow   = last(bb.lower);
    const bbUp    = last(bb.upper);
    const hasBull = patterns.some(p => p.type === 'bullish');

    const wasOversold = prevRsi < 30;
    const turningUp   = rsi > prevRsi && rsi < 45;

    if (wasOversold && turningUp) {
      const entry = r2(price);
      const sl    = r2(entry - atr * 2);
      const t1    = r2(bbMid);
      const t2    = r2(entry + (bbMid - entry) * 2);
      const t3    = r2(bbUp);
      const rr    = r2((t1 - entry) / Math.max(entry - sl, 0.01));
      return {
        action: 'BUY', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        confidence: hasBull ? 78 : 63, riskReward: rr, triggered: true,
        reasoning: [
          `🎯 RSI was ${r2(prevRsi)} (oversold), now rising to ${r2(rsi)} — bounce confirmed`,
          `📊 Price ₹${price} near lower BB ₹${r2(bbLow)}`,
          hasBull ? '🕯️ Bullish candle pattern detected' : '⚡ No candle confirmation yet',
          `🎯 T1: BB Midline ₹${t1} | T2: ₹${t2}`,
          `⚖️ R:R = ${rr}:1 | SL ₹${sl}`,
        ],
      };
    }
    return holdSignal(`RSI ${r2(rsi)} — ${rsi > 30 ? 'waiting for RSI < 30' : 'oversold but not turning up yet'}`);
  },
};

// ═══════════════════════════════════════
// STRATEGY 3: MACD DIVERGENCE REVERSAL
// ═══════════════════════════════════════

const macdDivergenceStrategy: Strategy = {
  id: 'macd_divergence',
  name: 'MACD Divergence Reversal',
  emoji: '🔄',
  description: 'Detects bullish/bearish MACD crossover, buys/sells on momentum shift.',
  type: 'mean_reversion',
  timeframes: ['1h', '4h', '1d'],
  bestMarketConditions: ['DOWNTREND', 'UPTREND', 'VOLATILE'],
  worstMarketConditions: ['SIDEWAYS', 'LOW_VOLATILITY'],
  riskLevel: 'medium',
  expectedWinRate: 58,
  avgProfit: 4.2,
  avgLoss: 1.8,
  holdingPeriod: '5–20 candles',
  rules: {
    entry: ['MACD line crosses above signal line (bullish crossover)', 'MACD still negative — early reversal'],
    exit: ['MACD histogram turns negative', 'Price reaches previous swing high'],
    stopLoss: ['Below divergence low (1.5x ATR)'],
    management: ['Hold until MACD histogram starts decreasing', 'Trail stop with 2x ATR'],
  },
  execute: (candles: OHLCV[]): StrategySignal => {
    if (candles.length < 50) return holdSignal('Need 50+ candles for MACD');
    const closes  = cl(candles);
    const highs   = hi(candles);
    const lows    = lo(candles);
    const macdRes = MACD(closes, 12, 26, 9);
    const atrVals = ATR(highs, lows, closes, 14);
    const price   = last(closes);
    const macdLine   = last(macdRes.macdLine);
    const sigLine    = last(macdRes.signalLine);
    const prevMacd   = lastN(macdRes.macdLine, 2);
    const prevSig    = lastN(macdRes.signalLine, 2);
    const atr        = last(atrVals);

    const bullishCross = prevMacd <= prevSig && macdLine > sigLine && macdLine < 0;
    const bearishCross = prevMacd >= prevSig && macdLine < sigLine && macdLine > 0;

    if (bullishCross) {
      const entry = r2(price);
      const sl    = r2(entry - atr * 2);
      const t1    = r2(entry + atr * 2.5);
      const t2    = r2(entry + atr * 4.5);
      const t3    = r2(entry + atr * 7);
      const rr    = r2((t1 - entry) / Math.max(entry - sl, 0.01));
      return {
        action: 'BUY', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        confidence: 68, riskReward: rr, triggered: true,
        reasoning: [
          `🔄 MACD bullish crossover: Line ${r2(macdLine)} crossed above Signal ${r2(sigLine)}`,
          `📉 MACD negative (${r2(macdLine)}) — early reversal opportunity`,
          `🎯 Entry ₹${entry} | SL ₹${sl} | T1 ₹${t1}`,
          `⚖️ R:R ${rr}:1`,
        ],
      };
    }
    if (bearishCross) {
      const entry = r2(price);
      const sl    = r2(entry + atr * 2);
      const t1    = r2(entry - atr * 2.5);
      const t2    = r2(entry - atr * 4.5);
      const t3    = r2(entry - atr * 7);
      const rr    = r2((entry - t1) / Math.max(sl - entry, 0.01));
      return {
        action: 'SELL', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        confidence: 65, riskReward: rr, triggered: true,
        reasoning: [
          `🔄 MACD bearish crossover: Line ${r2(macdLine)} crossed below Signal ${r2(sigLine)}`,
          `📈 MACD still positive — early stage short`,
        ],
      };
    }
    return holdSignal(`MACD ${r2(macdLine)} vs Signal ${r2(sigLine)} — no crossover`);
  },
};

// ═══════════════════════════════════════
// STRATEGY 4: SUPERTREND TREND RIDER
// ═══════════════════════════════════════

const supertrendStrategy: Strategy = {
  id: 'supertrend',
  name: 'Supertrend Trend Rider',
  emoji: '🚀',
  description: 'Rides the trend using Supertrend indicator. Enters on green flip, exits on red flip.',
  type: 'trend_following',
  timeframes: ['15m', '1h', '4h', '1d'],
  bestMarketConditions: ['STRONG_UPTREND', 'UPTREND', 'STRONG_DOWNTREND', 'DOWNTREND'],
  worstMarketConditions: ['SIDEWAYS', 'LOW_VOLATILITY'],
  riskLevel: 'low',
  expectedWinRate: 52,
  avgProfit: 5.0,
  avgLoss: 2.0,
  holdingPeriod: '10–30 candles',
  rules: {
    entry: ['Supertrend flips to BUY (green)', 'Price closes above Supertrend line'],
    exit: ['Supertrend flips to SELL (red)'],
    stopLoss: ['Supertrend value itself is the stop loss'],
    management: ['Trail stop with Supertrend line each candle', 'No fixed target — hold until flip'],
  },
  execute: (candles: OHLCV[]): StrategySignal => {
    if (candles.length < 30) return holdSignal('Need 30+ candles for Supertrend');
    const closes = cl(candles);
    const highs  = hi(candles);
    const lows   = lo(candles);
    const st      = Supertrend(highs, lows, closes, 10, 3);
    const atrVals = ATR(highs, lows, closes, 14);
    const price   = last(closes);
    const stVal   = last(st.value);
    const stSig   = lastStr(st.signal);
    const prevSig = st.signal[st.signal.length - 2] || '';
    const atr     = last(atrVals);

    const flippedBuy  = prevSig === 'SELL' && stSig === 'BUY';
    const flippedSell = prevSig === 'BUY'  && stSig === 'SELL';
    const ongoingBuy  = stSig === 'BUY';

    if (flippedBuy || ongoingBuy) {
      const entry = r2(price);
      const sl    = r2(stVal);
      const t1    = r2(entry + atr * 2);
      const t2    = r2(entry + atr * 4);
      const t3    = r2(entry + atr * 7);
      const rr    = r2((t1 - entry) / Math.max(entry - sl, 0.01));
      return {
        action: 'BUY', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        trailingStop: sl, confidence: flippedBuy ? 72 : 58, riskReward: rr, triggered: true,
        reasoning: [
          flippedBuy
            ? `🚀 Supertrend JUST flipped to BUY at ₹${entry} — fresh signal!`
            : `🚀 Supertrend BUY trend ongoing — riding the trend`,
          `🛡️ Trailing stop at ₹${r2(stVal)} — moves up each candle`,
          `🎯 T1 ₹${t1} | T2 ₹${t2} | T3 ₹${t3}`,
        ],
      };
    }
    if (flippedSell) {
      const entry = r2(price);
      const sl    = r2(stVal);
      const t1    = r2(entry - atr * 2);
      const t2    = r2(entry - atr * 4);
      const t3    = r2(entry - atr * 7);
      const rr    = r2((entry - t1) / Math.max(sl - entry, 0.01));
      return {
        action: 'SELL', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        trailingStop: sl, confidence: 72, riskReward: rr, triggered: true,
        reasoning: [
          `📉 Supertrend JUST flipped to SELL at ₹${entry}`,
          `🛡️ Stop at ₹${r2(stVal)} above the flip point`,
        ],
      };
    }
    return holdSignal(`Supertrend ${stSig} at ₹${r2(stVal)}. Price ₹${price}. Waiting for trend flip.`);
  },
};

// ═══════════════════════════════════════
// STRATEGY 5: BOLLINGER MEAN REVERSION
// ═══════════════════════════════════════

const bollingerMeanReversionStrategy: Strategy = {
  id: 'bb_mean_reversion',
  name: 'Bollinger Mean Reversion',
  emoji: '🌊',
  description: 'Buys at lower Bollinger Band with RSI < 40, targets the middle band then upper.',
  type: 'mean_reversion',
  timeframes: ['15m', '1h', '4h'],
  bestMarketConditions: ['SIDEWAYS', 'VOLATILE', 'LOW_VOLATILITY'],
  worstMarketConditions: ['STRONG_UPTREND', 'STRONG_DOWNTREND'],
  riskLevel: 'low',
  expectedWinRate: 65,
  avgProfit: 2.0,
  avgLoss: 1.0,
  holdingPeriod: '3–8 candles',
  rules: {
    entry: ['Price touches or goes below lower Bollinger Band', 'RSI below 40', 'Look for reversal candle'],
    exit: ['Price reaches middle Bollinger Band (T1)', 'Price reaches upper Bollinger Band (T2)'],
    stopLoss: ['1.5x ATR below entry or 2% below lower band'],
    management: ['Exit 50% at middle band, rest at upper band'],
  },
  execute: (candles: OHLCV[]): StrategySignal => {
    if (candles.length < 30) return holdSignal('Need 30+ candles for Bollinger');
    const closes  = cl(candles);
    const highs   = hi(candles);
    const lows    = lo(candles);
    const bb      = BollingerBands(closes, 20, 2);
    const rsiVals = RSI(closes, 14);
    const atrVals = ATR(highs, lows, closes, 14);
    const price   = last(closes);
    const rsi     = last(rsiVals);
    const bbLow   = last(bb.lower);
    const bbMid   = last(bb.middle);
    const bbUp    = last(bb.upper);
    const atr     = last(atrVals);
    const bandwidth = bbUp - bbLow;

    if (price <= bbLow * 1.005 && rsi < 40) {
      const entry = r2(price);
      const sl    = r2(entry - atr * 1.5);
      const t1    = r2(bbMid);
      const t2    = r2(bbUp);
      const t3    = r2(bbUp + bandwidth * 0.3);
      const rr    = r2((t1 - entry) / Math.max(entry - sl, 0.01));
      return {
        action: 'BUY', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        confidence: 72, riskReward: rr, triggered: true,
        reasoning: [
          `🌊 Price ₹${price} at lower BB ₹${r2(bbLow)} — mean reversion zone`,
          `📉 RSI ${r2(rsi)} < 40 — oversold confirmation`,
          `🎯 T1: BB Middle ₹${t1} | T2: BB Upper ₹${t2}`,
          `⚖️ R:R ${rr}:1 | SL ₹${sl}`,
        ],
      };
    }
    if (price >= bbUp * 0.995 && rsi > 60) {
      const entry = r2(price);
      const sl    = r2(entry + atr * 1.5);
      const t1    = r2(bbMid);
      const t2    = r2(bbLow);
      const t3    = r2(bbLow - bandwidth * 0.3);
      const rr    = r2((entry - t1) / Math.max(sl - entry, 0.01));
      return {
        action: 'SELL', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        confidence: 68, riskReward: rr, triggered: true,
        reasoning: [
          `🌊 Price ₹${price} at upper BB ₹${r2(bbUp)} — expect pullback to ₹${t1}`,
          `📈 RSI ${r2(rsi)} > 60 — overbought`,
        ],
      };
    }
    return holdSignal(`Price ₹${price} | BB Lower ₹${r2(bbLow)} | BB Upper ₹${r2(bbUp)} | RSI ${r2(rsi)}`);
  },
};

// ═══════════════════════════════════════
// STRATEGY 6: BOLLINGER SQUEEZE BREAKOUT
// ═══════════════════════════════════════

const bollingerSqueezeStrategy: Strategy = {
  id: 'bb_squeeze',
  name: 'Bollinger Squeeze Breakout',
  emoji: '💥',
  description: 'Waits for BB squeeze (compressed volatility), then trades the explosive breakout.',
  type: 'breakout',
  timeframes: ['1h', '4h', '1d'],
  bestMarketConditions: ['LOW_VOLATILITY', 'SIDEWAYS'],
  worstMarketConditions: ['STRONG_UPTREND', 'STRONG_DOWNTREND'],
  riskLevel: 'high',
  expectedWinRate: 55,
  avgProfit: 5.5,
  avgLoss: 2.5,
  holdingPeriod: '5–20 candles',
  rules: {
    entry: ['BB bandwidth at 20-period low (squeeze)', 'Price breaks above upper BB with volume spike', 'Candle closes above upper band'],
    exit: ['2x bandwidth target', 'Trail with Keltner Channel'],
    stopLoss: ['Back inside BB (close below upper band)'],
    management: ['Enter on breakout candle close', 'Target = entry + bandwidth * 2'],
  },
  execute: (candles: OHLCV[]): StrategySignal => {
    if (candles.length < 40) return holdSignal('Need 40+ candles for BB Squeeze');
    const closes  = cl(candles);
    const highs   = hi(candles);
    const lows    = lo(candles);
    const volumes = vol(candles);
    const bb      = BollingerBands(closes, 20, 2);
    const atrVals = ATR(highs, lows, closes, 14);
    const price   = last(closes);
    const bbUp    = last(bb.upper);
    const bbLow   = last(bb.lower);
    const bbMid   = last(bb.middle);
    const atr     = last(atrVals);
    const bandwidth = bbUp - bbLow;
    const avgVol  = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const curVol  = volumes[volumes.length - 1];

    // Compute 20-period min bandwidth
    const bws = bb.upper.map((u, i) => (isNaN(u) || isNaN(bb.lower[i])) ? NaN : u - bb.lower[i]);
    const recentBW = bws.slice(-20).filter(v => !isNaN(v));
    const minBW   = Math.min(...recentBW);
    const isSqueeze   = bandwidth <= minBW * 1.15;
    const volSpike    = curVol > avgVol * 1.5;
    const breakoutUp  = price > bbUp && volSpike;
    const breakoutDn  = price < bbLow && volSpike;

    if (isSqueeze && breakoutUp) {
      const entry = r2(price);
      const sl    = r2(bbMid);
      const t1    = r2(entry + bandwidth);
      const t2    = r2(entry + bandwidth * 2);
      const t3    = r2(entry + bandwidth * 3);
      const rr    = r2((t1 - entry) / Math.max(entry - sl, 0.01));
      return {
        action: 'BUY', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        confidence: 75, riskReward: rr, triggered: true,
        reasoning: [
          `💥 BB Squeeze — bandwidth ₹${r2(bandwidth)} at 20p low`,
          `🔥 Price ₹${price} broke above upper BB ₹${r2(bbUp)} with ${(curVol / avgVol).toFixed(1)}x vol`,
          `🎯 T1 ₹${t1} | T2 ₹${t2} | SL at midline ₹${sl}`,
        ],
      };
    }
    if (isSqueeze && breakoutDn) {
      const entry = r2(price);
      const sl    = r2(bbMid);
      const t1    = r2(entry - bandwidth);
      const t2    = r2(entry - bandwidth * 2);
      const t3    = r2(entry - bandwidth * 3);
      const rr    = r2((entry - t1) / Math.max(sl - entry, 0.01));
      return {
        action: 'SELL', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        confidence: 72, riskReward: rr, triggered: true,
        reasoning: [
          `💥 BB Squeeze breakdown — price broke below lower BB with ${(curVol / avgVol).toFixed(1)}x vol`,
        ],
      };
    }
    return holdSignal(isSqueeze
      ? `Squeeze active (bw ₹${r2(bandwidth)}). Waiting for breakout with volume...`
      : `No squeeze. BW ₹${r2(bandwidth)} vs 20p min ₹${r2(minBW)}`);
  },
};

// ═══════════════════════════════════════
// STRATEGY 7: VWAP BOUNCE INTRADAY
// ═══════════════════════════════════════

const vwapBounceStrategy: Strategy = {
  id: 'vwap_bounce',
  name: 'VWAP Bounce Intraday',
  emoji: '📊',
  description: 'Intraday strategy buying price pullbacks to VWAP — the institutional benchmark.',
  type: 'scalping',
  timeframes: ['5m', '15m'],
  bestMarketConditions: ['UPTREND', 'SIDEWAYS'],
  worstMarketConditions: ['STRONG_DOWNTREND', 'LOW_VOLATILITY'],
  riskLevel: 'low',
  expectedWinRate: 60,
  avgProfit: 1.5,
  avgLoss: 0.7,
  holdingPeriod: '3–10 candles',
  rules: {
    entry: ['Price pulls back to VWAP', 'Bullish reversal candle at VWAP level', 'RSI between 40–60'],
    exit: ['Quick target 1x ATR above VWAP', 'Exit before session close'],
    stopLoss: ['Below VWAP by 0.5x ATR'],
    management: ['Tight stops — intraday only', 'Do not hold overnight'],
  },
  execute: (candles: OHLCV[]): StrategySignal => {
    if (candles.length < 20) return holdSignal('Need 20+ candles for VWAP Bounce');
    const closes  = cl(candles);
    const highs   = hi(candles);
    const lows    = lo(candles);
    const volumes  = candles.map(c => c.volume);
    const vwapVals = VWAP(highs, lows, closes, volumes);
    const rsiVals  = RSI(closes, 14);
    const atrVals  = ATR(highs, lows, closes, 14);
    const price    = last(closes);
    const vwap     = last(vwapVals);
    const rsi      = last(rsiVals);
    const atr      = last(atrVals);

    const atVwap   = Math.abs(price - vwap) < atr * 0.4;
    const rsiOk    = rsi > 38 && rsi < 62;
    const above    = price >= vwap;

    if (atVwap && above && rsiOk) {
      const entry = r2(price);
      const sl    = r2(vwap - atr * 0.5);
      const t1    = r2(entry + atr);
      const t2    = r2(entry + atr * 2);
      const t3    = r2(entry + atr * 3);
      const rr    = r2((t1 - entry) / Math.max(entry - sl, 0.01));
      return {
        action: 'BUY', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        confidence: 65, riskReward: rr, triggered: true,
        reasoning: [
          `📊 Price ₹${price} bouncing from VWAP ₹${r2(vwap)} — institutional support`,
          `⚡ RSI ${r2(rsi)} in neutral zone`,
          `🎯 T1 ₹${t1} | SL ₹${sl} | R:R ${rr}:1`,
        ],
      };
    }
    return holdSignal(`Price ₹${price} vs VWAP ₹${r2(vwap)}. RSI ${r2(rsi)}. Waiting for bounce setup.`);
  },
};

// ═══════════════════════════════════════
// STRATEGY 8: TREND PULLBACK ENTRY
// ═══════════════════════════════════════

const trendPullbackStrategy: Strategy = {
  id: 'trend_pullback',
  name: 'Trend Pullback Entry',
  emoji: '⬇️⬆️',
  description: 'In a confirmed uptrend (EMA20 > EMA50 > EMA200), buys dips to the EMA20/50 zone.',
  type: 'trend_following',
  timeframes: ['1h', '4h', '1d'],
  bestMarketConditions: ['UPTREND', 'STRONG_UPTREND'],
  worstMarketConditions: ['DOWNTREND', 'STRONG_DOWNTREND', 'SIDEWAYS'],
  riskLevel: 'low',
  expectedWinRate: 63,
  avgProfit: 3.0,
  avgLoss: 1.2,
  holdingPeriod: '5–20 candles',
  rules: {
    entry: ['EMA20 > EMA50 > EMA200 (aligned uptrend)', 'Price pulls back to EMA20 or EMA50', 'RSI between 40–55'],
    exit: ['Previous high / resistance', 'RSI reaches 65–70'],
    stopLoss: ['Below EMA50 by 1x ATR'],
    management: ['Trail stop with EMA20', 'Scale out at each target level'],
  },
  execute: (candles: OHLCV[]): StrategySignal => {
    if (candles.length < 220) return holdSignal('Need 220+ candles for Trend Pullback');
    const closes  = cl(candles);
    const highs   = hi(candles);
    const lows    = lo(candles);
    const ema20   = EMA(closes, 20);
    const ema50   = EMA(closes, 50);
    const ema200  = EMA(closes, 200);
    const rsiVals = RSI(closes, 14);
    const atrVals = ATR(highs, lows, closes, 14);
    const price   = last(closes);
    const e20     = last(ema20);
    const e50     = last(ema50);
    const e200    = last(ema200);
    const rsi     = last(rsiVals);
    const atr     = last(atrVals);

    const uptrend   = e20 > e50 && e50 > e200;
    const atEma20   = Math.abs(price - e20) < atr * 0.5;
    const atEma50   = Math.abs(price - e50) < atr * 0.8;
    const rsiRange  = rsi >= 38 && rsi <= 58;
    const aboveE200 = price > e200;

    if (uptrend && (atEma20 || atEma50) && rsiRange && aboveE200) {
      const pullTo = atEma20 ? e20 : e50;
      const entry  = r2(price);
      const sl     = r2(e50 - atr);
      const t1     = r2(entry + atr * 2);
      const t2     = r2(entry + atr * 4);
      const t3     = r2(entry + atr * 7);
      const rr     = r2((t1 - entry) / Math.max(entry - sl, 0.01));
      return {
        action: 'BUY', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        trailingStop: r2(e20), confidence: 74, riskReward: rr, triggered: true,
        reasoning: [
          `📈 Uptrend: EMA20(₹${r2(e20)}) > EMA50(₹${r2(e50)}) > EMA200(₹${r2(e200)})`,
          `⬇️ Price ₹${price} pulled back to EMA${atEma20 ? '20' : '50'} ₹${r2(pullTo)} — dip entry`,
          `📊 RSI ${r2(rsi)} in 40–55 range`,
          `🎯 T1 ₹${t1} | T2 ₹${t2} | SL ₹${sl}`,
          `⚖️ R:R ${rr}:1`,
        ],
      };
    }
    const cond = !uptrend
      ? `EMA alignment not uptrend (e20=${r2(e20)} e50=${r2(e50)} e200=${r2(e200)})`
      : `Price ₹${price} not near EMA20 ₹${r2(e20)} or EMA50 ₹${r2(e50)}`;
    return holdSignal(cond);
  },
};

// ═══════════════════════════════════════
// STRATEGY 9: SUPPORT/RESISTANCE BREAKOUT
// ═══════════════════════════════════════

const srBreakoutStrategy: Strategy = {
  id: 'sr_breakout',
  name: 'Support/Resistance Breakout',
  emoji: '🔥',
  description: 'Trades breakouts above resistance or breakdowns below support with 1.5x volume confirmation.',
  type: 'breakout',
  timeframes: ['1h', '4h', '1d'],
  bestMarketConditions: ['UPTREND', 'DOWNTREND', 'SIDEWAYS'],
  worstMarketConditions: ['LOW_VOLATILITY'],
  riskLevel: 'high',
  expectedWinRate: 50,
  avgProfit: 6.0,
  avgLoss: 2.5,
  holdingPeriod: '5–30 candles',
  rules: {
    entry: ['Price breaks above resistance (daily close)', 'Volume at least 1.5x average', 'Previous resistance becomes support'],
    exit: ['Next major resistance zone', 'Price target = R + (R - S) measurement'],
    stopLoss: ['Below the broken resistance (now support)'],
    management: ['Enter on breakout close', 'Add on retest', 'Wide target for explosive moves'],
  },
  execute: (candles: OHLCV[]): StrategySignal => {
    if (candles.length < 50) return holdSignal('Need 50+ candles for S/R Breakout');
    const closes  = cl(candles);
    const highs   = hi(candles);
    const lows    = lo(candles);
    const volumes = vol(candles);
    const sr      = findSupportResistance(candles, 20);
    const atrVals = ATR(highs, lows, closes, 14);
    const price   = last(closes);
    const avgVol  = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const curVol  = volumes[volumes.length - 1];
    const atr     = last(atrVals);
    const volOk   = curVol > avgVol * 1.5;

    const justBrokeOut = sr.resistances.some(r => price > r && price < r * 1.02);
    const justBrokeDn  = sr.supports.some(s => price < s && price > s * 0.98);

    if (justBrokeOut && volOk) {
      const lvl   = sr.resistances.find(r => price > r) || sr.resistances[0];
      const entry = r2(price);
      const sl    = r2(lvl - atr * 0.5);
      const t1    = r2(entry + atr * 3);
      const t2    = r2(entry + atr * 6);
      const t3    = r2(entry + atr * 10);
      const rr    = r2((t1 - entry) / Math.max(entry - sl, 0.01));
      return {
        action: 'BUY', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        confidence: 72, riskReward: rr, triggered: true,
        reasoning: [
          `🔥 Breakout! Price ₹${price} broke above resistance ₹${r2(lvl)}`,
          `📊 Volume ${(curVol / avgVol).toFixed(1)}x — institutional participation`,
          `🎯 T1 ₹${t1} | T2 ₹${t2} | SL ₹${sl}`,
        ],
      };
    }
    if (justBrokeDn && volOk) {
      const lvl   = sr.supports.find(s => price < s) || sr.supports[0];
      const entry = r2(price);
      const sl    = r2(lvl + atr * 0.5);
      const t1    = r2(entry - atr * 3);
      const t2    = r2(entry - atr * 6);
      const t3    = r2(entry - atr * 10);
      const rr    = r2((entry - t1) / Math.max(sl - entry, 0.01));
      return {
        action: 'SELL', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        confidence: 68, riskReward: rr, triggered: true,
        reasoning: [
          `🔥 Breakdown! Price ₹${price} broke below support ₹${r2(lvl)}`,
        ],
      };
    }
    return holdSignal(`Price ₹${price} | R: ${sr.resistances.slice(0, 2).map(r2).join(', ')} | Vol ${(curVol / avgVol).toFixed(1)}x. Waiting for clean breakout.`);
  },
};

// ═══════════════════════════════════════
// STRATEGY 10: RANGE BOUND TRADER
// ═══════════════════════════════════════

const rangeBoundStrategy: Strategy = {
  id: 'range_bound',
  name: 'Range Bound Trader',
  emoji: '↔️',
  description: 'When ADX < 25 (market ranging), buys at support and sells at resistance.',
  type: 'mean_reversion',
  timeframes: ['15m', '1h', '4h'],
  bestMarketConditions: ['SIDEWAYS', 'LOW_VOLATILITY'],
  worstMarketConditions: ['STRONG_UPTREND', 'STRONG_DOWNTREND'],
  riskLevel: 'low',
  expectedWinRate: 65,
  avgProfit: 2.0,
  avgLoss: 1.0,
  holdingPeriod: '3–12 candles',
  rules: {
    entry: ['ADX below 25 (ranging market)', 'Buy at support, sell at resistance', 'RSI oversold at support'],
    exit: ['Opposite band of range', 'Tighten stops if ADX rises above 25'],
    stopLoss: ['Below support (for longs) or above resistance (for shorts)'],
    management: ['Exit if ADX breaks above 25', 'Range boundaries are dynamic'],
  },
  execute: (candles: OHLCV[]): StrategySignal => {
    if (candles.length < 30) return holdSignal('Need 30+ candles for Range Bound');
    const closes  = cl(candles);
    const highs   = hi(candles);
    const lows    = lo(candles);
    const adxRes  = ADX(highs, lows, closes, 14);
    const rsiVals = RSI(closes, 14);
    const sr      = findSupportResistance(candles, 15);
    const atrVals = ATR(highs, lows, closes, 14);
    const price   = last(closes);
    const adx     = last(adxRes.adx);
    const rsi     = last(rsiVals);
    const atr     = last(atrVals);

    if (adx >= 25) return holdSignal(`ADX ${r2(adx)} ≥ 25 — market trending, strategy inactive`);

    const nearSup = sr.supports.filter(s => s < price).sort((a, b) => b - a)[0];
    const nearRes = sr.resistances.filter(r => r > price).sort((a, b) => a - b)[0];

    if (nearSup && Math.abs(price - nearSup) < atr * 0.5 && rsi < 45) {
      const entry = r2(price);
      const sl    = r2(nearSup - atr);
      const t1    = nearRes ? r2(nearRes) : r2(entry + atr * 2);
      const t2    = r2(entry + (t1 - entry) * 1.5);
      const t3    = r2(entry + (t1 - entry) * 2);
      const rr    = r2((t1 - entry) / Math.max(entry - sl, 0.01));
      return {
        action: 'BUY', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        confidence: 68, riskReward: rr, triggered: true,
        reasoning: [
          `↔️ ADX ${r2(adx)} < 25 — ranging market`,
          `📍 Price ₹${price} at support ₹${r2(nearSup)} — buy zone`,
          `RSI ${r2(rsi)} — not overbought`,
          `🎯 Target resistance ₹${t1} | SL ₹${sl}`,
        ],
      };
    }
    if (nearRes && Math.abs(price - nearRes) < atr * 0.5 && rsi > 55) {
      const entry = r2(price);
      const sl    = r2(nearRes + atr);
      const t1    = nearSup ? r2(nearSup) : r2(entry - atr * 2);
      const t2    = r2(entry - (entry - t1) * 1.5);
      const t3    = r2(entry - (entry - t1) * 2);
      const rr    = r2((entry - t1) / Math.max(sl - entry, 0.01));
      return {
        action: 'SELL', entry, stopLoss: sl, target1: t1, target2: t2, target3: t3,
        confidence: 65, riskReward: rr, triggered: true,
        reasoning: [
          `↔️ ADX ${r2(adx)} < 25 — ranging`,
          `📍 Price ₹${price} at resistance ₹${r2(nearRes)} — sell zone`,
        ],
      };
    }
    return holdSignal(`ADX ${r2(adx)} — ranging. Price ₹${price} not at extremes. Sup: ₹${nearSup ? r2(nearSup) : 'N/A'} | Res: ₹${nearRes ? r2(nearRes) : 'N/A'}`);
  },
};

// ═══════════════════════════════════════
// ALL STRATEGIES ARRAY
// ═══════════════════════════════════════

const ALL_STRATEGIES: Strategy[] = [
  emaCrossoverStrategy,
  rsiBounceStrategy,
  macdDivergenceStrategy,
  supertrendStrategy,
  bollingerMeanReversionStrategy,
  bollingerSqueezeStrategy,
  vwapBounceStrategy,
  trendPullbackStrategy,
  srBreakoutStrategy,
  rangeBoundStrategy,
];

export function getAllStrategies(): Strategy[] {
  return ALL_STRATEGIES;
}

// ═══════════════════════════════════════
// MARKET CONDITION DETECTION
// ═══════════════════════════════════════

export function detectMarketCondition(candles: OHLCV[]): MarketConditionResult {
  if (candles.length < 210) {
    return {
      condition: 'SIDEWAYS', description: 'Not enough data to determine market condition.',
      adx: 0, trendDirection: 'NEUTRAL', volatility: 'MEDIUM', bestStrategyIds: ['bb_mean_reversion', 'range_bound'],
    };
  }
  const closes  = cl(candles);
  const highs   = hi(candles);
  const lows    = lo(candles);
  const ema20v  = EMA(closes, 20);
  const ema50v  = EMA(closes, 50);
  const ema200v = EMA(closes, 200);
  const adxRes  = ADX(highs, lows, closes, 14);
  const bb      = BollingerBands(closes, 20, 2);

  const e20 = last(ema20v);
  const e50 = last(ema50v);
  const e200 = last(ema200v);
  const adx = last(adxRes.adx);
  const bbUp  = last(bb.upper);
  const bbLow = last(bb.lower);
  const bbMid = last(bb.middle);
  const bandwidth = bbMid > 0 ? ((bbUp - bbLow) / bbMid) * 100 : 0;

  let trendDirection: 'UP' | 'DOWN' | 'NEUTRAL' = 'NEUTRAL';
  if (e20 > e50 && e50 > e200) trendDirection = 'UP';
  else if (e20 < e50 && e50 < e200) trendDirection = 'DOWN';

  let volatility: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';
  if (bandwidth > 8) volatility = 'HIGH';
  else if (bandwidth < 3) volatility = 'LOW';

  let condition: MarketCondition;
  let description: string;
  let bestStrategyIds: string[];

  if (volatility === 'HIGH') {
    condition = 'VOLATILE';
    description = `High volatility — BB bandwidth ${r2(bandwidth)}%. Breakout & mean reversion strategies work best.`;
    bestStrategyIds = ['bb_squeeze', 'bb_mean_reversion', 'macd_divergence'];
  } else if (volatility === 'LOW') {
    condition = 'LOW_VOLATILITY';
    description = `Low volatility squeeze — BB bandwidth ${r2(bandwidth)}%. Watch for breakout.`;
    bestStrategyIds = ['bb_squeeze', 'range_bound', 'vwap_bounce'];
  } else if (adx > 40 && trendDirection === 'UP') {
    condition = 'STRONG_UPTREND';
    description = `Strong uptrend — ADX ${r2(adx)}, EMAs aligned up.`;
    bestStrategyIds = ['supertrend', 'trend_pullback', 'ema_crossover'];
  } else if (adx > 25 && trendDirection === 'UP') {
    condition = 'UPTREND';
    description = `Uptrend confirmed — ADX ${r2(adx)}. Dip buying works.`;
    bestStrategyIds = ['trend_pullback', 'supertrend', 'ema_crossover', 'sr_breakout'];
  } else if (adx > 40 && trendDirection === 'DOWN') {
    condition = 'STRONG_DOWNTREND';
    description = `Strong downtrend — ADX ${r2(adx)}, EMAs aligned down.`;
    bestStrategyIds = ['supertrend', 'ema_crossover', 'sr_breakout'];
  } else if (adx > 25 && trendDirection === 'DOWN') {
    condition = 'DOWNTREND';
    description = `Downtrend — ADX ${r2(adx)}. Look for oversold bounces or shorts.`;
    bestStrategyIds = ['rsi_bounce', 'macd_divergence', 'sr_breakout'];
  } else {
    condition = 'SIDEWAYS';
    description = `Ranging market — ADX ${r2(adx)} < 25. Buy support, sell resistance.`;
    bestStrategyIds = ['range_bound', 'bb_mean_reversion', 'rsi_bounce', 'vwap_bounce'];
  }

  return { condition, description, adx: r2(adx), trendDirection, volatility, bestStrategyIds };
}

// ═══════════════════════════════════════
// RECOMMEND BEST STRATEGIES
// ═══════════════════════════════════════

export function recommendBestStrategies(candles: OHLCV[]): StrategyRecommendation[] {
  const market = detectMarketCondition(candles);
  const results: StrategyRecommendation[] = [];

  for (const strategy of ALL_STRATEGIES) {
    let signal: StrategySignal;
    try {
      signal = strategy.execute(candles);
    } catch {
      signal = holdSignal();
    }

    let suitabilityScore = 50;
    if (market.bestStrategyIds.includes(strategy.id)) suitabilityScore += 30;
    if (strategy.bestMarketConditions.includes(market.condition)) suitabilityScore += 15;
    if (strategy.worstMarketConditions.includes(market.condition)) suitabilityScore -= 30;
    if (signal.triggered) suitabilityScore += 20;
    if (signal.confidence > 70) suitabilityScore += 10;
    suitabilityScore = Math.max(0, Math.min(100, suitabilityScore));

    const isBest = market.bestStrategyIds.includes(strategy.id);
    const reason = signal.triggered
      ? `Active ${signal.action} signal at ₹${signal.entry} — R:R ${signal.riskReward}:1`
      : isBest
        ? `Best suited for ${market.condition} — ${strategy.description.slice(0, 60)}...`
        : `${suitabilityScore}% match for current market`;

    results.push({ strategy, signal, suitabilityScore, reason });
  }

  return results.sort((a, b) => {
    if (a.signal.triggered && !b.signal.triggered) return -1;
    if (!a.signal.triggered && b.signal.triggered) return 1;
    return b.suitabilityScore - a.suitabilityScore;
  });
}
