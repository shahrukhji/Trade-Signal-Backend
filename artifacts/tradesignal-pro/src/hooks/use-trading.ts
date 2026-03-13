import { useState, useEffect, useCallback, useRef } from 'react';
import { generateLiveSignal, LiveSignal, OHLCV } from '@/engine';

// ─── Interval mapping ─────────────────────────────────────────────────────────
const INTERVAL_MAP: Record<string, string> = {
  '1m': 'ONE_MINUTE', '3m': 'THREE_MINUTE', '5m': 'FIVE_MINUTE',
  '15m': 'FIFTEEN_MINUTE', '30m': 'THIRTY_MINUTE', '1h': 'ONE_HOUR', '1d': 'ONE_DAY',
};

// Returns lookback days per interval (to request enough data)
const LOOKBACK_DAYS: Record<string, number> = {
  '1m': 5, '3m': 10, '5m': 15, '15m': 90, '30m': 90, '1h': 90, '1d': 365,
};

function fmtDate(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getDay();
  const h = now.getHours(), m = now.getMinutes();
  const totalMin = h * 60 + m;
  return day >= 1 && day <= 5 && totalMin >= 9 * 60 + 15 && totalMin <= 15 * 60 + 30;
}

// ─── Candle fetch with LTP update ─────────────────────────────────────────────
async function fetchCandlesFromAPI(symbol: string, interval: string): Promise<OHLCV[]> {
  const sym = symbol.replace('-EQ', '');
  const days = LOOKBACK_DAYS[interval] || 90;
  const now = new Date();
  const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const apiInterval = INTERVAL_MAP[interval] || 'FIFTEEN_MINUTE';

  const res = await fetch('/api/market/candles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol: sym, interval: apiInterval, fromdate: fmtDate(from), todate: fmtDate(now) }),
  });

  if (!res.ok) throw new Error(`Candle fetch failed: ${res.status}`);
  const json = await res.json();
  if (!json.success || !Array.isArray(json.candles)) throw new Error(json.error || 'No candle data');
  return json.candles as OHLCV[];
}

async function fetchLiveQuote(symbol: string): Promise<number | null> {
  try {
    const sym = symbol.replace('-EQ', '');
    const res = await fetch('/api/market/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbols: [sym], exchange: 'NSE' }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const fetched = json.data?.fetched;
    if (Array.isArray(fetched) && fetched.length > 0 && fetched[0].ltp) {
      return Number(fetched[0].ltp);
    }
    return null;
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════
// useMarketData — real Angel One candles + live LTP polling
// ═══════════════════════════════════════

export function useMarketData(symbol: string, timeframe: string = '15m') {
  const [data, setData] = useState<OHLCV[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [change, setChange] = useState(0);
  const [liveSignal, setLiveSignal] = useState<LiveSignal | null>(null);

  // Fetch historical candles + compute initial signal
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchCandlesFromAPI(symbol, timeframe)
      .then(candles => {
        if (cancelled || candles.length === 0) return;
        setData(candles);
        const last = candles[candles.length - 1];
        const first = candles[0];
        setCurrentPrice(last.close);
        setChange(((last.close - first.close) / first.close) * 100);
        try {
          const sym = symbol.replace('-EQ', '');
          const sig = generateLiveSignal(candles, sym, sym, 'NSE', timeframe);
          setLiveSignal(sig);
        } catch { /* signal engine errors are non-fatal */ }
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load market data');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [symbol, timeframe]);

  // Poll live LTP every 15s during market hours
  useEffect(() => {
    if (data.length === 0 || !isMarketOpen()) return;

    const poll = async () => {
      const ltp = await fetchLiveQuote(symbol);
      if (ltp && ltp > 0) {
        setCurrentPrice(ltp);
        setData(prev => {
          if (prev.length === 0) return prev;
          const updated = [...prev];
          const last = { ...updated[updated.length - 1], close: ltp };
          last.high = Math.max(last.high, ltp);
          last.low = Math.min(last.low, ltp);
          updated[updated.length - 1] = last;
          setChange(((ltp - updated[0].close) / updated[0].close) * 100);
          return updated;
        });
      }
    };

    poll();
    const id = setInterval(poll, 15_000);
    return () => clearInterval(id);
  }, [symbol, data.length]);

  return { data, loading, error, currentPrice, change, liveSignal };
}

// ═══════════════════════════════════════
// useIndicators — real candle data
// ═══════════════════════════════════════

export function useIndicators(symbol: string = 'RELIANCE-EQ') {
  const [indicators, setIndicators] = useState<LiveSignal | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCandlesFromAPI(symbol, '15m').then(candles => {
      if (cancelled || candles.length === 0) return;
      try {
        const sym = symbol.replace('-EQ', '');
        const sig = generateLiveSignal(candles, sym, sym, 'NSE', '15m');
        setIndicators(sig);
      } catch { /* ignore */ }
    }).catch(() => { /* ignore */ });
    return () => { cancelled = true; };
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
// useSignalAnalysis — real candle data
// ═══════════════════════════════════════

export function useSignalAnalysis() {
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);

  const analyze = useCallback(async (symbol: string) => {
    setAnalyzing(true);
    try {
      const candles = await fetchCandlesFromAPI(symbol, '15m');
      const sym = symbol.replace('-EQ', '');
      const sig = generateLiveSignal(candles, sym, sym, 'NSE', '15m');
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
// useMultiSignals — real candles for top 8 stocks, refreshes every 5 min
// ═══════════════════════════════════════

const TRACKED_STOCKS = [
  { symbol: 'RELIANCE-EQ', name: 'Reliance Industries', exchange: 'NSE' },
  { symbol: 'INFY-EQ', name: 'Infosys Ltd', exchange: 'NSE' },
  { symbol: 'TCS-EQ', name: 'Tata Consultancy', exchange: 'NSE' },
  { symbol: 'HDFCBANK-EQ', name: 'HDFC Bank', exchange: 'NSE' },
  { symbol: 'ICICIBANK-EQ', name: 'ICICI Bank', exchange: 'NSE' },
  { symbol: 'SBIN-EQ', name: 'State Bank of India', exchange: 'NSE' },
  { symbol: 'BAJFINANCE-EQ', name: 'Bajaj Finance', exchange: 'NSE' },
  { symbol: 'BHARTIARTL-EQ', name: 'Bharti Airtel', exchange: 'NSE' },
];

export function useMultiSignals() {
  const [signals, setSignals] = useState<LiveSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch candles for all tracked stocks in parallel
      const results = await Promise.allSettled(
        TRACKED_STOCKS.map(async (stock) => {
          const candles = await fetchCandlesFromAPI(stock.symbol, '15m');
          if (candles.length < 30) throw new Error('Insufficient data');
          const sym = stock.symbol.replace('-EQ', '');
          return generateLiveSignal(candles, sym, stock.name, stock.exchange, '15m');
        })
      );

      const sigs: LiveSignal[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') sigs.push(r.value);
      }

      const sorted = sigs.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
      setSignals(sorted);
      setLastUpdate(Date.now());
    } catch { /* ignore overall failure */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSignals();
    intervalRef.current = setInterval(fetchSignals, 5 * 60 * 1000); // every 5 min
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchSignals]);

  const refresh = useCallback(() => {
    setLoading(true);
    setTimeout(fetchSignals, 100);
  }, [fetchSignals]);

  return { signals, loading, lastUpdate, refresh };
}
