// ═══════════════════════════════════════════════════════════
// TradeSignal Pro — Live Market Monitor
// Continuously monitors stocks and generates real-time signals
// Made with ❤️ by Shahrukh
// ═══════════════════════════════════════════════════════════

import { OHLCV } from './indicators';
import { generateLiveSignal, LiveSignal } from './signalEngine';

export interface MonitorConfig {
  symbols: Array<{ symbol: string; name: string; exchange: string }>;
  timeframe: string;
  scanIntervalMs: number;
  signalChangeCallback: (signal: LiveSignal) => void;
  priceUpdateCallback?: (symbol: string, price: number, change: number) => void;
  errorCallback?: (error: string) => void;
}

export interface MonitoredStock {
  symbol: string;
  name: string;
  exchange: string;
  candles: OHLCV[];
  lastSignal: LiveSignal | null;
  lastPrice: number;
  lastUpdate: number;
  priceChangePercent: number;
}

export class LiveMarketMonitor {
  private config: MonitorConfig;
  private stocks: Map<string, MonitoredStock> = new Map();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;
  private scanCount: number = 0;

  constructor(config: MonitorConfig) {
    this.config = config;
    for (const stock of config.symbols) {
      this.stocks.set(stock.symbol, {
        symbol: stock.symbol, name: stock.name, exchange: stock.exchange,
        candles: [], lastSignal: null, lastPrice: 0, lastUpdate: 0, priceChangePercent: 0,
      });
    }
  }

  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    console.log(`[Monitor] Starting live monitoring for ${this.stocks.size} stocks...`);
    this.scanAllStocks();
    this.intervalId = setInterval(() => this.scanAllStocks(), this.config.scanIntervalMs);
  }

  stop(): void {
    if (this.intervalId) { clearInterval(this.intervalId); this.intervalId = null; }
    this.isRunning = false;
    console.log('[Monitor] Stopped.');
  }

  updateCandleData(symbol: string, candles: OHLCV[]): void {
    const stock = this.stocks.get(symbol);
    if (!stock) return;
    stock.candles = candles;
    stock.lastUpdate = Date.now();
    if (candles.length > 0) {
      const lastCandle = candles[candles.length - 1];
      const prevPrice = stock.lastPrice;
      stock.lastPrice = lastCandle.close;
      if (prevPrice > 0) stock.priceChangePercent = ((lastCandle.close - prevPrice) / prevPrice) * 100;
      this.config.priceUpdateCallback?.(symbol, lastCandle.close, stock.priceChangePercent);
    }
  }

  appendCandle(symbol: string, candle: OHLCV): void {
    const stock = this.stocks.get(symbol);
    if (!stock) return;
    if (stock.candles.length > 0 && stock.candles[stock.candles.length - 1].time === candle.time) {
      stock.candles[stock.candles.length - 1] = candle;
    } else {
      stock.candles.push(candle);
      if (stock.candles.length > 300) stock.candles = stock.candles.slice(-300);
    }
    stock.lastPrice = candle.close;
    stock.lastUpdate = Date.now();
  }

  private scanAllStocks(): void {
    this.scanCount++;
    for (const [symbol, stock] of this.stocks) {
      if (stock.candles.length < 50) continue;
      try {
        const newSignal = generateLiveSignal(stock.candles, stock.symbol, stock.name, stock.exchange, this.config.timeframe);
        const signalChanged = !stock.lastSignal ||
          stock.lastSignal.signal !== newSignal.signal ||
          Math.abs(stock.lastSignal.score - newSignal.score) >= 3;
        if (signalChanged) {
          console.log(`[Monitor] ${symbol}: ${newSignal.signal} (Score: ${newSignal.score}, Confidence: ${newSignal.confidence}%)`);
          this.config.signalChangeCallback(newSignal);
        }
        stock.lastSignal = newSignal;
      } catch (error: any) {
        this.config.errorCallback?.(`Error scanning ${symbol}: ${error.message}`);
      }
    }
  }

  scanStock(symbol: string): LiveSignal | null {
    const stock = this.stocks.get(symbol);
    if (!stock || stock.candles.length < 50) return null;
    const signal = generateLiveSignal(stock.candles, stock.symbol, stock.name, stock.exchange, this.config.timeframe);
    stock.lastSignal = signal;
    return signal;
  }

  getSignal(symbol: string): LiveSignal | null { return this.stocks.get(symbol)?.lastSignal || null; }

  getAllSignals(): LiveSignal[] {
    const signals: LiveSignal[] = [];
    for (const stock of this.stocks.values()) { if (stock.lastSignal) signals.push(stock.lastSignal); }
    return signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  }

  getBuySignals(): LiveSignal[] { return this.getAllSignals().filter(s => s.signal.includes('BUY')); }
  getSellSignals(): LiveSignal[] { return this.getAllSignals().filter(s => s.signal.includes('SELL')); }
  getStrongSignals(): LiveSignal[] { return this.getAllSignals().filter(s => s.signal.includes('STRONG')); }
  getMonitoredStock(symbol: string): MonitoredStock | undefined { return this.stocks.get(symbol); }
  getScanCount(): number { return this.scanCount; }
  isActive(): boolean { return this.isRunning; }

  addStock(symbol: string, name: string, exchange: string = 'NSE'): void {
    if (!this.stocks.has(symbol)) {
      this.stocks.set(symbol, { symbol, name, exchange, candles: [], lastSignal: null, lastPrice: 0, lastUpdate: 0, priceChangePercent: 0 });
    }
  }

  removeStock(symbol: string): void { this.stocks.delete(symbol); }

  simulateLiveTick(symbol: string): void {
    const stock = this.stocks.get(symbol);
    if (!stock || stock.candles.length === 0) return;
    const lastCandle = stock.candles[stock.candles.length - 1];
    const volatility = lastCandle.close * 0.002;
    const change = (Math.random() - 0.48) * volatility;
    const newClose = lastCandle.close + change;
    const updatedCandle: OHLCV = {
      ...lastCandle,
      close: Math.round(newClose * 100) / 100,
      high: Math.max(lastCandle.high, newClose),
      low: Math.min(lastCandle.low, newClose),
      volume: lastCandle.volume + Math.floor(Math.random() * 10000),
    };
    this.appendCandle(symbol, updatedCandle);
  }
}

// ═══════════════════════════════════════
// FACTORY FUNCTION
// ═══════════════════════════════════════

export function createMonitor(
  symbols: Array<{ symbol: string; name: string }>,
  onSignal: (signal: LiveSignal) => void,
  intervalMs: number = 30000
): LiveMarketMonitor {
  return new LiveMarketMonitor({
    symbols: symbols.map(s => ({ ...s, exchange: 'NSE' })),
    timeframe: '15m',
    scanIntervalMs: intervalMs,
    signalChangeCallback: onSignal,
    errorCallback: (err) => console.error('[Monitor Error]', err),
  });
}
