import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, Download, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { SCREENER_FILTERS, applyScreenerFilter } from '@/engine/screener';
import type { LiveSignal } from '@/engine/signalEngine';
import { useLocation } from 'wouter';

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}`;

// ─── Map backend SignalResult → LiveSignal shape (for UI reuse) ───────────────
function mapBackendSignal(r: any): LiveSignal {
  const isBuy = (r.signal as string).includes('BUY');
  const isSell = (r.signal as string).includes('SELL');
  const price = r.entry ?? r.ltp ?? 0;
  const signalEmoji = isBuy ? '🟢' : isSell ? '🔴' : '⚪';
  const id = r.symbol + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5);

  return {
    id,
    symbol: String(r.symbol ?? '').replace('-EQ', ''),
    stockName: String(r.symbol ?? '').replace('-EQ', ''),
    exchange: 'NSE',
    timeframe: '15m',
    timestamp: Date.now(),
    signal: r.signal,
    signalEmoji,
    score: Number(r.score ?? 0),
    maxPossibleScore: 20,
    confidence: Number(r.confidence ?? 0),
    currentPrice: price,
    tradeSetup: {
      entry: price,
      stopLoss: r.stopLoss ?? price * (isBuy ? 0.98 : 1.02),
      target1: r.target1 ?? price * (isBuy ? 1.03 : 0.97),
      target2: r.target2 ?? price * (isBuy ? 1.06 : 0.94),
      target3: price * (isBuy ? 1.10 : 0.90),
      riskPerShare: Math.abs(price - (r.stopLoss ?? price * 0.98)),
      rewardPerShare: Math.abs((r.target1 ?? price * 1.03) - price),
      riskRewardRatio: r.riskReward ?? 1,
      positionSizeForRisk: (cap: number) => Math.floor(cap / Math.max(1, Math.abs(price - (r.stopLoss ?? price * 0.98)))),
    },
    reasons: (r.reasons ?? []).map((text: string, i: number) => ({
      indicator: text.split(' ')[0] ?? 'IND',
      value: '',
      interpretation: text,
      type: (isBuy ? 'bullish' : isSell ? 'bearish' : 'neutral') as 'bullish' | 'bearish' | 'neutral',
      score: isBuy ? 1 : isSell ? -1 : 0,
      icon: isBuy ? '📈' : isSell ? '📉' : '➡️',
    })),
    bullishReasons: [],
    bearishReasons: [],
    neutralReasons: [],
    detectedPatterns: [],
    candlePatterns: [],
    chartPatterns: [],
    indicators: {
      rsi: r.indicators?.rsi?.value ?? 50,
      macd: { line: 0, signal: 0, histogram: 0, crossover: 'NEUTRAL' },
      ema9: 0, ema21: 0, ema50: 0, ema200: 0,
      sma20: 0, sma50: 0, sma200: 0,
      supertrend: { signal: 'NEUTRAL', value: 0 },
      bollinger: { upper: 0, middle: 0, lower: 0, percentB: 0, bandwidth: 0 },
      stochastic: { k: 50, d: 50 },
      adx: { adx: 0, plusDI: 0, minusDI: 0 },
      atr: 0, vwap: 0, obv: 0, cci: 0, williamsR: 0, mfi: 0,
      parabolicSar: { value: 0, signal: 'NEUTRAL' },
      volume: { current: 0, average: 0, ratio: 1, trend: 'NEUTRAL' },
      pivots: { pivot: 0, r1: 0, r2: 0, r3: 0, s1: 0, s2: 0, s3: 0 },
      supports: [], resistances: [],
    },
    volumeAnalysis: '',
    rsiDivergence: 'NONE',
    trendDirection: isBuy ? 'UPTREND' : isSell ? 'DOWNTREND' : 'SIDEWAYS',
    trendStrength: Number(r.confidence) >= 70 ? 'STRONG' : Number(r.confidence) >= 50 ? 'MODERATE' : 'WEAK',
    summary: (r.reasons ?? []).slice(0, 2).join('. ') || `${r.signal} signal`,
    status: 'active',
  };
}

// ─── UI sub-components ────────────────────────────────────────────────────────
function SignalBadge({ sig }: { sig: string }) {
  const isBuy = sig.includes('BUY');
  const isSell = sig.includes('SELL');
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
      isBuy ? 'text-primary bg-primary/10 border-primary/20' :
      isSell ? 'text-destructive bg-destructive/10 border-destructive/20' :
      'text-muted-foreground bg-input border-border'
    }`}>
      {isBuy ? '🟢' : isSell ? '🔴' : '⚪'} {sig.replace('_', ' ')}
    </span>
  );
}

