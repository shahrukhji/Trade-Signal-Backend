import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine, Download, TrendingUp, TrendingDown, Minus, Activity,
  CheckCircle, Loader2, Search, Zap, Target, ShieldAlert, Brain,
  CheckCircle2, XCircle, GitCompare, ChevronDown, ChevronUp, X,
} from 'lucide-react';
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
    id, symbol: String(r.symbol ?? '').replace('-EQ', ''),
    stockName: String(r.symbol ?? '').replace('-EQ', ''),
    exchange: r.exchange ?? 'NSE', symbolToken: r.symboltoken ?? r.symbolToken ?? '',
    timeframe: '15m', timestamp: Date.now(), signal: r.signal, signalEmoji,
    score: Number(r.score ?? 0), maxPossibleScore: 20,
    confidence: Number(r.confidence ?? 0), currentPrice: price,
    tradeSetup: {
      entry: price, stopLoss: r.stopLoss ?? price * (isBuy ? 0.98 : 1.02),
      target1: r.target1 ?? price * (isBuy ? 1.03 : 0.97),
      target2: r.target2 ?? price * (isBuy ? 1.06 : 0.94),
      target3: price * (isBuy ? 1.10 : 0.90),
      riskPerShare: Math.abs(price - (r.stopLoss ?? price * 0.98)),
      rewardPerShare: Math.abs((r.target1 ?? price * 1.03) - price),
      riskRewardRatio: r.riskReward ?? 1,
      positionSizeForRisk: (cap: number) => Math.floor(cap / Math.max(1, Math.abs(price - (r.stopLoss ?? price * 0.98)))),
    },
    reasons: (r.reasons ?? []).map((text: string) => ({
      indicator: text.split(' ')[0] ?? 'IND', value: '',
      interpretation: text,
      type: (isBuy ? 'bullish' : isSell ? 'bearish' : 'neutral') as 'bullish' | 'bearish' | 'neutral',
      score: isBuy ? 1 : isSell ? -1 : 0, icon: isBuy ? '📈' : isSell ? '📉' : '➡️',
    })),
    bullishReasons: [], bearishReasons: [], neutralReasons: [],
    detectedPatterns: [], candlePatterns: [], chartPatterns: [],
    indicators: {
      rsi: r.indicators?.rsi?.value ?? 50,
      macd: { line: 0, signal: 0, histogram: 0, crossover: 'NEUTRAL' },
      ema9: 0, ema21: 0, ema50: 0, ema200: 0, sma20: 0, sma50: 0, sma200: 0,
      supertrend: { signal: 'NEUTRAL', value: 0 },
      bollinger: { upper: 0, middle: 0, lower: 0, percentB: 0, bandwidth: 0 },
      stochastic: { k: 50, d: 50 }, adx: { adx: 0, plusDI: 0, minusDI: 0 },
      atr: 0, vwap: 0, obv: 0, cci: 0, williamsR: 0, mfi: 0,
      parabolicSar: { value: 0, signal: 'NEUTRAL' },
      volume: { current: 0, average: 0, ratio: 1, trend: 'NEUTRAL' },
      pivots: { pivot: 0, r1: 0, r2: 0, r3: 0, s1: 0, s2: 0, s3: 0 },
      supports: [], resistances: [],
    },
    volumeAnalysis: '', rsiDivergence: 'NONE',
    trendDirection: isBuy ? 'UPTREND' : isSell ? 'DOWNTREND' : 'SIDEWAYS',
    trendStrength: Number(r.confidence) >= 70 ? 'STRONG' : Number(r.confidence) >= 50 ? 'MODERATE' : 'WEAK',
    summary: (r.reasons ?? []).slice(0, 2).join('. ') || `${r.signal} signal`,
    status: 'active',
  };
}

