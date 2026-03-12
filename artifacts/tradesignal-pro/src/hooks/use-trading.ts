import { useState, useEffect, useCallback, useRef } from 'react';
import { generateLiveSignal, LiveSignal, OHLCV } from '@/engine';

// ─── Realistic OHLCV candle generator ───
function generateOHLCV(symbol: string, count: number = 250): OHLCV[] {
  const seedPrice: Record<string, number> = {
    'RELIANCE-EQ': 2950, 'INFY-EQ': 1420, 'TCS-EQ': 3850,
    'HDFCBANK-EQ': 1465, 'ICICIBANK-EQ': 1120, 'SBIN-EQ': 830,
    'BAJFINANCE-EQ': 6800, 'TITAN-EQ': 3400, 'ITC-EQ': 470,
    'WIPRO-EQ': 520, 'AXISBANK-EQ': 1190, 'KOTAKBANK-EQ': 1750,
    'TATAMOTORS-EQ': 1020, 'ADANIENT-EQ': 2480, 'MARUTI-EQ': 12500,
  };
  let price = seedPrice[symbol] || 1000;
  const candles: OHLCV[] = [];
  let time = Math.floor(Date.now() / 1000) - count * 900;
  const volatility = price * 0.006;
  let trend = 0;

  for (let i = 0; i < count; i++) {
    trend = trend * 0.95 + (Math.random() - 0.48) * 0.5;
    const open = price;
    const change = trend * volatility + (Math.random() - 0.5) * volatility;
    const close = Math.max(open * 0.97, Math.min(open * 1.03, open + change));
    const high = Math.max(open, close) + Math.random() * volatility * 0.5;
    const low = Math.min(open, close) - Math.random() * volatility * 0.5;
    const isBull = close > open;
    const baseVol = 500000 + Math.random() * 500000;
    const volume = Math.floor(baseVol * (isBull ? 1.2 : 0.8) * (1 + Math.abs(change) / price * 10));
    candles.push({
      time: time + i * 900,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
      volume,
    });
    price = close;
  }
  return candles;
}

// ─── Cache per symbol ───
const candleCache: Record<string, OHLCV[]> = {};

function getCandlesForSymbol(symbol: string): OHLCV[] {
  if (!candleCache[symbol]) candleCache[symbol] = generateOHLCV(symbol, 250);
  return candleCache[symbol];
}

function appendLiveTick(symbol: string): OHLCV[] {
  const candles = candleCache[symbol];
  if (!candles || candles.length === 0) return [];
  const last = candles[candles.length - 1];
  const volatility = last.close * 0.002;
  const change = (Math.random() - 0.48) * volatility;
  const newClose = Math.round((last.close + change) * 100) / 100;
  const updated: OHLCV = {
    ...last,
    close: newClose,
    high: Math.max(last.high, newClose),
    low: Math.min(last.low, newClose),
    volume: last.volume + Math.floor(Math.random() * 8000),
  };
  candles[candles.length - 1] = updated;
  return [...candles];
}

// ═══════════════════════════════════════
// useMarketData — with live engine signals
// ═══════════════════════════════════════

