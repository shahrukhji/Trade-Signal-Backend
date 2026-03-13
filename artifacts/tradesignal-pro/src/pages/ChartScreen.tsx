import { useState, useCallback, useRef } from 'react';
import { Search, BrainCircuit, Activity, Plus, TrendingUp, TrendingDown, Sparkles, CheckCircle, XCircle, AlertCircle, ChevronDown, ChevronUp, X, Zap, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChartWidget } from '@/components/ChartWidget';
import { useMarketData, useIndicators, useSignalAnalysis } from '@/hooks/use-trading';
import { useToast } from '@/hooks/use-toast';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const SIGNAL_COLORS: Record<string, string> = {
  STRONG_BUY: 'text-primary', BUY: 'text-primary', WEAK_BUY: 'text-primary',
  NEUTRAL: 'text-muted-foreground',
  STRONG_SELL: 'text-destructive', SELL: 'text-destructive', WEAK_SELL: 'text-destructive',
};

const SIGNAL_BG: Record<string, string> = {
  STRONG_BUY: 'bg-primary/20 text-primary', BUY: 'bg-primary/20 text-primary', WEAK_BUY: 'bg-primary/10 text-primary',
  NEUTRAL: 'bg-muted text-muted-foreground',
  STRONG_SELL: 'bg-destructive/20 text-destructive', SELL: 'bg-destructive/20 text-destructive', WEAK_SELL: 'bg-destructive/10 text-destructive',
};