function ConfidenceRing({ value, size = 32 }: { value: number; size?: number }) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const color = value >= 70 ? '#00FF88' : value >= 50 ? '#FFD700' : '#FF3366';
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2A3E" strokeWidth="4" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - value / 100)}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

function ResultCard({ signal, onClick }: { signal: LiveSignal; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="glass-panel border border-border rounded-2xl p-3 flex items-center gap-3 active:scale-95 transition-transform cursor-pointer"
    >
      <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 font-bold text-accent text-sm">
        {signal.symbol[0]}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-sm text-foreground font-mono">{signal.symbol}</span>
          <SignalBadge sig={signal.signal} />
        </div>
        <p className="text-[10px] text-muted-foreground truncate">{signal.stockName}</p>
        {signal.signal !== 'NEUTRAL' && signal.currentPrice > 0 && (
          <div className="flex gap-2 mt-0.5 text-[10px] font-mono">
            <span className="text-muted-foreground">
              {fmtINR(signal.currentPrice)} → SL {fmtINR(signal.tradeSetup.stopLoss)}
            </span>
            <span className="text-primary">T1 {fmtINR(signal.tradeSetup.target1)}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <ConfidenceRing value={signal.confidence} />
        <span className={`text-[9px] font-bold ${signal.score > 0 ? 'text-primary' : signal.score < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {signal.score > 0 ? '+' : ''}{signal.score}
        </span>
      </div>
    </motion.div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ScannerScreen() {
  const [, navigate] = useLocation();
  const [activeFilter, setActiveFilter] = useState('all');
  const [allResults, setAllResults] = useState<LiveSignal[]>([]);
  const [filteredResults, setFilteredResults] = useState<LiveSignal[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(50);
  const [currentSymbol, setCurrentSymbol] = useState('');
  const [scanned, setScanned] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const buys = filteredResults.filter(s => s.signal.includes('BUY'));
  const sells = filteredResults.filter(s => s.signal.includes('SELL'));
  const neutral = filteredResults.filter(s => s.signal === 'NEUTRAL');

  // ─── Scan via backend SSE endpoint (real Angel One data) ─────────────────
  const scanAll = useCallback(async () => {
    setScanning(true);
    setProgress(0);
    setTotal(50);
    setScanError(null);
    setScanned(false);

    try {
      const res = await fetch('/api/signals/scanner/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: 'FIFTEEN_MINUTE', minConfidence: 40 }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`Server error: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.done && Array.isArray(evt.results)) {
              // Final event — map backend results to LiveSignal[]
              const mapped: LiveSignal[] = evt.results.map(mapBackendSignal);
              setAllResults(mapped);
              setFilteredResults(applyScreenerFilter(mapped, activeFilter));
              setScanned(true);
            } else {
              // Progress event
              if (evt.scanned !== undefined) setProgress(Number(evt.scanned));
              if (evt.total !== undefined) setTotal(Number(evt.total));
              if (evt.currentStock) setCurrentSymbol(String(evt.currentStock).replace('-EQ', ''));
            }
          } catch { /* skip malformed events */ }
        }
      }
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed. Check connection.');
    } finally {
      setScanning(false);
    }
  }, [activeFilter]);

  const changeFilter = (id: string) => {
    setActiveFilter(id);
    if (allResults.length) setFilteredResults(applyScreenerFilter(allResults, id));
  };

  const exportCSV = () => {
    const rows = [
      ['Symbol', 'Signal', 'Score', 'Confidence', 'Price', 'SL', 'T1', 'R:R'],
      ...filteredResults.map(s => [
        s.symbol, s.signal, s.score, s.confidence,
        s.currentPrice, s.tradeSetup.stopLoss, s.tradeSetup.target1, s.tradeSetup.riskRewardRatio,
      ]),
    ];
    navigator.clipboard.writeText(rows.map(r => r.join(',')).join('\n')).catch(() => {});
  };

  return (
    <div className="pb-6 pt-4">
      {/* Header */}
      <div className="px-4 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ScanLine size={18} className="text-accent" /> Smart Scanner
          </h1>
          {scanned && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Found: <span className="text-primary font-bold">{buys.length} Buy</span> ·{' '}
              <span className="text-destructive font-bold">{sells.length} Sell</span> ·{' '}
              <span className="text-muted-foreground">{neutral.length} Neutral</span>
              {' '}· Live Angel One data
            </p>
          )}
        </div>
        {scanned && (
          <button onClick={exportCSV} className="p-2 rounded-xl bg-input border border-border text-muted-foreground" title="Copy CSV">
            <Download size={14} />
          </button>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
        <button
          onClick={() => changeFilter('all')}
          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-bold transition-all ${
            activeFilter === 'all' ? 'bg-accent text-background border-accent' : 'bg-input border-border text-muted-foreground'
          }`}
        >
          All
        </button>
        {SCREENER_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => changeFilter(f.id)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-bold whitespace-nowrap transition-all ${
              activeFilter === f.id ? 'bg-accent text-background border-accent' : 'bg-input border-border text-muted-foreground'
            }`}
          >
            {f.emoji} {f.name.split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>

      {/* Scan Button */}
      <div className="px-4 mb-4">
        <button
          onClick={scanAll}
          disabled={scanning}
          className="w-full h-12 rounded-2xl bg-accent text-background font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
        >
          {scanning ? (
            <>
              <Activity size={16} className="animate-pulse" />
              Scanning {progress}/{total} — {currentSymbol || '...'}
            </>
          ) : (
            <>
              <ScanLine size={16} />
              {scanned ? 'Re-Scan (Live Data)' : 'Scan All 50 Stocks — Live Data'}
            </>
          )}
        </button>

        <AnimatePresence>
          {scanning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2"
            >
              <div className="h-2 bg-input rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-accent rounded-full"
                  animate={{ width: `${(progress / total) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1 text-center">
                Fetching live candles from Angel One SmartAPI...
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {scanError && (
          <div className="mt-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
            {scanError}
          </div>
        )}
      </div>

      {/* Results */}
      {scanned && !scanning && (
        <div className="px-4 space-y-4">
          {buys.length > 0 && (
            <div>
              <p className="text-xs font-bold text-primary mb-2 flex items-center gap-1">
                <TrendingUp size={12} /> BUY Signals ({buys.length})
              </p>
              <div className="space-y-2">
                {buys.sort((a, b) => b.score - a.score).map(s => (
                  <ResultCard key={s.id} signal={s} onClick={() => navigate(`/charts?symbol=${s.symbol}`)} />
                ))}
              </div>
            </div>
          )}

          {neutral.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
                <Minus size={12} /> Neutral ({neutral.length})
              </p>
              <div className="space-y-2">
                {neutral.slice(0, 5).map(s => (
                  <ResultCard key={s.id} signal={s} onClick={() => navigate(`/charts?symbol=${s.symbol}`)} />
                ))}
                {neutral.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-2">+{neutral.length - 5} more neutral...</p>
                )}
              </div>
            </div>
          )}

          {sells.length > 0 && (
            <div>
              <p className="text-xs font-bold text-destructive mb-2 flex items-center gap-1">
                <TrendingDown size={12} /> SELL Signals ({sells.length})
              </p>
              <div className="space-y-2">
                {sells.sort((a, b) => a.score - b.score).map(s => (
                  <ResultCard key={s.id} signal={s} onClick={() => navigate(`/charts?symbol=${s.symbol}`)} />
                ))}
              </div>
            </div>
          )}

          {filteredResults.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ScanLine size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No stocks match this filter</p>
              <p className="text-xs mt-1">Try "All" or another filter</p>
            </div>
          )}
        </div>
      )}

      {!scanned && !scanning && (
        <div className="text-center py-16 text-muted-foreground px-8">
          <ScanLine size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Scan NIFTY 50 with live Angel One data</p>
          <p className="text-xs mt-2 leading-relaxed">
            Fetches real 15-min candles · Runs 25+ indicators<br />
            Filters BUY signals, breakouts, volume spikes & more
          </p>
        </div>
      )}
    </div>
  );
}
