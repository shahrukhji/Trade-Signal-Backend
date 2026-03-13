import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, Download, TrendingUp, TrendingDown, Minus, Activity, CheckCircle, Loader2, Search, Zap, Target, ShieldAlert } from 'lucide-react';
import { SCREENER_FILTERS, applyScreenerFilter } from '@/engine/screener';
import type { LiveSignal } from '@/engine/signalEngine';
import { useLocation } from 'wouter';
import { StockSearch } from '@/components/StockSearch';
import type { StockSearchResult } from '@/components/StockSearch';
import { TradeFlow } from '@/components/TradeWindow';
import type { TradeSignal } from '@/components/TradeWindow';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}`;

// Mirror of backend NIFTY50 list — used for simulated progress display
const NIFTY50_NAMES = [
  'RELIANCE','TCS','HDFCBANK','INFY','ICICIBANK','HINDUNILVR','ITC','SBIN',
  'BAJFINANCE','BHARTIARTL','KOTAKBANK','WIPRO','HCLTECH','AXISBANK','ASIANPAINT',
  'MARUTI','SUNPHARMA','TATASTEEL','ULTRACEMCO','POWERGRID','NTPC','NESTLEIND',
  'TECHM','TITAN','TATAMOTORS','JSWSTEEL','LT','M&M','INDUSINDBK','TATACONSUM',
  'ONGC','COALINDIA','ADANIPORTS','ADANIENT','BAJAJFINSV','BAJAJ-AUTO','HEROMOTOCO',
  'CIPLA','DIVISLAB','DRREDDY','EICHERMOT','GRASIM','HDFCLIFE','SBILIFE','BPCL',
  'BRITANNIA','APOLLOHOSP','TRENT','SHRIRAMFIN','HINDALCO',
];

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
    exchange: r.exchange ?? 'NSE',
    symbolToken: r.symboltoken ?? r.symbolToken ?? '',
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
    reasons: (r.reasons ?? []).map((text: string) => ({
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

function ResultCard({ signal, onClick, onTrade }: {
  signal: LiveSignal;
  onClick: () => void;
  onTrade?: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel border border-border rounded-2xl p-3 flex items-center gap-3"
    >
      <div
        className="w-9 h-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 font-bold text-accent text-sm cursor-pointer active:scale-90 transition-transform"
        onClick={onClick}
      >
        {signal.symbol[0]}
      </div>
      <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
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
      <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
        <ConfidenceRing value={signal.confidence} />
        {onTrade && signal.signal !== 'NEUTRAL' && (
          <button
            onClick={e => { e.stopPropagation(); onTrade(); }}
            className="text-[9px] px-2 py-0.5 rounded-full bg-accent text-background font-black active:scale-90 transition-transform"
          >
            Trade
          </button>
        )}
      </div>
    </motion.div>
  );
}

// ─── Scanning progress panel ──────────────────────────────────────────────────
function ScanProgressPanel({
  progress, total, currentSymbol, elapsed, finalizing,
}: {
  progress: number;
  total: number;
  currentSymbol: string;
  elapsed: number;
  finalizing: boolean;
}) {
  const pct = finalizing ? 100 : (total > 0 ? Math.round((progress / total) * 100) : 0);

  return (
    <div className="px-4 space-y-4">
      <div className="glass-panel border border-accent/30 rounded-2xl p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-bold text-accent">
              {finalizing ? 'FINALIZING...' : 'LIVE SCANNING'}
            </span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">{elapsed}s</span>
        </div>

        {/* Current stock */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center font-bold text-accent text-base flex-shrink-0" style={{ animation: 'pulse 1s ease-in-out infinite' }}>
            {currentSymbol ? currentSymbol[0] : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground">
              {finalizing ? 'Processing results' : 'Analyzing'}
            </p>
            <p className="text-sm font-bold text-foreground font-mono truncate">
              {finalizing ? 'Sorting signals...' : (currentSymbol || 'Initializing...')}
            </p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-black text-accent font-mono leading-none">{pct}%</p>
            <p className="text-[10px] text-muted-foreground">{progress}/{total}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 bg-input rounded-full overflow-hidden mb-3">
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #00C896, #00FF88)' }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>

        {/* Steps label */}
        <p className="text-[10px] text-muted-foreground text-center">
          {finalizing
            ? 'Applying filters · Sorting by signal strength'
            : `Fetching candles · Running 25+ indicators · Detecting patterns`}
        </p>
      </div>

      {/* Stock progress list (scrolling ticker) */}
      {!finalizing && progress > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Activity size={11} className="text-accent" />
            Stocks scanned
          </p>
          <div className="space-y-1 max-h-52 overflow-hidden relative">
            {/* Show last 6 scanned stocks */}
            {NIFTY50_NAMES.slice(Math.max(0, progress - 6), progress).reverse().map((name, i) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: i === 0 ? 1 : 0.4 - i * 0.05, x: 0 }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${
                  i === 0
                    ? 'bg-accent/10 border-accent/30'
                    : 'bg-input/40 border-border/50'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] flex-shrink-0 ${
                  i === 0 ? 'bg-accent text-background' : 'bg-muted text-muted-foreground'
                }`}>
                  {name[0]}
                </div>
                <span className={`font-mono text-xs font-bold flex-1 ${i === 0 ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {name}
                </span>
                {i === 0 ? (
                  <Loader2 size={11} className="animate-spin text-accent" />
                ) : (
                  <CheckCircle size={11} className="text-primary/60" />
                )}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom single-stock scan ─────────────────────────────────────────────────
function CustomStockScan({ onTrade }: { onTrade: (sig: TradeSignal) => void }) {
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<StockSearchResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    if (!selected) return;
    setScanning(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/signals/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: selected.tradingSymbol,
          symboltoken: selected.symbolToken,
          exchange: selected.exchange,
          interval: 'FIFTEEN_MINUTE',
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Analysis failed');
      setResult(json.signal);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setScanning(false);
    }
  }, [selected]);

  const sig = result?.signal ?? '';
  const isBuy = sig.includes('BUY');
  const isSell = sig.includes('SELL');
  const signalColor = isBuy ? 'text-primary' : isSell ? 'text-destructive' : 'text-muted-foreground';
  const signalBg = isBuy ? 'bg-primary/10 border-primary/20' : isSell ? 'bg-destructive/10 border-destructive/20' : 'bg-input border-border';

  return (
    <div className="px-4 space-y-3">
      {/* Search */}
      <StockSearch
        onSelectStock={s => { setSelected(s); setResult(null); setError(null); }}
        placeholder="Search any stock, F&O, commodity..."
      />

      {/* Selected stock chip + scan button */}
      {selected && !scanning && !result && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          <div className="flex items-center gap-3 px-3 py-2.5 bg-accent/10 border border-accent/30 rounded-xl">
            <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center font-bold text-accent text-sm flex-shrink-0">
              {selected.tradingSymbol[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground font-mono">{selected.tradingSymbol}</p>
              <p className="text-[10px] text-muted-foreground truncate">{selected.companyName} · {selected.exchange}</p>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent border border-accent/30 font-bold">
              {selected.instrumentType}
            </span>
          </div>
          <button
            onClick={runScan}
            className="w-full h-12 rounded-2xl bg-accent text-background font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <Zap size={16} /> Run Deep Scan — 20 Algos
          </button>
        </motion.div>
      )}

      {/* Scanning state */}
      {scanning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel border border-accent/30 rounded-2xl p-4 text-center">
          <Loader2 size={28} className="animate-spin text-accent mx-auto mb-2" />
          <p className="text-sm font-bold text-foreground">Analyzing {selected?.tradingSymbol}</p>
          <p className="text-xs text-muted-foreground mt-1">Running 20 signal algos · Fetching live 15m candles</p>
          <div className="mt-3 h-1.5 bg-input rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-accent rounded-full"
              animate={{ width: ['0%', '90%'] }}
              transition={{ duration: 3, ease: 'easeOut' }}
            />
          </div>
        </motion.div>
      )}

      {/* Result card */}
      {result && !scanning && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {/* Signal header */}
          <div className={`glass-panel border rounded-2xl p-4 ${signalBg}`}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-muted-foreground">Signal</p>
                <p className={`text-xl font-black font-mono ${signalColor}`}>
                  {isBuy ? '🟢' : isSell ? '🔴' : '⚪'} {sig.replace('_', ' ')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className={`text-2xl font-black font-mono ${signalColor}`}>{result.confidence}%</p>
              </div>
            </div>
            {/* Price levels */}
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-background/40 rounded-xl p-2 text-center">
                <p className="text-[9px] text-muted-foreground">ENTRY</p>
                <p className="text-xs font-bold font-mono text-foreground">{fmtINR(result.entry ?? 0)}</p>
              </div>
              <div className="bg-destructive/10 rounded-xl p-2 text-center">
                <p className="text-[9px] text-destructive/80">STOP LOSS</p>
                <p className="text-xs font-bold font-mono text-destructive">{fmtINR(result.stopLoss ?? 0)}</p>
              </div>
              <div className="bg-primary/10 rounded-xl p-2 text-center">
                <p className="text-[9px] text-primary/80">TARGET 1</p>
                <p className="text-xs font-bold font-mono text-primary">{fmtINR(result.target1 ?? 0)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1">
                <Target size={11} /> R:R {result.riskReward?.toFixed(2) ?? '—'}
              </span>
              <span className="text-muted-foreground flex items-center gap-1">
                <ShieldAlert size={11} /> Score {result.score > 0 ? '+' : ''}{result.score}
              </span>
            </div>
          </div>

          {/* Algo reasons */}
          {result.reasons?.length > 0 && (
            <div className="glass-panel border border-border rounded-2xl p-3">
              <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
                <Activity size={11} className="text-accent" /> Signal Reasons ({result.reasons.length} algos)
              </p>
              <div className="space-y-1 max-h-40 overflow-y-auto no-scrollbar">
                {(result.reasons as string[]).map((r, i) => {
                  const isPos = r.includes('(+');
                  const isNeg = r.includes('(-');
                  return (
                    <div key={i} className={`text-[11px] px-2 py-1 rounded-lg ${isPos ? 'text-primary bg-primary/5' : isNeg ? 'text-destructive bg-destructive/5' : 'text-muted-foreground bg-input/50'}`}>
                      {isPos ? '▲' : isNeg ? '▼' : '—'} {r}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {sig !== 'NEUTRAL' && (
              <button
                onClick={() => onTrade({
                  symbol: selected?.tradingSymbol ?? '',
                  symbolToken: selected?.symbolToken ?? '',
                  exchange: selected?.exchange ?? 'NSE',
                  companyName: selected?.companyName,
                  signal: sig,
                  entry: result.entry ?? 0,
                  stopLoss: result.stopLoss ?? 0,
                  target1: result.target1 ?? 0,
                  target2: result.target2,
                  confidence: result.confidence ?? 0,
                  riskReward: result.riskReward,
                })}
                className="flex-1 py-3 rounded-xl bg-accent text-background font-black text-sm active:scale-95 transition-all flex items-center justify-center gap-1.5"
              >
                <Zap size={14} /> Execute Trade
              </button>
            )}
            <button
              onClick={() => navigate(`/charts?symbol=${selected?.tradingSymbol}`)}
              className="flex-1 py-3 rounded-xl bg-input border border-border text-muted-foreground font-bold text-sm active:scale-95 transition-all"
            >
              Chart
            </button>
            <button
              onClick={() => { setResult(null); }}
              className="px-4 py-3 rounded-xl bg-input border border-border text-muted-foreground font-bold text-sm active:scale-95 transition-all"
            >
              ↺
            </button>
          </div>
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <div className="px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {!selected && !scanning && !result && (
        <div className="text-center py-10 text-muted-foreground px-4">
          <Search size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Search any stock or commodity</p>
          <p className="text-xs mt-2 leading-relaxed">
            NSE · BSE · MCX · F&O · Indices<br />
            Runs 20 signal algos on real 15-min candles
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function ScannerScreen() {
  const [, navigate] = useLocation();
  const [scanMode, setScanMode] = useState<'batch' | 'custom'>('batch');
  const [activeFilter, setActiveFilter] = useState('all');
  const [tradeSignal, setTradeSignal] = useState<TradeSignal | null>(null);
  const [allResults, setAllResults] = useState<LiveSignal[]>([]);
  const [filteredResults, setFilteredResults] = useState<LiveSignal[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Simulated progress state
  const [simProgress, setSimProgress] = useState(0);
  const [simSymbol, setSimSymbol] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [finalizing, setFinalizing] = useState(false);

  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buys = filteredResults.filter(s => s.signal.includes('BUY'));
  const sells = filteredResults.filter(s => s.signal.includes('SELL'));
  const neutral = filteredResults.filter(s => s.signal === 'NEUTRAL');

  // Start simulated progress ticker
  const startSim = useCallback(() => {
    let step = 0;
    setSimProgress(0);
    setSimSymbol(NIFTY50_NAMES[0]);
    setElapsed(0);
    setFinalizing(false);

    simRef.current = setInterval(() => {
      step = Math.min(step + 1, NIFTY50_NAMES.length - 1);
      setSimProgress(step);
      setSimSymbol(NIFTY50_NAMES[step]);
      // Stop advancing at 95% — hold there until real data arrives
      if (step >= NIFTY50_NAMES.length - 1 && simRef.current) {
        clearInterval(simRef.current);
        simRef.current = null;
      }
    }, 80); // 80ms per stock → ~4s for 50 stocks

    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  }, []);

  const stopSim = useCallback(() => {
    if (simRef.current) { clearInterval(simRef.current); simRef.current = null; }
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
  }, []);

  // Cleanup on unmount
  useEffect(() => () => { stopSim(); }, [stopSim]);

  const scanAll = useCallback(async () => {
    setScanning(true);
    setScanned(false);
    setScanError(null);
    setAllResults([]);
    setFilteredResults([]);
    startSim();

    try {
      const res = await fetch('/api/signals/scanner/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: 'FIFTEEN_MINUTE', minConfidence: 40 }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Scan failed');

      // Snap progress to done and show finalizing briefly
      stopSim();
      setSimProgress(NIFTY50_NAMES.length);
      setSimSymbol('');
      setFinalizing(true);

      await new Promise(r => setTimeout(r, 600)); // brief "Finalizing..." display

      const mapped: LiveSignal[] = (json.results ?? []).map(mapBackendSignal);
      setAllResults(mapped);
      setFilteredResults(applyScreenerFilter(mapped, activeFilter));
      setScanned(true);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed. Check connection.');
    } finally {
      stopSim();
      setFinalizing(false);
      setScanning(false);
    }
  }, [activeFilter, startSim, stopSim]);

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
      <div className="px-4 flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <ScanLine size={18} className="text-accent" /> Smart Scanner
        </h1>
        {scanned && !scanning && scanMode === 'batch' && (
          <button onClick={exportCSV} className="p-2 rounded-xl bg-input border border-border text-muted-foreground" title="Copy CSV">
            <Download size={14} />
          </button>
        )}
      </div>

      {/* Mode tabs */}
      <div className="px-4 mb-3 flex gap-2">
        <button
          onClick={() => setScanMode('batch')}
          className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
            scanMode === 'batch'
              ? 'bg-accent text-background border-accent'
              : 'bg-input text-muted-foreground border-border'
          }`}
        >
          <ScanLine size={13} /> NIFTY50 Batch Scan
        </button>
        <button
          onClick={() => setScanMode('custom')}
          className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${
            scanMode === 'custom'
              ? 'bg-accent text-background border-accent'
              : 'bg-input text-muted-foreground border-border'
          }`}
        >
          <Search size={13} /> Any Stock / F&O
        </button>
      </div>

      {/* Custom scan mode */}
      {scanMode === 'custom' && <CustomStockScan onTrade={setTradeSignal} />}

      {/* Batch scan mode — filter chips + scan button + results */}
      {scanMode === 'batch' && <>

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
              Scanning {simProgress}/{NIFTY50_NAMES.length}
              {simSymbol ? ` — ${simSymbol}` : ''}
            </>
          ) : (
            <>
              <ScanLine size={16} />
              {scanned ? 'Re-Scan (Live Data)' : 'Scan All 50 Stocks — Live Data'}
            </>
          )}
        </button>

        {scanError && (
          <div className="mt-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
            {scanError}
          </div>
        )}
      </div>

      {/* Content area */}
      <AnimatePresence mode="wait">
        {/* Progress panel while scanning */}
        {scanning && (
          <motion.div
            key="scanning"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          >
            <ScanProgressPanel
              progress={simProgress}
              total={NIFTY50_NAMES.length}
              currentSymbol={simSymbol}
              elapsed={elapsed}
              finalizing={finalizing}
            />
          </motion.div>
        )}

        {/* Final results */}
        {scanned && !scanning && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 space-y-4"
          >
            {buys.length > 0 && (
              <div>
                <p className="text-xs font-bold text-primary mb-2 flex items-center gap-1">
                  <TrendingUp size={12} /> BUY Signals ({buys.length})
                </p>
                <div className="space-y-2">
                  {buys.sort((a, b) => b.score - a.score).map(s => (
                    <ResultCard key={s.id} signal={s} onClick={() => navigate(`/charts?symbol=${s.symbol}`)} onTrade={() => setTradeSignal({ symbol: s.symbol, symbolToken: s.symbolToken ?? "", exchange: s.exchange, signal: s.signal, entry: s.currentPrice, stopLoss: s.tradeSetup.stopLoss, target1: s.tradeSetup.target1, target2: s.tradeSetup.target2, confidence: s.confidence, riskReward: s.tradeSetup.riskRewardRatio })} />
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
                    <ResultCard key={s.id} signal={s} onClick={() => navigate(`/charts?symbol=${s.symbol}`)} onTrade={() => setTradeSignal({ symbol: s.symbol, symbolToken: s.symbolToken ?? "", exchange: s.exchange, signal: s.signal, entry: s.currentPrice, stopLoss: s.tradeSetup.stopLoss, target1: s.tradeSetup.target1, target2: s.tradeSetup.target2, confidence: s.confidence, riskReward: s.tradeSetup.riskRewardRatio })} />
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
                    <ResultCard key={s.id} signal={s} onClick={() => navigate(`/charts?symbol=${s.symbol}`)} onTrade={() => setTradeSignal({ symbol: s.symbol, symbolToken: s.symbolToken ?? "", exchange: s.exchange, signal: s.signal, entry: s.currentPrice, stopLoss: s.tradeSetup.stopLoss, target1: s.tradeSetup.target1, target2: s.tradeSetup.target2, confidence: s.confidence, riskReward: s.tradeSetup.riskRewardRatio })} />
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
          </motion.div>
        )}

        {/* Empty state */}
        {!scanned && !scanning && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16 text-muted-foreground px-8"
          >
            <ScanLine size={40} className="mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Scan NIFTY 50 with live Angel One data</p>
            <p className="text-xs mt-2 leading-relaxed">
              Fetches real 15-min candles · Runs 25+ indicators<br />
              Filters BUY signals, breakouts, volume spikes & more
            </p>
          </motion.div>
        )}
      </AnimatePresence>
      </>}

      {/* Trade execution flow — modal + active trade window */}
      <TradeFlow signal={tradeSignal} onDismiss={() => setTradeSignal(null)} />
    </div>
  );
}
