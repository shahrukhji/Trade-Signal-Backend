import { useState, useEffect } from 'react';
import { useStore } from '@/store/use-store';
// In a real app we'd import the Orval hooks here.
// For this demo/UI build, we'll provide robust mock fallbacks that look highly realistic 
// so the UI functions perfectly even if the backend is down.

export function useMarketData(symbol: string, timeframe: string = '15m') {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [change, setChange] = useState(0);

  useEffect(() => {
    setLoading(true);
    // Generate realistic mock OHLCV data
    const generateData = () => {
      const res = [];
      let time = Math.floor(Date.now() / 1000) - 200 * 900; // 200 candles of 15m
      let price = symbol === 'RELIANCE-EQ' ? 2950 : symbol.includes('BANK') ? 1450 : 3500;
      
      for (let i = 0; i < 200; i++) {
        const open = price;
        const high = price + Math.random() * 20;
        const low = price - Math.random() * 20;
        const close = open + (Math.random() - 0.5) * 30;
        price = close;
        res.push({
          time: time + i * 900,
          open, high, low, close,
          volume: Math.floor(Math.random() * 100000)
        });
      }
      return res;
    };

    const mock = generateData();
    setData(mock);
    const last = mock[mock.length - 1];
    setCurrentPrice(last.close);
    setChange((last.close - mock[0].close) / mock[0].close * 100);
    setLoading(false);

    // Simulate live ticks
    const interval = setInterval(() => {
      setCurrentPrice(p => p + (Math.random() - 0.5) * 5);
    }, 3000);

    return () => clearInterval(interval);
  }, [symbol, timeframe]);

  return { data, loading, currentPrice, change };
}

export function useIndicators() {
  return {
    RSI: 42.5,
    MACD: { line: 1.2, signal: 0.8, hist: 0.4 },
    EMA20: 2940.5,
    EMA50: 2920.1,
    EMA200: 2850.0,
    Supertrend: { value: 2910, signal: 'BUY' },
    patterns: {
      candlestick: ['Bullish Engulfing', 'Hammer'],
      chart: ['Double Bottom']
    }
  };
}

export function useSignalAnalysis() {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const analyze = async (symbol: string) => {
    setAnalyzing(true);
    // Simulate AI delay
    await new Promise(r => setTimeout(r, 2500));
    setResult({
      symbol,
      signal: 'STRONG_BUY',
      confidence: 88,
      entry: 2950.50,
      target1: 2980,
      target2: 3010,
      target3: 3050,
      stopLoss: 2910,
      riskReward: 2.5,
      reasons: [
        "Price bounced off major support at 2910.",
        "Bullish Engulfing pattern formed on 15m chart.",
        "RSI is recovering from oversold territory (42).",
        "MACD crossover indicates shifting momentum."
      ],
      riskFactors: [
        "Overall market indices are showing slight weakness.",
        "Upcoming Fed rate decision might cause volatility."
      ],
      summary: "High probability long setup with excellent R:R. Entry near current levels with tight SL below recent swing low."
    });
    setAnalyzing(false);
  };

  return { analyze, analyzing, result };
}