function SignalBadge({ sig, small }: { sig: string; small?: boolean }) {
  const isBuy = sig.includes('BUY');
  const isSell = sig.includes('SELL');
  const size = small ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5';
  return (
    <span className={`${size} rounded-full border font-bold ${
      isBuy ? 'text-primary bg-primary/10 border-primary/20' :
      isSell ? 'text-destructive bg-destructive/10 border-destructive/20' :
      'text-muted-foreground bg-input border-border'
    }`}>
      {isBuy ? '🟢' : isSell ? '🔴' : '⚪'} {sig.replace(/_/g, ' ')}
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

// ─── AI Cross Verify Panel (side by side) ─────────────────────────────────────
interface CrossVerifyResult {
  symbol: string;
  price: number;
  interval: string;
  algo: {
    signal: string; score: number; confidence: number; reasons: string[];
    entry: number; target1: number; target2: number; stopLoss: number; riskReward: number;
  };
  ai: {
    aiSignal: string; aiConfidence: number; aiEntry: number; aiTarget1: number;
    aiTarget2: number; aiStopLoss: number; aiRiskReward: number;
    agreementScore: number; verdict: 'CONFIRMED' | 'DISPUTED' | 'PARTIAL';
    consensusSignal: string; consensusConfidence: number;
    aiReasoning: string[]; conflicts: string[];
    riskFactors: string[]; chartReading: string; tradeRecommendation: string;
  };
  patterns: { candlestick: string[]; chart: string[] };
}

function AICrossVerifyPanel({ result, onTrade, onClose }: {
  result: CrossVerifyResult;
  onTrade?: () => void;
  onClose?: () => void;
}) {
  const { algo, ai } = result;
  const [showAlgoReasons, setShowAlgoReasons] = useState(false);
  const [showAIReasons, setShowAIReasons] = useState(false);

  const verdictConfig = {
    CONFIRMED: { color: 'text-primary', bg: 'bg-primary/10 border-primary/30', icon: <CheckCircle2 size={14} className="text-primary" />, label: 'CONFIRMED' },
    DISPUTED: { color: 'text-destructive', bg: 'bg-destructive/10 border-destructive/30', icon: <XCircle size={14} className="text-destructive" />, label: 'DISPUTED' },
    PARTIAL: { color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/30', icon: <GitCompare size={14} className="text-yellow-400" />, label: 'PARTIAL' },
  }[ai.verdict] ?? { color: 'text-muted-foreground', bg: 'bg-input border-border', icon: null, label: ai.verdict };

  const agreeColor = ai.agreementScore >= 70 ? '#00FF88' : ai.agreementScore >= 50 ? '#FFD700' : '#FF3366';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Panel header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-accent/20 flex items-center justify-center">
            <GitCompare size={13} className="text-accent" />
          </div>
          <div>
            <p className="text-xs font-black text-foreground">Algo vs Gemini AI</p>
            <p className="text-[10px] text-muted-foreground">{result.symbol} · 15-min candles</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-black ${verdictConfig.bg} ${verdictConfig.color}`}>
            {verdictConfig.icon}
            {verdictConfig.label}
          </div>
          {onClose && (
            <button onClick={onClose} className="w-6 h-6 rounded-full bg-input border border-border flex items-center justify-center text-muted-foreground active:scale-90 transition-transform">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Side by side — Algo | AI */}
      <div className="grid grid-cols-2 gap-2">
        {/* Left: Algo Engine */}
        <div className="glass-panel border border-border rounded-2xl p-3 space-y-2">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-lg bg-accent/20 flex items-center justify-center flex-shrink-0">
              <Zap size={10} className="text-accent" />
            </div>
            <p className="text-[10px] font-black text-accent tracking-wide">ALGO ENGINE</p>
          </div>

          <SignalBadge sig={algo.signal} small />

          <div className="flex items-center justify-between mt-1">
            <div>
              <p className="text-[9px] text-muted-foreground">Confidence</p>
              <p className="text-base font-black font-mono text-foreground">{algo.confidence}%</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground">Score</p>
              <p className="text-base font-black font-mono text-accent">{algo.score > 0 ? '+' : ''}{algo.score}</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[9px]">
              <span className="text-muted-foreground">Entry</span>
              <span className="font-mono font-bold text-foreground">{fmtINR(algo.entry)}</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-destructive/80">Stop Loss</span>
              <span className="font-mono font-bold text-destructive">{fmtINR(algo.stopLoss)}</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-primary/80">Target 1</span>
              <span className="font-mono font-bold text-primary">{fmtINR(algo.target1)}</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-muted-foreground">R:R</span>
              <span className="font-mono font-bold text-foreground">{algo.riskReward?.toFixed(2)}</span>
            </div>
          </div>

          {/* Algo reasons collapsible */}
          {algo.reasons.length > 0 && (
            <div>
              <button
                onClick={() => setShowAlgoReasons(v => !v)}
                className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1 active:opacity-60"
              >
                {showAlgoReasons ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                {algo.reasons.length} reasons
              </button>
              <AnimatePresence>
                {showAlgoReasons && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-1 space-y-0.5"
                  >
                    {algo.reasons.slice(0, 6).map((r, i) => {
                      const isPos = r.includes('(+');
                      const isNeg = r.includes('(-');
                      return (
                        <div key={i} className={`text-[9px] px-1.5 py-0.5 rounded ${
                          isPos ? 'text-primary bg-primary/5' : isNeg ? 'text-destructive bg-destructive/5' : 'text-muted-foreground bg-input/50'
                        }`}>
                          {isPos ? '▲' : isNeg ? '▼' : '—'} {r.slice(0, 40)}
                        </div>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Right: Gemini AI */}
        <div className="glass-panel border border-accent/20 rounded-2xl p-3 space-y-2 relative">
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-5 h-5 rounded-lg bg-violet-500/20 flex items-center justify-center flex-shrink-0">
              <Brain size={10} className="text-violet-400" />
            </div>
            <p className="text-[10px] font-black text-violet-400 tracking-wide">GEMINI AI</p>
          </div>

          <SignalBadge sig={ai.aiSignal} small />

          <div className="flex items-center justify-between mt-1">
            <div>
              <p className="text-[9px] text-muted-foreground">Confidence</p>
              <p className="text-base font-black font-mono text-foreground">{ai.aiConfidence}%</p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-muted-foreground">Agreement</p>
              <p className="text-base font-black font-mono" style={{ color: agreeColor }}>{ai.agreementScore}%</p>
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between text-[9px]">
              <span className="text-muted-foreground">Entry</span>
              <span className="font-mono font-bold text-foreground">{fmtINR(ai.aiEntry)}</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-destructive/80">Stop Loss</span>
              <span className="font-mono font-bold text-destructive">{fmtINR(ai.aiStopLoss)}</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-primary/80">Target 1</span>
              <span className="font-mono font-bold text-primary">{fmtINR(ai.aiTarget1)}</span>
            </div>
            <div className="flex justify-between text-[9px]">
              <span className="text-muted-foreground">R:R</span>
              <span className="font-mono font-bold text-foreground">{ai.aiRiskReward?.toFixed(2)}</span>
            </div>
          </div>

          {/* AI reasoning collapsible */}
          {ai.aiReasoning?.length > 0 && (
            <div>
              <button
                onClick={() => setShowAIReasons(v => !v)}
                className="flex items-center gap-1 text-[9px] text-muted-foreground mt-1 active:opacity-60"
              >
                {showAIReasons ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                {ai.aiReasoning.length} AI reasons
              </button>
              <AnimatePresence>
                {showAIReasons && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-1 space-y-0.5"
                  >
                    {ai.aiReasoning.slice(0, 5).map((r, i) => (
                      <div key={i} className="text-[9px] px-1.5 py-0.5 rounded text-violet-300 bg-violet-500/5">
                        {i + 1}. {r.slice(0, 50)}
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* Agreement bar */}
      <div className="glass-panel border border-border rounded-xl p-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] font-bold text-muted-foreground">Agreement Score</p>
          <p className="text-xs font-black font-mono" style={{ color: agreeColor }}>{ai.agreementScore}%</p>
        </div>
        <div className="h-2 bg-input rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${ai.agreementScore}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${agreeColor}80, ${agreeColor})` }}
          />
        </div>
        <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
          <span>Algo Signal</span>
          <SignalBadge sig={algo.signal} small />
          <span>AI Signal</span>
          <SignalBadge sig={ai.aiSignal} small />
        </div>
      </div>

      {/* Consensus */}
      <div className={`glass-panel border rounded-2xl p-3 ${verdictConfig.bg}`}>
        <div className="flex items-center gap-2 mb-2">
          {verdictConfig.icon}
          <p className={`text-xs font-black ${verdictConfig.color}`}>
            CONSENSUS · {ai.consensusConfidence}% confidence
          </p>
          <div className="ml-auto">
            <SignalBadge sig={ai.consensusSignal} small />
          </div>
        </div>
        {ai.chartReading && (
          <p className="text-[10px] text-muted-foreground leading-relaxed mb-1.5">{ai.chartReading}</p>
        )}
        {ai.tradeRecommendation && (
          <p className="text-[10px] font-bold text-foreground leading-relaxed">{ai.tradeRecommendation}</p>
        )}
      </div>

      {/* Conflicts & Risks */}
      {(ai.conflicts?.length > 0 || ai.riskFactors?.length > 0) && (
        <div className="glass-panel border border-border rounded-2xl p-3 space-y-1.5">
          {ai.conflicts?.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-yellow-400 mb-1">⚠ Conflicts</p>
              {ai.conflicts.map((c, i) => (
                <p key={i} className="text-[9px] text-yellow-300/80 bg-yellow-500/5 px-1.5 py-0.5 rounded mb-0.5">{c}</p>
              ))}
            </div>
          )}
          {ai.riskFactors?.length > 0 && (
            <div>
              <p className="text-[9px] font-bold text-destructive mb-1">🚨 Risk Factors</p>
              {ai.riskFactors.map((r, i) => (
                <p key={i} className="text-[9px] text-destructive/80 bg-destructive/5 px-1.5 py-0.5 rounded mb-0.5">{r}</p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Patterns */}
      {(result.patterns.candlestick.length > 0 || result.patterns.chart.length > 0) && (
        <div className="flex flex-wrap gap-1">
          {result.patterns.candlestick.map(p => (
            <span key={p} className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent">🕯 {p}</span>
          ))}
          {result.patterns.chart.map(p => (
            <span key={p} className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-400">📐 {p}</span>
          ))}
        </div>
      )}

      {/* Trade button */}
      {onTrade && !['NEUTRAL', 'WEAK_BUY', 'WEAK_SELL'].includes(ai.consensusSignal) && (
        <button
          onClick={onTrade}
          className="w-full py-3 rounded-2xl bg-accent text-background font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
        >
          <Zap size={15} /> Execute on Consensus Signal
        </button>
      )}
    </motion.div>
  );
}

// ─── Scanning progress panel ───────────────────────────────────────────────────
function ScanProgressPanel({ progress, total, currentSymbol, elapsed, finalizing }: {
  progress: number; total: number; currentSymbol: string; elapsed: number; finalizing: boolean;
}) {
  const pct = finalizing ? 100 : (total > 0 ? Math.round((progress / total) * 100) : 0);
  return (
    <div className="px-4 space-y-4">
      <div className="glass-panel border border-accent/30 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-xs font-bold text-accent">{finalizing ? 'FINALIZING...' : 'LIVE SCANNING'}</span>
          </div>
          <span className="text-xs text-muted-foreground font-mono">{elapsed}s</span>
        </div>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center font-bold text-accent text-base flex-shrink-0" style={{ animation: 'pulse 1s ease-in-out infinite' }}>
            {currentSymbol ? currentSymbol[0] : '?'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground">{finalizing ? 'Processing results' : 'Analyzing'}</p>
            <p className="text-sm font-bold text-foreground font-mono truncate">{finalizing ? 'Sorting signals...' : (currentSymbol || 'Initializing...')}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-black text-accent font-mono leading-none">{pct}%</p>
            <p className="text-[10px] text-muted-foreground">{progress}/{total}</p>
          </div>
        </div>
        <div className="h-3 bg-input rounded-full overflow-hidden mb-3">
          <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #00C896, #00FF88)' }}
            animate={{ width: `${pct}%` }} transition={{ duration: 0.35, ease: 'easeOut' }} />
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          {finalizing ? 'Applying filters · Sorting by signal strength' : `Fetching candles · Running 25+ indicators · Detecting patterns`}
        </p>
      </div>
      {!finalizing && progress > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
            <Activity size={11} className="text-accent" /> Stocks scanned
          </p>
          <div className="space-y-1 max-h-52 overflow-hidden relative">
            {NIFTY50_NAMES.slice(Math.max(0, progress - 6), progress).reverse().map((name, i) => (
              <motion.div key={name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: i === 0 ? 1 : 0.4 - i * 0.05, x: 0 }}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border ${i === 0 ? 'bg-accent/10 border-accent/30' : 'bg-input/40 border-border/50'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[9px] flex-shrink-0 ${i === 0 ? 'bg-accent text-background' : 'bg-muted text-muted-foreground'}`}>
                  {name[0]}
                </div>
                <span className={`font-mono text-xs font-bold flex-1 ${i === 0 ? 'text-foreground' : 'text-muted-foreground'}`}>{name}</span>
                {i === 0 ? <Loader2 size={11} className="animate-spin text-accent" /> : <CheckCircle size={11} className="text-primary/60" />}
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom single-stock scan ──────────────────────────────────────────────────
function CustomStockScan({ onTrade }: { onTrade: (sig: TradeSignal) => void }) {
  const [, navigate] = useLocation();
  const [selected, setSelected] = useState<StockSearchResult | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  // AI cross-verify state
  const [aiVerifying, setAiVerifying] = useState(false);
  const [aiResult, setAiResult] = useState<CrossVerifyResult | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    if (!selected) return;
    setScanning(true);
    setResult(null);
    setError(null);
    setAiResult(null);
    setAiError(null);
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

  const runAICrossVerify = useCallback(async () => {
    if (!selected) return;
    setAiVerifying(true);
    setAiError(null);
    setAiResult(null);
    try {
      const res = await fetch(`${BASE}/api/ai/cross-verify`, {
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
      if (!json.success) throw new Error(json.error ?? 'Cross-verify failed');
      setAiResult(json);
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'AI cross-verify failed');
    } finally {
      setAiVerifying(false);
    }
  }, [selected]);

  const sig = result?.signal ?? '';
  const isBuy = sig.includes('BUY');
  const isSell = sig.includes('SELL');
  const signalColor = isBuy ? 'text-primary' : isSell ? 'text-destructive' : 'text-muted-foreground';
  const signalBg = isBuy ? 'bg-primary/10 border-primary/20' : isSell ? 'bg-destructive/10 border-destructive/20' : 'bg-input border-border';

  return (
    <div className="px-4 space-y-3">
      <StockSearch
        onSelectStock={s => { setSelected(s); setResult(null); setError(null); setAiResult(null); setAiError(null); }}
        placeholder="Search any stock, F&O, commodity..."
      />

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

      {scanning && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel border border-accent/30 rounded-2xl p-4 text-center">
          <Loader2 size={28} className="animate-spin text-accent mx-auto mb-2" />
          <p className="text-sm font-bold text-foreground">Analyzing {selected?.tradingSymbol}</p>
          <p className="text-xs text-muted-foreground mt-1">Running 20 signal algos · Fetching live 15m candles</p>
          <div className="mt-3 h-1.5 bg-input rounded-full overflow-hidden">
            <motion.div className="h-full bg-accent rounded-full"
              animate={{ width: ['0%', '90%'] }} transition={{ duration: 3, ease: 'easeOut' }} />
          </div>
        </motion.div>
      )}

      {/* ─── Deep signal result + AI Cross Verify side by side ─── */}
      {result && !scanning && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {/* If AI result is available, show the full side-by-side panel */}
          {aiResult ? (
            <AICrossVerifyPanel
              result={aiResult}
              onClose={() => setAiResult(null)}
              onTrade={() => onTrade({
                symbol: selected?.tradingSymbol ?? '',
                symbolToken: selected?.symbolToken ?? '',
                exchange: selected?.exchange ?? 'NSE',
                companyName: selected?.companyName,
                signal: aiResult.ai.consensusSignal,
                entry: aiResult.ai.aiEntry || result.entry || 0,
                stopLoss: aiResult.ai.aiStopLoss || result.stopLoss || 0,
                target1: aiResult.ai.aiTarget1 || result.target1 || 0,
                target2: aiResult.ai.aiTarget2,
                confidence: aiResult.ai.consensusConfidence,
                riskReward: aiResult.ai.aiRiskReward,
              })}
            />
          ) : (
            <>
              {/* Original deep signal result */}
              <div className={`glass-panel border rounded-2xl p-4 ${signalBg}`}>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Deep Signal</p>
                    <p className={`text-xl font-black font-mono ${signalColor}`}>
                      {isBuy ? '🟢' : isSell ? '🔴' : '⚪'} {sig.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Confidence</p>
                    <p className={`text-2xl font-black font-mono ${signalColor}`}>{result.confidence}%</p>
                  </div>
                </div>
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

              {/* AI verify error */}
              {aiError && (
                <div className="px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
                  AI: {aiError}
                </div>
              )}

              {/* Action buttons */}
              <div className="space-y-2">
                {/* AI Cross Verify — primary CTA */}
                <button
                  onClick={runAICrossVerify}
                  disabled={aiVerifying}
                  className="w-full py-3 rounded-2xl bg-violet-600 text-white font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
                >
                  {aiVerifying ? (
                    <><Loader2 size={15} className="animate-spin" /> Gemini AI Analyzing...</>
                  ) : (
                    <><Brain size={15} /> AI Cross Verify — Compare Both</>
                  )}
                </button>

                {aiVerifying && (
                  <div className="glass-panel border border-violet-500/30 rounded-xl p-3 text-center">
                    <p className="text-xs text-violet-400 font-bold">Gemini AI is independently analyzing {selected?.tradingSymbol}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Fetching live candles · Running AI cross-check · Building comparison</p>
                    <div className="mt-2 h-1 bg-input rounded-full overflow-hidden">
                      <motion.div className="h-full bg-violet-500 rounded-full"
                        animate={{ width: ['0%', '85%'] }} transition={{ duration: 12, ease: 'easeOut' }} />
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  {sig !== 'NEUTRAL' && (
                    <button
                      onClick={() => onTrade({
                        symbol: selected?.tradingSymbol ?? '',
                        symbolToken: selected?.symbolToken ?? '',
                        exchange: selected?.exchange ?? 'NSE',
                        companyName: selected?.companyName,
                        signal: sig, entry: result.entry ?? 0,
                        stopLoss: result.stopLoss ?? 0, target1: result.target1 ?? 0,
                        target2: result.target2, confidence: result.confidence ?? 0,
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
                    onClick={() => { setResult(null); setAiResult(null); }}
                    className="px-4 py-3 rounded-xl bg-input border border-border text-muted-foreground font-bold text-sm active:scale-95 transition-all"
                  >
                    ↺
                  </button>
                </div>
              </div>
            </>
          )}
        </motion.div>
      )}

      {error && (
        <div className="px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">{error}</div>
      )}

      {!selected && !scanning && !result && (
        <div className="text-center py-10 text-muted-foreground px-4">
          <Search size={36} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Search any stock or commodity</p>
          <p className="text-xs mt-2 leading-relaxed">
            NSE · BSE · MCX · F&O · Indices<br />
            Runs 20 signal algos on real 15-min candles<br />
            <span className="text-violet-400">+ Gemini AI cross-verification</span>
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Batch result card with AI Verify ────────────────────────────────────────
function ResultCard({ signal, onClick, onTrade, onAIVerify }: {
  signal: LiveSignal;
  onClick: () => void;
  onTrade?: () => void;
  onAIVerify?: () => void;
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
            <span className="text-muted-foreground">{fmtINR(signal.currentPrice)} → SL {fmtINR(signal.tradeSetup.stopLoss)}</span>
            <span className="text-primary">T1 {fmtINR(signal.tradeSetup.target1)}</span>
          </div>
        )}
      </div>
      <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
        <ConfidenceRing value={signal.confidence} />
        <div className="flex gap-1">
          {onTrade && signal.signal !== 'NEUTRAL' && (
            <button
              onClick={e => { e.stopPropagation(); onTrade(); }}
              className="text-[9px] px-2 py-0.5 rounded-full bg-accent text-background font-black active:scale-90 transition-transform"
            >
              Trade
            </button>
          )}
          {onAIVerify && (
            <button
              onClick={e => { e.stopPropagation(); onAIVerify(); }}
              className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-600/20 border border-violet-500/30 text-violet-400 font-black active:scale-90 transition-transform"
              title="AI Cross Verify"
            >
              <Brain size={9} />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Batch AI verify bottom sheet ────────────────────────────────────────────
function BatchAIVerifySheet({ signal, onClose, onTrade }: {
  signal: LiveSignal;
  onClose: () => void;
  onTrade: (sig: TradeSignal) => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [result, setResult] = useState<CrossVerifyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      setVerifying(true);
      try {
        const res = await fetch(`${BASE}/api/ai/cross-verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: signal.symbol,
            symboltoken: signal.symbolToken,
            exchange: signal.exchange,
            interval: 'FIFTEEN_MINUTE',
          }),
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error ?? 'Cross-verify failed');
        setResult(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'AI verify failed');
      } finally {
        setVerifying(false);
      }
    };
    run();
  }, [signal]);

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col" style={{ background: 'rgba(0,0,0,0.7)' }}>
      <div className="flex-1" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="bg-background border-t border-border rounded-t-3xl max-h-[88vh] overflow-y-auto no-scrollbar"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        <div className="px-4 pb-8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-base font-black text-foreground flex items-center gap-2">
                <Brain size={16} className="text-violet-400" /> AI Cross Verify
              </p>
              <p className="text-xs text-muted-foreground">{signal.symbol} · Algo vs Gemini AI</p>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-input border border-border flex items-center justify-center active:scale-90 transition-transform">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>

          {verifying && (
            <div className="glass-panel border border-violet-500/30 rounded-2xl p-6 text-center">
              <div className="relative w-12 h-12 mx-auto mb-3">
                <Brain size={48} className="text-violet-400 opacity-20" />
                <Loader2 size={48} className="animate-spin text-violet-400 absolute inset-0" />
              </div>
              <p className="text-sm font-bold text-violet-300">Gemini AI analyzing {signal.symbol}...</p>
              <p className="text-xs text-muted-foreground mt-1">Fetching candles · Cross-checking 20 indicators · Building comparison</p>
              <div className="mt-4 h-1 bg-input rounded-full overflow-hidden">
                <motion.div className="h-full bg-violet-500 rounded-full"
                  animate={{ width: ['0%', '85%'] }} transition={{ duration: 15, ease: 'easeOut' }} />
              </div>
            </div>
          )}

          {error && (
            <div className="px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">{error}</div>
          )}

          {result && !verifying && (
            <AICrossVerifyPanel
              result={result}
              onTrade={() => {
                onTrade({
                  symbol: signal.symbol,
                  symbolToken: signal.symbolToken ?? '',
                  exchange: signal.exchange,
                  signal: result.ai.consensusSignal,
                  entry: result.ai.aiEntry || signal.currentPrice,
                  stopLoss: result.ai.aiStopLoss || signal.tradeSetup.stopLoss,
                  target1: result.ai.aiTarget1 || signal.tradeSetup.target1,
                  target2: result.ai.aiTarget2,
                  confidence: result.ai.consensusConfidence,
                  riskReward: result.ai.aiRiskReward,
                });
                onClose();
              }}
            />
          )}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
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
  const [aiVerifySignal, setAiVerifySignal] = useState<LiveSignal | null>(null);

  const [simProgress, setSimProgress] = useState(0);
  const [simSymbol, setSimSymbol] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [finalizing, setFinalizing] = useState(false);

  const simRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const buys = filteredResults.filter(s => s.signal.includes('BUY'));
  const sells = filteredResults.filter(s => s.signal.includes('SELL'));
  const neutral = filteredResults.filter(s => s.signal === 'NEUTRAL');

  const startSim = useCallback(() => {
    let step = 0;
    setSimProgress(0); setSimSymbol(NIFTY50_NAMES[0]); setElapsed(0); setFinalizing(false);
    simRef.current = setInterval(() => {
      step = Math.min(step + 1, NIFTY50_NAMES.length - 1);
      setSimProgress(step);
      setSimSymbol(NIFTY50_NAMES[step]);
      if (step >= NIFTY50_NAMES.length - 1 && simRef.current) { clearInterval(simRef.current); simRef.current = null; }
    }, 80);
    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
  }, []);

  const stopSim = useCallback(() => {
    if (simRef.current) { clearInterval(simRef.current); simRef.current = null; }
    if (elapsedRef.current) { clearInterval(elapsedRef.current); elapsedRef.current = null; }
  }, []);

  useEffect(() => () => { stopSim(); }, [stopSim]);

  const scanAll = useCallback(async () => {
    setScanning(true); setScanned(false); setScanError(null);
    setAllResults([]); setFilteredResults([]); startSim();
    try {
      const res = await fetch('/api/signals/scanner/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval: 'FIFTEEN_MINUTE', minConfidence: 40 }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Scan failed');
      stopSim();
      setSimProgress(NIFTY50_NAMES.length); setSimSymbol(''); setFinalizing(true);
      await new Promise(r => setTimeout(r, 600));
      const mapped: LiveSignal[] = (json.results ?? []).map(mapBackendSignal);
      setAllResults(mapped);
      setFilteredResults(applyScreenerFilter(mapped, activeFilter));
      setScanned(true);
    } catch (err) {
      setScanError(err instanceof Error ? err.message : 'Scan failed. Check connection.');
    } finally {
      stopSim(); setFinalizing(false); setScanning(false);
    }
  }, [activeFilter, startSim, stopSim]);

  const changeFilter = (id: string) => {
    setActiveFilter(id);
    if (allResults.length) setFilteredResults(applyScreenerFilter(allResults, id));
  };

  const exportCSV = () => {
    const rows = [
      ['Symbol', 'Signal', 'Score', 'Confidence', 'Price', 'SL', 'T1', 'R:R'],
      ...filteredResults.map(s => [s.symbol, s.signal, s.score, s.confidence, s.currentPrice, s.tradeSetup.stopLoss, s.tradeSetup.target1, s.tradeSetup.riskRewardRatio]),
    ];
    navigator.clipboard.writeText(rows.map(r => r.join(',')).join('\n')).catch(() => {});
  };

  const makeTradeSignal = (s: LiveSignal): TradeSignal => ({
    symbol: s.symbol, symbolToken: s.symbolToken ?? '',
    exchange: s.exchange, signal: s.signal,
    entry: s.currentPrice, stopLoss: s.tradeSetup.stopLoss,
    target1: s.tradeSetup.target1, target2: s.tradeSetup.target2,
    confidence: s.confidence, riskReward: s.tradeSetup.riskRewardRatio,
  });

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
          className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${scanMode === 'batch' ? 'bg-accent text-background border-accent' : 'bg-input text-muted-foreground border-border'}`}
        >
          <ScanLine size={13} /> NIFTY50 Batch Scan
        </button>
        <button
          onClick={() => setScanMode('custom')}
          className={`flex-1 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 border transition-all ${scanMode === 'custom' ? 'bg-accent text-background border-accent' : 'bg-input text-muted-foreground border-border'}`}
        >
          <Search size={13} /> Any Stock / F&O
        </button>
      </div>

      {scanMode === 'custom' && <CustomStockScan onTrade={setTradeSignal} />}

      {scanMode === 'batch' && <>
        <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
          <button onClick={() => changeFilter('all')} className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-bold transition-all ${activeFilter === 'all' ? 'bg-accent text-background border-accent' : 'bg-input border-border text-muted-foreground'}`}>All</button>
          {SCREENER_FILTERS.map(f => (
            <button key={f.id} onClick={() => changeFilter(f.id)}
              className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-bold whitespace-nowrap transition-all ${activeFilter === f.id ? 'bg-accent text-background border-accent' : 'bg-input border-border text-muted-foreground'}`}>
              {f.emoji} {f.name.split(' ').slice(0, 2).join(' ')}
            </button>
          ))}
        </div>

        <div className="px-4 mb-4">
          <button onClick={scanAll} disabled={scanning}
            className="w-full h-12 rounded-2xl bg-accent text-background font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60">
            {scanning ? (
              <><Activity size={16} className="animate-pulse" />Scanning {simProgress}/{NIFTY50_NAMES.length}{simSymbol ? ` — ${simSymbol}` : ''}</>
            ) : (
              <><ScanLine size={16} />{scanned ? 'Re-Scan (Live Data)' : 'Scan All 50 Stocks — Live Data'}</>
            )}
          </button>
          {scanError && (
            <div className="mt-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">{scanError}</div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {scanning && (
            <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.2 } }}>
              <ScanProgressPanel progress={simProgress} total={NIFTY50_NAMES.length} currentSymbol={simSymbol} elapsed={elapsed} finalizing={finalizing} />
            </motion.div>
          )}

          {scanned && !scanning && (
            <motion.div key="results" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-4 space-y-4">
              {/* AI Verify hint banner */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
                <Brain size={12} className="text-violet-400 flex-shrink-0" />
                <p className="text-[10px] text-violet-300">
                  Tap <span className="font-bold">🧠</span> on any result to run Gemini AI cross-verification
                </p>
              </div>

              {buys.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-primary mb-2 flex items-center gap-1"><TrendingUp size={12} /> BUY Signals ({buys.length})</p>
                  <div className="space-y-2">
                    {buys.sort((a, b) => b.score - a.score).map(s => (
                      <ResultCard key={s.id} signal={s}
                        onClick={() => navigate(`/charts?symbol=${s.symbol}`)}
                        onTrade={() => setTradeSignal(makeTradeSignal(s))}
                        onAIVerify={() => setAiVerifySignal(s)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {neutral.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1"><Minus size={12} /> Neutral ({neutral.length})</p>
                  <div className="space-y-2">
                    {neutral.slice(0, 5).map(s => (
                      <ResultCard key={s.id} signal={s}
                        onClick={() => navigate(`/charts?symbol=${s.symbol}`)}
                        onTrade={() => setTradeSignal(makeTradeSignal(s))}
                        onAIVerify={() => setAiVerifySignal(s)}
                      />
                    ))}
                    {neutral.length > 5 && <p className="text-xs text-muted-foreground text-center py-2">+{neutral.length - 5} more neutral...</p>}
                  </div>
                </div>
              )}

              {sells.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-destructive mb-2 flex items-center gap-1"><TrendingDown size={12} /> SELL Signals ({sells.length})</p>
                  <div className="space-y-2">
                    {sells.sort((a, b) => a.score - b.score).map(s => (
                      <ResultCard key={s.id} signal={s}
                        onClick={() => navigate(`/charts?symbol=${s.symbol}`)}
                        onTrade={() => setTradeSignal(makeTradeSignal(s))}
                        onAIVerify={() => setAiVerifySignal(s)}
                      />
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

          {!scanned && !scanning && (
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="text-center py-16 text-muted-foreground px-8">
              <ScanLine size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm font-medium">Scan NIFTY 50 with live Angel One data</p>
              <p className="text-xs mt-2 leading-relaxed">
                Fetches real 15-min candles · Runs 25+ indicators<br />
                Filters BUY signals, breakouts, volume spikes & more<br />
                <span className="text-violet-400">+ Gemini AI cross-verification on any result</span>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </>}

      {/* Trade execution flow */}
      <TradeFlow signal={tradeSignal} onDismiss={() => setTradeSignal(null)} />

      {/* Batch AI Verify bottom sheet */}
      <AnimatePresence>
        {aiVerifySignal && (
          <BatchAIVerifySheet
            key={aiVerifySignal.id}
            signal={aiVerifySignal}
            onClose={() => setAiVerifySignal(null)}
            onTrade={sig => { setTradeSignal(sig); setAiVerifySignal(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
