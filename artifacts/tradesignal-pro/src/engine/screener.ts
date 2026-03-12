// ═══════════════════════════════════════════════════════════
// TradeSignal Pro — Smart Stock Screener
// Finds money-making opportunities
// Made with ❤️ by Shahrukh
// ═══════════════════════════════════════════════════════════

import { LiveSignal } from './signalEngine';

export interface ScreenerFilter {
  id: string;
  name: string;
  emoji: string;
  description: string;
  category: 'momentum' | 'reversal' | 'volume' | 'pattern' | 'strength';
  filter: (signal: LiveSignal) => boolean;
}

export const SCREENER_FILTERS: ScreenerFilter[] = [
  {
    id: 'oversold_bounce',
    name: 'Oversold Bounce Ready',
    emoji: '🎯',
    category: 'reversal',
    description: 'RSI < 30 with bullish reversal candle pattern — High probability bounce',
    filter: (s) => s.indicators.rsi < 30 && s.candlePatterns.some((p) => p.type === 'bullish'),
  },
  {
    id: 'volume_spike',
    name: 'Volume Spike Stocks',
    emoji: '📊',
    category: 'volume',
    description: '2x+ average volume — Institutional activity detected',
    filter: (s) => s.indicators.volume.ratio >= 2,
  },
  {
    id: 'macd_cross',
    name: 'MACD Bullish Crossover',
    emoji: '📈',
    category: 'momentum',
    description: 'MACD just crossed above signal — Momentum turning bullish',
    filter: (s) => s.indicators.macd.crossover === 'BULLISH_CROSSOVER',
  },
  {
    id: 'supertrend_buy',
    name: 'Supertrend Buy Signal',
    emoji: '🚀',
    category: 'momentum',
    description: 'Supertrend just flipped to BUY — New uptrend starting',
    filter: (s) => s.indicators.supertrend.signal === 'BUY',
  },
  {
    id: 'strong_buy',
    name: 'Strong Buy (Score > 10)',
    emoji: '💪',
    category: 'strength',
    description: 'Multiple indicators agree on strong BUY signal',
    filter: (s) => s.score >= 10,
  },
  {
    id: 'high_confidence',
    name: 'High Confidence (>80%)',
    emoji: '🎯',
    category: 'strength',
    description: 'Signals with 80%+ confidence — Highest probability',
    filter: (s) => s.confidence >= 80,
  },
  {
    id: 'breakout',
    name: 'Breakout Stocks',
    emoji: '🔥',
    category: 'pattern',
    description: 'Breaking above resistance with volume confirmation',
    filter: (s) =>
      s.signal.includes('BUY') &&
      s.indicators.volume.ratio > 1.5 &&
      s.chartPatterns.length > 0,
  },
  {
    id: 'golden_cross',
    name: 'Golden Cross Zone',
    emoji: '✨',
    category: 'momentum',
    description: 'EMA50 above EMA200 — Long-term bullish shift',
    filter: (s) => s.indicators.ema50 > s.indicators.ema200,
  },
  {
    id: 'best_rr',
    name: 'Best Risk:Reward (>3:1)',
    emoji: '⚖️',
    category: 'strength',
    description: 'Trades offering 3:1+ reward for every unit of risk',
    filter: (s) => s.tradeSetup.riskRewardRatio >= 3,
  },
  {
    id: 'bearish',
    name: 'Bearish / Short Candidates',
    emoji: '🐻',
    category: 'reversal',
    description: 'Strong sell signals — For shorting or exiting longs',
    filter: (s) => s.signal.includes('SELL') && s.score <= -7,
  },
];

export function applyScreenerFilter(signals: LiveSignal[], filterId: string): LiveSignal[] {
  if (filterId === 'all') return signals;
  const f = SCREENER_FILTERS.find((f) => f.id === filterId);
  if (!f) return signals;
  return signals.filter((s) => f.filter(s));
}

export function getFilterById(id: string): ScreenerFilter | undefined {
  return SCREENER_FILTERS.find((f) => f.id === id);
}