const SIGNAL_EMOJI: Record<string, string> = {
  STRONG_BUY: '🚀', BUY: '🟢', WEAK_BUY: '📈',
  NEUTRAL: '⚪',
  WEAK_SELL: '📉', SELL: '🔴', STRONG_SELL: '💥',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface CrossVerifyResult {
  symbol: string;
  price: number;
  interval: string;
  algo: {
    signal: string; score: number; confidence: number; reasons: string[];
    entry: number; target1: number; target2: number; target3: number;
    stopLoss: number; riskReward: number;
  };
  ai: {
    aiSignal: string; aiConfidence: number;
    aiEntry: number; aiTarget1: number; aiTarget2: number; aiTarget3: number;
    aiStopLoss: number; aiRiskReward: number;
    agreementScore: number; verdict: 'CONFIRMED' | 'DISPUTED' | 'PARTIAL';
    consensusSignal: string; consensusConfidence: number;
    aiReasoning: string[]; conflicts: string[]; riskFactors: string[];
    chartReading: string; tradeRecommendation: string;
  };
  patterns: { candlestick: string[]; chart: string[] };
  analyzedAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function VerdictBadge({ verdict }: { verdict: string }) {
  const cfg = {
    CONFIRMED: { icon: CheckCircle, color: 'text-primary bg-primary/10 border-primary/20', label: '✅ AI CONFIRMED' },
    DISPUTED:  { icon: XCircle,     color: 'text-destructive bg-destructive/10 border-destructive/20', label: '❌ AI DISPUTED' },
    PARTIAL:   { icon: AlertCircle, color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', label: '⚠️ PARTIAL MATCH' },
  }[verdict] ?? { icon: AlertCircle, color: 'text-muted-foreground bg-muted border-border', label: verdict };

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-xs font-bold ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function AgreementBar({ score }: { score: number }) {
  const color = score >= 70 ? '#00FF88' : score >= 40 ? '#FFD700' : '#FF3366';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">Agreement Score</span>
        <span className="font-bold font-mono" style={{ color }}>{score}%</span>
      </div>
      <div className="h-2 bg-input rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

// ─── AI Cross-Verify Modal ────────────────────────────────────────────────────

function CrossVerifyModal({ result, onClose, onExecute }: {
  result: CrossVerifyResult;
  onClose: () => void;
  onExecute: () => void;
}) {
  const [showAlgoDetails, setShowAlgoDetails] = useState(false);
  const [showAiDetails, setShowAiDetails] = useState(false);
  const { algo, ai, patterns } = result;
  const isBullishConsensus = ai.consensusSignal.includes('BUY');
  const isBearishConsensus = ai.consensusSignal.includes('SELL');

  return (
    <div className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-sm flex items-end justify-center">
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        className="w-full max-w-md bg-[#0D0D1A] border-t border-white/10 rounded-t-3xl overflow-y-auto max-h-[90vh]"
      >
        {/* Header */}
        <div className="sticky top-0 bg-[#0D0D1A] px-5 pt-5 pb-3 border-b border-border z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles size={18} className="text-accent" />
              <h2 className="text-base font-bold text-foreground">AI Cross-Verify</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg bg-input text-muted-foreground">
              <X size={16} />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {result.symbol.replace('-EQ', '')} · ₹{result.price.toFixed(2)} · {result.interval}
          </p>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Verdict + Agreement */}
          <div className="glass-panel rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <VerdictBadge verdict={ai.verdict} />
              <span className="text-xs text-muted-foreground">
                {new Date(result.analyzedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <AgreementBar score={ai.agreementScore} />
          </div>

          {/* Consensus — the final recommendation */}
          <div className={`rounded-2xl border p-4 ${
            isBullishConsensus ? 'bg-primary/5 border-primary/20' :
            isBearishConsensus ? 'bg-destructive/5 border-destructive/20' :
            'bg-muted/10 border-border'
          }`}>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Consensus Signal</p>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-lg font-extrabold font-mono ${
                  isBullishConsensus ? 'text-primary' : isBearishConsensus ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {SIGNAL_EMOJI[ai.consensusSignal] || '⚪'} {ai.consensusSignal.replace('_', ' ')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{ai.consensusConfidence}% consensus confidence</p>
              </div>
              <div className="text-right text-xs font-mono">
                <p className="text-muted-foreground">R:R</p>
                <p className="font-bold text-foreground">1:{(ai.aiRiskReward ?? algo.riskReward).toFixed(1)}</p>
              </div>
            </div>
            {ai.tradeRecommendation && (
              <p className="text-xs mt-3 text-foreground/80 leading-relaxed border-t border-border/50 pt-3">
                {ai.tradeRecommendation}
              </p>
            )}
          </div>

          {/* Trade levels — consensus of algo + AI */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Entry', algo: algo.entry, ai_: ai.aiEntry, colorClass: 'text-foreground' },
              { label: 'Target 1', algo: algo.target1, ai_: ai.aiTarget1, colorClass: 'text-primary' },
              { label: 'Stop Loss', algo: algo.stopLoss, ai_: ai.aiStopLoss, colorClass: 'text-destructive' },
            ].map(row => (
              <div key={row.label} className="bg-input/60 rounded-xl p-2.5">
                <p className="text-[9px] text-muted-foreground mb-1">{row.label}</p>
                <p className={`font-mono font-bold text-xs ${row.colorClass}`}>₹{(row.ai_ || row.algo).toFixed(0)}</p>
                {row.ai_ && Math.abs(row.ai_ - row.algo) > 0.5 && (
                  <p className="text-[8px] text-muted-foreground mt-0.5">
                    Algo: ₹{row.algo.toFixed(0)}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Chart Reading (Gemini's natural language) */}
          {ai.chartReading && (
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-3">
              <p className="text-[10px] text-accent uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <Sparkles size={9} /> Gemini Chart Reading
              </p>
              <p className="text-xs text-foreground/90 leading-relaxed">{ai.chartReading}</p>
            </div>
          )}

          {/* Side-by-side: Algo vs AI signals */}
          <div className="grid grid-cols-2 gap-3">
            {/* Algo Engine */}
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="text-[9px] text-muted-foreground uppercase mb-2 flex items-center gap-1">
                <BrainCircuit size={9} /> 20-Algo Engine
              </p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${SIGNAL_BG[algo.signal] || 'bg-muted text-muted-foreground'}`}>
                {SIGNAL_EMOJI[algo.signal]} {algo.signal.replace('_', ' ')}
              </span>
              <p className="text-[10px] text-muted-foreground mt-1.5">Conf: <span className="text-foreground font-mono">{algo.confidence}%</span></p>
              <p className="text-[10px] text-muted-foreground">Score: <span className="text-foreground font-mono">{algo.score > 0 ? '+' : ''}{algo.score}</span></p>

              <button
                onClick={() => setShowAlgoDetails(!showAlgoDetails)}
                className="text-[9px] text-accent mt-2 flex items-center gap-0.5"
              >
                {showAlgoDetails ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                {showAlgoDetails ? 'Hide' : 'Show'} reasons
              </button>
              <AnimatePresence>
                {showAlgoDetails && (
                  <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-2 space-y-1"
                  >
                    {algo.reasons.slice(0, 8).map((r, i) => (
                      <li key={i} className={`text-[9px] ${r.includes('+') ? 'text-primary' : r.includes('-') ? 'text-destructive' : 'text-muted-foreground'}`}>
                        • {r}
                      </li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>

            {/* Gemini AI */}
            <div className="bg-card border border-accent/20 rounded-xl p-3">
              <p className="text-[9px] text-accent uppercase mb-2 flex items-center gap-1">
                <Sparkles size={9} /> Gemini AI
              </p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded ${SIGNAL_BG[ai.aiSignal] || 'bg-muted text-muted-foreground'}`}>
                {SIGNAL_EMOJI[ai.aiSignal]} {ai.aiSignal?.replace('_', ' ')}
              </span>
              <p className="text-[10px] text-muted-foreground mt-1.5">Conf: <span className="text-foreground font-mono">{ai.aiConfidence}%</span></p>
              <p className="text-[10px] text-muted-foreground">Model: <span className="text-foreground font-mono">Flash</span></p>

              <button
                onClick={() => setShowAiDetails(!showAiDetails)}
                className="text-[9px] text-accent mt-2 flex items-center gap-0.5"
              >
                {showAiDetails ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
                {showAiDetails ? 'Hide' : 'Show'} reasoning
              </button>
              <AnimatePresence>
                {showAiDetails && (
                  <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden mt-2 space-y-1"
                  >
                    {(ai.aiReasoning ?? []).slice(0, 5).map((r, i) => (
                      <li key={i} className="text-[9px] text-muted-foreground">• {r}</li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Conflicts */}
          {(ai.conflicts ?? []).length > 0 && (
            <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-3">
              <p className="text-[10px] text-yellow-400 uppercase mb-1.5">⚠️ Conflicting Signals</p>
              {ai.conflicts.map((c, i) => (
                <p key={i} className="text-[10px] text-foreground/70 leading-relaxed">• {c}</p>
              ))}
            </div>
          )}

          {/* Risk Factors */}
          {(ai.riskFactors ?? []).length > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-3">
              <p className="text-[10px] text-destructive uppercase mb-1.5">🛡️ Risk Factors</p>
              {ai.riskFactors.slice(0, 3).map((r, i) => (
                <p key={i} className="text-[10px] text-foreground/70 leading-relaxed">• {r}</p>
              ))}
            </div>
          )}

          {/* Patterns */}
          {(patterns.candlestick.length > 0 || patterns.chart.length > 0) && (
            <div className="flex flex-wrap gap-1.5">
              {patterns.candlestick.map(p => (
                <span key={p} className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">🕯️ {p}</span>
              ))}
              {patterns.chart.map(p => (
                <span key={p} className="text-[9px] px-2 py-0.5 rounded-full bg-accent/10 text-accent">📐 {p}</span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pb-2">
            <button onClick={onClose} className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground font-bold text-sm">
              Close
            </button>
            <button
              onClick={onExecute}
              className={`flex-1 py-3.5 rounded-xl font-bold text-sm shadow-lg active:scale-95 transition-transform ${
                isBullishConsensus ? 'bg-primary text-background shadow-primary/20' :
                isBearishConsensus ? 'bg-destructive text-background shadow-destructive/20' :
                'bg-secondary text-foreground'
              }`}
            >
              Execute Trade →
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ChartScreen() {
  const [symbol, setSymbol] = useState('RELIANCE-EQ');
  const [timeframe, setTimeframe] = useState('15m');
  const { data, loading, currentPrice, change } = useMarketData(symbol, timeframe);
  const indicators = useIndicators(symbol);
  const { analyze, analyzing, result, setResult } = useSignalAnalysis();
  const { toast } = useToast();

  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderMode, setOrderMode] = useState<'paper' | 'live'>('paper');
  const [placing, setPlacing] = useState(false);
  const qtyRef   = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);
  const slRef    = useRef<HTMLInputElement>(null);
  const [crossVerifying, setCrossVerifying] = useState(false);
  const [crossVerifyResult, setCrossVerifyResult] = useState<CrossVerifyResult | null>(null);

  const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1H', '4H', '1D'];

  const TF_TO_INTERVAL: Record<string, string> = {
    '1m': 'ONE_MINUTE', '3m': 'THREE_MINUTE', '5m': 'FIVE_MINUTE',
    '15m': 'FIFTEEN_MINUTE', '30m': 'THIRTY_MINUTE',
    '1H': 'ONE_HOUR', '4H': 'FOUR_HOUR', '1D': 'ONE_DAY',
  };

  const handleAIAnalysis = () => {
    analyze(symbol);
    toast({ title: '🧠 Engine Analysis Started', description: `Running 20 indicators on ${symbol}...` });
  };

  const handleCrossVerify = useCallback(async () => {
    setCrossVerifying(true);
    toast({ title: '🤖 AI Cross-Verify Started', description: `Algo engine + Gemini AI analyzing ${symbol}...` });
    try {
      const res = await fetch('/api/ai/cross-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol,
          interval: TF_TO_INTERVAL[timeframe] ?? 'FIFTEEN_MINUTE',
          exchange: 'NSE',
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Cross-verify failed');
      setCrossVerifyResult(json as CrossVerifyResult);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Cross-verify failed';
      toast({ title: '❌ Cross-Verify Failed', description: msg, variant: 'destructive' });
    } finally {
      setCrossVerifying(false);
    }
  }, [symbol, timeframe]);

  const handleExecute = () => setShowOrderModal(true);

  const rsi = indicators.RSI;
  const supertrend = indicators.Supertrend;
  const macd = indicators.MACD;
  const candlePattern = indicators.patterns.candlestick[0];
  const chartPattern = indicators.patterns.chart[0];
  const liveSignal = indicators.liveSignal;

  return (
    <div className="relative min-h-screen pb-8">
      {/* Header */}
      <div className="p-4 bg-background z-20 relative">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input
              type="text"
              value={symbol}
              onChange={e => setSymbol(e.target.value.toUpperCase())}
              className="w-full bg-input border border-border rounded-xl h-12 pl-10 pr-4 text-foreground focus:border-accent focus:ring-1 focus:ring-accent outline-none font-mono text-sm"
              placeholder="Search symbol (e.g. TCS-EQ)"
            />
          </div>
          <button className="w-12 h-12 bg-card border border-border rounded-xl flex items-center justify-center text-foreground active:scale-95 transition-transform">
            <Plus size={20} />
          </button>
        </div>

        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold font-mono text-foreground flex items-center gap-2">
              {symbol.replace('-EQ', '')}
              <span className="bg-accent/20 text-accent text-[10px] px-1.5 py-0.5 rounded font-sans">NSE</span>
              {liveSignal && (
                <span className={`text-[10px] px-2 py-0.5 rounded font-sans font-bold ${SIGNAL_BG[liveSignal.signal] || 'bg-muted text-muted-foreground'}`}>
                  {liveSignal.signal.replace('_', ' ')}
                </span>
              )}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-mono font-medium">₹{currentPrice.toFixed(2)}</span>
              <span className={`text-sm font-mono font-medium flex items-center gap-0.5 ${change >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {change >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="text-right">
            {liveSignal ? (
              <>
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className={`text-sm font-bold font-mono ${SIGNAL_COLORS[liveSignal.signal] || 'text-foreground'}`}>
                  {liveSignal.confidence}%
                </p>
              </>
            ) : (
              <p className="text-xs text-muted-foreground">Loading...</p>
            )}
          </div>
        </div>
      </div>

      {/* Timeframe selector */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 px-4 mb-2">
        {TIMEFRAMES.map(tf => (
          <button
            key={tf}
            onClick={() => setTimeframe(tf)}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors ${
              timeframe === tf ? 'bg-accent text-background' : 'bg-card text-muted-foreground border border-border'
            }`}
          >
            {tf}
          </button>
        ))}
      </div>

      {/* Chart */}
      <div className="w-full h-[50vh] bg-[#0A0A0F] border-y border-border relative">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Activity className="animate-pulse text-muted-foreground" size={32} />
          </div>
        ) : (
          <ChartWidget data={data} height={window.innerHeight * 0.5} />
        )}
      </div>

      {/* Action Buttons — Deep Analysis + Cross-Verify side by side */}
      <div className="p-4 space-y-2">
        {/* Deep Signal Analysis (Algo Engine) */}
        <button
          onClick={handleAIAnalysis}
          disabled={analyzing}
          className="w-full relative overflow-hidden rounded-xl p-[2px] active:scale-[0.98] transition-transform disabled:opacity-70"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#FFD700] animate-pulse" />
          <div className="relative bg-card h-14 rounded-[10px] flex items-center justify-center gap-2">
            {analyzing ? (
              <Activity className="animate-pulse text-[#FFD700]" size={20} />
            ) : (
              <BrainCircuit className="text-[#FFD700]" size={20} />
            )}
            <span className="font-bold text-gradient-gold">
              {analyzing ? 'Running 20 Indicators...' : '⚡ Deep Signal Analysis (20 Algos)'}
            </span>
          </div>
        </button>

        {/* AI Cross-Verify Button */}
        <button
          onClick={handleCrossVerify}
          disabled={crossVerifying}
          className="w-full relative overflow-hidden rounded-xl p-[1px] active:scale-[0.98] transition-transform disabled:opacity-70"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-accent via-[#7B5EA7] to-accent" />
          <div className="relative bg-[#0D0D1A] h-14 rounded-[10px] flex items-center justify-center gap-2">
            {crossVerifying ? (
              <>
                <Activity className="animate-pulse text-accent" size={18} />
                <span className="font-bold text-accent text-sm">Gemini AI Analyzing...</span>
              </>
            ) : (
              <>
                <Sparkles className="text-accent" size={18} />
                <span className="font-bold text-accent text-sm">🤖 AI Cross-Verify (Gemini)</span>
                <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded font-mono">FREE</span>
              </>
            )}
          </div>
        </button>
      </div>

      {/* Live Indicators Panel */}
      <div className="px-4 pb-4">
        <div className="glass-panel rounded-xl p-4 border border-border">
          <h3 className="text-sm font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <Activity size={14} className="text-accent" /> Live Indicators
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">RSI (14)</p>
              <p className={`font-mono font-bold ${rsi < 30 ? 'text-primary' : rsi > 70 ? 'text-destructive' : 'text-foreground'}`}>
                {rsi.toFixed(1)}
                <span className="text-xs ml-1 font-normal text-muted-foreground">
                  {rsi < 30 ? '(Oversold)' : rsi > 70 ? '(Overbought)' : '(Neutral)'}
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Supertrend</p>
              <p className={`font-mono font-bold ${supertrend.signal === 'BUY' ? 'text-primary' : supertrend.signal === 'SELL' ? 'text-destructive' : 'text-muted-foreground'}`}>
                {supertrend.signal}
                {supertrend.value > 0 && (
                  <span className="text-xs ml-1 font-normal text-muted-foreground">₹{supertrend.value.toFixed(0)}</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">MACD</p>
              <p className={`font-mono font-bold text-xs ${macd.line > 0 ? 'text-primary' : 'text-destructive'}`}>
                {macd.line.toFixed(2)} / {macd.signal.toFixed(2)}
                <span className="text-muted-foreground"> ({macd.hist >= 0 ? '+' : ''}{macd.hist.toFixed(2)})</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Pattern</p>
              {candlePattern ? (
                <p className="text-xs font-bold text-accent truncate">{candlePattern}</p>
              ) : chartPattern ? (
                <p className="text-xs font-bold text-[#FFD700] truncate">{chartPattern}</p>
              ) : (
                <p className="text-xs font-bold text-muted-foreground">None detected</p>
              )}
            </div>
            {liveSignal && (
              <>
                <div>
                  <p className="text-xs text-muted-foreground">EMA 50</p>
                  <p className="font-mono font-bold text-sm text-foreground">₹{liveSignal.indicators.ema50.toFixed(0)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Score</p>
                  <p className={`font-mono font-bold ${liveSignal.score >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {liveSignal.score >= 0 ? '+' : ''}{liveSignal.score} / 40
                  </p>
                </div>
              </>
            )}
          </div>

          {(indicators.patterns.candlestick.length > 0 || indicators.patterns.chart.length > 0) && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">Detected Patterns</p>
              <div className="flex flex-wrap gap-1.5">
                {indicators.patterns.candlestick.slice(0, 3).map(p => (
                  <span key={p} className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary font-medium">🕯️ {p}</span>
                ))}
                {indicators.patterns.chart.slice(0, 2).map(p => (
                  <span key={p} className="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent font-medium">📐 {p}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Algo Signal Result panel (after Deep Analysis) */}
      <AnimatePresence>
        {result && !crossVerifyResult && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-[60px] w-full max-w-md bg-card/95 backdrop-blur-xl border-t border-border p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-[60]"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-bold rounded ${SIGNAL_BG[result.signal] || 'bg-muted text-muted-foreground'}`}>
                  {result.signalEmoji} {result.signal.replace('_', ' ')}
                </span>
                <span className="text-sm font-bold text-foreground">{result.confidence}% Conf.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-muted-foreground">R:R 1:{result.riskReward}</span>
                <button onClick={() => setResult(null)} className="text-muted-foreground">
                  <X size={14} />
                </button>
              </div>
            </div>

            {result.reasons?.[0] && (
              <p className="text-[11px] text-muted-foreground mb-3 line-clamp-2">{result.reasons[0]}</p>
            )}

            <div className="grid grid-cols-3 gap-1.5 mb-3 text-xs font-mono">
              <div className="bg-input/60 rounded-lg p-2 text-center">
                <p className="text-muted-foreground text-[10px]">Entry</p>
                <p className="font-bold">₹{result.entry?.toFixed(0)}</p>
              </div>
              <div className="bg-primary/10 rounded-lg p-2 text-center">
                <p className="text-primary/80 text-[10px]">Target</p>
                <p className="font-bold text-primary">₹{result.target1?.toFixed(0)}</p>
              </div>
              <div className="bg-destructive/10 rounded-lg p-2 text-center">
                <p className="text-destructive/80 text-[10px]">Stop Loss</p>
                <p className="font-bold text-destructive">₹{result.stopLoss?.toFixed(0)}</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleCrossVerify}
                disabled={crossVerifying}
                className="flex-1 py-3 rounded-xl border border-accent/30 bg-accent/10 text-accent text-xs font-bold flex items-center justify-center gap-1"
              >
                <Sparkles size={12} />
                {crossVerifying ? 'Verifying...' : 'AI Verify'}
              </button>
              <button
                onClick={handleExecute}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-primary to-[#00cc6a] text-background text-sm font-bold shadow-lg shadow-primary/20 active:scale-95 transition-transform"
              >
                Execute Trade →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trade Modal */}
      <AnimatePresence>
        {showOrderModal && result && (
          <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-card rounded-t-3xl border-t border-border p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xl font-bold">Place Order</h2>
                <button onClick={() => setShowOrderModal(false)} className="p-1 text-muted-foreground hover:text-foreground">
                  <X size={18} />
                </button>
              </div>

              {/* Paper / Live toggle */}
              <div className="flex gap-2 mb-4 mt-3">
                <button
                  onClick={() => setOrderMode('paper')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                    orderMode === 'paper'
                      ? 'bg-accent/10 border-accent/40 text-accent'
                      : 'bg-white/5 border-white/10 text-muted-foreground'
                  }`}
                >
                  <Shield size={14} /> Paper Trade
                </button>
                <button
                  onClick={() => setOrderMode('live')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                    orderMode === 'live'
                      ? 'bg-orange-500/10 border-orange-500/40 text-orange-400'
                      : 'bg-white/5 border-white/10 text-muted-foreground'
                  }`}
                >
                  <Zap size={14} /> Live Order
                </button>
              </div>

              {/* Live warning */}
              {orderMode === 'live' && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 mb-4 flex gap-2 items-start">
                  <AlertCircle size={14} className="text-orange-400 shrink-0 mt-0.5" />
                  <p className="text-[11px] text-orange-300 leading-relaxed">
                    <span className="font-bold">REAL MONEY ALERT:</span> This will place an actual order on your Angel One account. Market hours: 9:15 AM – 3:30 PM.
                  </p>
                </div>
              )}

              <div className="space-y-3 mb-5">
                <div className="flex justify-between items-center p-3 bg-input rounded-xl">
                  <span className="text-muted-foreground text-sm">Symbol</span>
                  <span className="font-bold font-mono">{result.symbol?.replace('-EQ', '')}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-input rounded-xl">
                  <span className="text-muted-foreground text-sm">Signal</span>
                  <span className={`text-sm font-bold ${result.signal?.includes('SELL') ? 'text-destructive' : 'text-primary'}`}>
                    {result.signal?.includes('SELL') ? '🔴 SHORT' : '🟢 BUY'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-input rounded-xl">
                    <span className="text-muted-foreground text-xs block mb-1">Entry Price</span>
                    <input
                      ref={priceRef}
                      type="number"
                      defaultValue={result.entry ?? currentPrice}
                      step="0.05"
                      className="bg-transparent w-full font-mono font-bold text-foreground outline-none text-sm"
                    />
                  </div>
                  <div className="p-3 bg-input rounded-xl">
                    <span className="text-muted-foreground text-xs block mb-1">Stop Loss</span>
                    <input
                      ref={slRef}
                      type="number"
                      defaultValue={result.stopLoss}
                      step="0.05"
                      className="bg-transparent w-full font-mono font-bold text-destructive outline-none text-sm"
                    />
                  </div>
                </div>
                <div className="p-3 bg-input rounded-xl flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Quantity</span>
                  <input
                    ref={qtyRef}
                    type="number"
                    defaultValue={1}
                    min="1"
                    className="bg-transparent w-20 text-right font-mono font-bold text-foreground outline-none border-b border-border focus:border-accent text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowOrderModal(false)}
                  disabled={placing}
                  className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground font-bold disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  disabled={placing}
                  onClick={async () => {
                    const qty = Number(qtyRef.current?.value ?? 1);
                    const price = Number(priceRef.current?.value ?? currentPrice);
                    const isSell = result.signal?.includes('SELL');
                    const sym = result.symbol ?? symbol;

                    // Look up symboltoken from NIFTY50 list
                    const tokenLookup: Record<string, string> = {
                      'RELIANCE-EQ':'2885','TCS-EQ':'11536','HDFCBANK-EQ':'1333','INFY-EQ':'1594',
                      'ICICIBANK-EQ':'4963','SBIN-EQ':'3045','BAJFINANCE-EQ':'317','BHARTIARTL-EQ':'10604',
                      'KOTAKBANK-EQ':'1922','WIPRO-EQ':'3787','HCLTECH-EQ':'7229','AXISBANK-EQ':'5900',
                      'ASIANPAINT-EQ':'236','MARUTI-EQ':'10999','SUNPHARMA-EQ':'3351','TATASTEEL-EQ':'3499',
                      'ULTRACEMCO-EQ':'11532','POWERGRID-EQ':'14977','NTPC-EQ':'11630','NESTLEIND-EQ':'17963',
                      'TECHM-EQ':'13538','TITAN-EQ':'3506','JSWSTEEL-EQ':'11723','LT-EQ':'11483',
                      'M&M-EQ':'2031','INDUSINDBK-EQ':'5258','TATACONSUM-EQ':'3432','ONGC-EQ':'2475',
                      'HINDUNILVR-EQ':'1394','ITC-EQ':'1660','CIPLA-EQ':'694','DRREDDY-EQ':'881',
                      'EICHERMOT-EQ':'910','GRASIM-EQ':'1232','HDFCLIFE-EQ':'467','SBILIFE-EQ':'21808',
                      'BPCL-EQ':'526','BRITANNIA-EQ':'547','APOLLOHOSP-EQ':'157','TRENT-EQ':'1964',
                      'SHRIRAMFIN-EQ':'4306','HINDALCO-EQ':'1363','COALINDIA-EQ':'20374',
                      'ADANIPORTS-EQ':'15083','ADANIENT-EQ':'25','BAJAJFINSV-EQ':'16675',
                      'BAJAJ-AUTO-EQ':'16669','HEROMOTOCO-EQ':'1348','DIVISLAB-EQ':'10940',
                    };
                    const symboltoken = tokenLookup[sym] ?? '';

                    setPlacing(true);
                    try {
                      const body = {
                        variety: orderMode === 'live' ? 'NORMAL' : 'NORMAL',
                        tradingsymbol: sym,
                        symboltoken,
                        transactiontype: isSell ? 'SELL' : 'BUY',
                        exchange: 'NSE',
                        ordertype: 'LIMIT',
                        producttype: 'INTRADAY',
                        duration: 'DAY',
                        price: String(price),
                        squareoff: '0',
                        stoploss: String(slRef.current?.value ?? 0),
                        quantity: String(qty),
                        forceLive: orderMode === 'live',
                      };
                      const res = await fetch(`${BASE}/api/orders/place`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(body),
                      });
                      const json = await res.json();
                      if (json.success) {
                        toast({
                          title: orderMode === 'live' ? '⚡ Live Order Placed!' : '✅ Paper Order Placed!',
                          description: orderMode === 'live'
                            ? `${isSell ? 'SELL' : 'BUY'} ${qty} × ${sym.replace('-EQ','')} sent to Angel One.`
                            : `Simulated ${isSell ? 'SELL' : 'BUY'} ${qty} × ${sym.replace('-EQ','')} in paper mode.`,
                        });
                        setShowOrderModal(false);
                        setResult(null);
                      } else {
                        throw new Error(json.error ?? 'Order failed');
                      }
                    } catch (err) {
                      const msg = err instanceof Error ? err.message : 'Order failed';
                      toast({ title: '❌ Order Failed', description: msg, variant: 'destructive' });
                    } finally {
                      setPlacing(false);
                    }
                  }}
                  className={`flex-1 py-3.5 rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 disabled:opacity-60 ${
                    orderMode === 'live'
                      ? 'bg-orange-500 text-white shadow-orange-500/20'
                      : result.signal?.includes('SELL')
                        ? 'bg-destructive text-background shadow-destructive/20'
                        : 'bg-primary text-background shadow-primary/20'
                  }`}
                >
                  {placing ? (
                    <><span className="animate-spin">⏳</span> Placing...</>
                  ) : (
                    <>{orderMode === 'live' ? <Zap size={14} /> : <Shield size={14} />} Confirm {result.signal?.includes('SELL') ? 'SHORT' : 'BUY'}</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* AI Cross-Verify Modal */}
      <AnimatePresence>
        {crossVerifyResult && (
          <CrossVerifyModal
            result={crossVerifyResult}
            onClose={() => setCrossVerifyResult(null)}
            onExecute={() => {
              setCrossVerifyResult(null);
              setShowOrderModal(true);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