export function useMarketData(symbol: string, _timeframe: string = '15m') {
  const [data, setData] = useState<OHLCV[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [change, setChange] = useState(0);
  const [liveSignal, setLiveSignal] = useState<LiveSignal | null>(null);

  useEffect(() => {
    setLoading(true);
    const candles = getCandlesForSymbol(symbol);
    setData([...candles]);
    const last = candles[candles.length - 1];
    const first = candles[0];
    setCurrentPrice(last.close);
    setChange(((last.close - first.close) / first.close) * 100);

    // Compute initial signal
    try {
      const sig = generateLiveSignal(candles, symbol.replace('-EQ', ''), symbol, 'NSE', '15m');
      setLiveSignal(sig);
    } catch (e) {
      console.warn('Signal engine error:', e);
    }
    setLoading(false);

    // Live tick every 3s
    const interval = setInterval(() => {
      const updated = appendLiveTick(symbol);
      if (updated.length === 0) return;
      setData([...updated]);
      const last = updated[updated.length - 1];
      setCurrentPrice(last.close);
      setChange(((last.close - updated[0].close) / updated[0].close) * 100);

      // Re-run engine every 5 ticks approximately
      if (Math.random() < 0.2) {
        try {
          const sig = generateLiveSignal(updated, symbol.replace('-EQ', ''), symbol, 'NSE', '15m');
          setLiveSignal(sig);
        } catch (e) { /* silent */ }
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [symbol]);

  return { data, loading, currentPrice, change, liveSignal };
}

// ═══════════════════════════════════════
// useIndicators — real engine values
// ═══════════════════════════════════════

export function useIndicators(symbol: string = 'RELIANCE-EQ') {
  const [indicators, setIndicators] = useState<LiveSignal | null>(null);

  useEffect(() => {
    const candles = getCandlesForSymbol(symbol);
    try {
      const sig = generateLiveSignal(candles, symbol.replace('-EQ', ''), symbol, 'NSE', '15m');
      setIndicators(sig);
    } catch (e) {
      console.warn('Indicator error:', e);
    }
  }, [symbol]);

  if (!indicators) {
    return {
      RSI: 50, MACD: { line: 0, signal: 0, hist: 0 },
      EMA20: 0, EMA50: 0, EMA200: 0,
      Supertrend: { value: 0, signal: 'NEUTRAL' },
      patterns: { candlestick: [], chart: [] },
      liveSignal: null,
    };
  }

  return {
    RSI: indicators.indicators.rsi,
    MACD: { line: indicators.indicators.macd.line, signal: indicators.indicators.macd.signal, hist: indicators.indicators.macd.histogram },
    EMA20: indicators.indicators.ema21,
    EMA50: indicators.indicators.ema50,
    EMA200: indicators.indicators.ema200,
    Supertrend: { value: indicators.indicators.supertrend.value, signal: indicators.indicators.supertrend.signal },
    patterns: {
      candlestick: indicators.candlePatterns.map(p => p.name),
      chart: indicators.chartPatterns.map(p => p.name),
    },
    liveSignal: indicators,
  };
}

// ═══════════════════════════════════════
// useSignalAnalysis — real engine scoring
// ═══════════════════════════════════════

export function useSignalAnalysis() {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const analyze = useCallback(async (symbol: string) => {
    setAnalyzing(true);
    await new Promise(r => setTimeout(r, 800));

    try {
      const candles = getCandlesForSymbol(symbol);
      const sig = generateLiveSignal(candles, symbol.replace('-EQ', ''), symbol, 'NSE', '15m');

      setResult({
        symbol: sig.symbol,
        signal: sig.signal,
        signalEmoji: sig.signalEmoji,
        confidence: sig.confidence,
        score: sig.score,
        entry: sig.tradeSetup.entry,
        target1: sig.tradeSetup.target1,
        target2: sig.tradeSetup.target2,
        target3: sig.tradeSetup.target3,
        stopLoss: sig.tradeSetup.stopLoss,
        riskReward: sig.tradeSetup.riskRewardRatio,
        rsi: sig.indicators.rsi,
        summary: sig.summary,
        reasons: sig.bullishReasons.slice(0, 3).map(r => r.interpretation),
        riskFactors: sig.bearishReasons.slice(0, 2).map(r => r.interpretation),
        trendDirection: sig.trendDirection,
        trendStrength: sig.trendStrength,
        candlePatterns: sig.candlePatterns.map(p => p.name),
        chartPatterns: sig.chartPatterns.map(p => p.name),
        liveSignal: sig,
      });
    } catch (e) {
      console.error('Analysis error:', e);
    }
    setAnalyzing(false);
  }, []);

  return { analyze, analyzing, result, setResult };
}

// ═══════════════════════════════════════
// useMultiSignals — signals for Signals tab
// ═══════════════════════════════════════

const TRACKED_SYMBOLS = [
  { symbol: 'RELIANCE-EQ', name: 'Reliance Industries', exchange: 'NSE' },
  { symbol: 'INFY-EQ', name: 'Infosys Ltd', exchange: 'NSE' },
  { symbol: 'TCS-EQ', name: 'Tata Consultancy', exchange: 'NSE' },
  { symbol: 'HDFCBANK-EQ', name: 'HDFC Bank', exchange: 'NSE' },
  { symbol: 'ICICIBANK-EQ', name: 'ICICI Bank', exchange: 'NSE' },
  { symbol: 'SBIN-EQ', name: 'State Bank of India', exchange: 'NSE' },
  { symbol: 'BAJFINANCE-EQ', name: 'Bajaj Finance', exchange: 'NSE' },
  { symbol: 'TITAN-EQ', name: 'Titan Company', exchange: 'NSE' },
];

export function useMultiSignals() {
  const [signals, setSignals] = useState<LiveSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const computeSignals = useCallback(() => {
    const results: LiveSignal[] = [];
    for (const stock of TRACKED_SYMBOLS) {
      try {
        const candles = getCandlesForSymbol(stock.symbol);
        // Advance last candle slightly
        appendLiveTick(stock.symbol);
        const sig = generateLiveSignal([...candles], stock.symbol.replace('-EQ', ''), stock.name, stock.exchange, '15m');
        results.push(sig);
      } catch (e) { /* skip */ }
    }
    const sorted = results.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
    setSignals(sorted);
    setLastUpdate(Date.now());
    setLoading(false);
  }, []);

  useEffect(() => {
    computeSignals();
    intervalRef.current = setInterval(computeSignals, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [computeSignals]);

  const refresh = useCallback(() => {
    setLoading(true);
    setTimeout(computeSignals, 200);
  }, [computeSignals]);

  return { signals, loading, lastUpdate, refresh };
}
