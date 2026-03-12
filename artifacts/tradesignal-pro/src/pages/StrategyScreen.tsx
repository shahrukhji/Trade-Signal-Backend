import { useState, useEffect, useCallback, type ReactElement } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp,
  RefreshCw, ArrowRight, Activity,
} from 'lucide-react';
import {
  getAllStrategies, detectMarketCondition, recommendBestStrategies,
  type Strategy, type StrategySignal, type StrategyRecommendation, type MarketConditionResult,
} from '@/engine/strategies';
import { angelOne, STOCK_MASTER_LIST } from '@/broker/angelOne';
import { useStore } from '@/store/use-store';
import type { OHLCV } from '@/engine/indicators';

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}`;

const CONDITION_STYLE: Record<string, { border: string; badge: string; icon: ReactElement; label: string }> = {
  STRONG_UPTREND:    { border: '#00FF88', badge: 'bg-primary/10 text-primary border-primary/20', icon: <TrendingUp size={14} />, label: '📈 STRONG UPTREND' },
  UPTREND:           { border: '#00FF88', badge: 'bg-primary/10 text-primary border-primary/20', icon: <TrendingUp size={14} />, label: '📈 UPTREND' },
  SIDEWAYS:          { border: '#FFD700', badge: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20', icon: <Minus size={14} />, label: '↔️ SIDEWAYS' },
  VOLATILE:          { border: '#FF8C00', badge: 'bg-orange-500/10 text-orange-400 border-orange-500/20', icon: <Activity size={14} />, label: '🌊 VOLATILE' },
  LOW_VOLATILITY:    { border: '#00BFFF', badge: 'bg-accent/10 text-accent border-accent/20', icon: <Activity size={14} />, label: '💤 LOW VOLATILITY' },
  DOWNTREND:         { border: '#FF3366', badge: 'bg-destructive/10 text-destructive border-destructive/20', icon: <TrendingDown size={14} />, label: '📉 DOWNTREND' },
  STRONG_DOWNTREND:  { border: '#FF3366', badge: 'bg-destructive/10 text-destructive border-destructive/20', icon: <TrendingDown size={14} />, label: '📉 STRONG DOWNTREND' },
};

const TYPE_LABEL: Record<string, string> = {
  trend_following: 'Trend', mean_reversion: 'Reversal', momentum: 'Momentum',
  breakout: 'Breakout', scalping: 'Scalp',
};
const TYPE_COLOR: Record<string, string> = {
  trend_following: '#00FF88', mean_reversion: '#A855F7', momentum: '#00BFFF',
  breakout: '#FF8C00', scalping: '#FFD700',
};
const RISK_COLOR: Record<string, string> = { low: '#00FF88', medium: '#FFD700', high: '#FF3366' };

function SignalBadge({ signal }: { signal: StrategySignal }) {
  if (!signal.triggered) return <span className="text-[10px] text-muted-foreground font-mono">⚪ No Signal</span>;
  const colors = { BUY: 'text-primary border-primary/20 bg-primary/10', SELL: 'text-destructive border-destructive/20 bg-destructive/10', HOLD: 'text-muted-foreground border-border bg-input', EXIT_LONG: 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10', EXIT_SHORT: 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10' };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${colors[signal.action] || colors.HOLD}`}>
      {signal.action === 'BUY' ? '🟢' : signal.action === 'SELL' ? '🔴' : '⚪'} {signal.action}
    </span>
  );
}

function ConfidenceRing({ value, size = 40 }: { value: number; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const pct = Math.min(100, Math.max(0, value));
  const color = pct >= 70 ? '#00FF88' : pct >= 50 ? '#FFD700' : '#FF3366';
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2A3E" strokeWidth="4" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

export function StrategyScreen() {
  const { brokerSession, brokerIsDemo, brokerApiKey } = useStore();
  const [selectedSymbol, setSelectedSymbol] = useState('RELIANCE');
  const [candles, setCandles] = useState<OHLCV[]>([]);
  const [market, setMarket] = useState<MarketConditionResult | null>(null);
  const [recommendations, setRecommendations] = useState<StrategyRecommendation[]>([]);
  const [allStrategies] = useState(getAllStrategies());
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<StrategyRecommendation | null>(null);
  const [executedResults, setExecutedResults] = useState<Record<string, StrategySignal>>({});

  const stock = STOCK_MASTER_LIST.find(s => s.tradingSymbol === selectedSymbol) || STOCK_MASTER_LIST[0];

  useEffect(() => {
    if (brokerSession && brokerApiKey) angelOne.restoreSession(brokerSession, brokerIsDemo, brokerApiKey);
    fetchCandles();
    const interval = setInterval(fetchCandles, 30000);
    return () => clearInterval(interval);
  }, [selectedSymbol]);

  const fetchCandles = useCallback(async () => {
    setLoading(true);
    try {
      const toDate = new Date().toISOString().slice(0, 10) + ' 15:30';
      const fromDate = new Date(Date.now() - 200 * 86400000).toISOString().slice(0, 10) + ' 09:15';
      const data = await angelOne.getCandleData(stock.exchange, stock.symbolToken, 'ONE_DAY', fromDate, toDate);
      if (data.length > 50) {
        setCandles(data);
        const m = detectMarketCondition(data);
        const recs = recommendBestStrategies(data);
        setMarket(m);
        setRecommendations(recs);
        setLastUpdate(new Date());
      }
    } catch (_) {}
    setLoading(false);
  }, [stock]);

  const runStrategy = (s: Strategy) => {
    if (!candles.length) return;
    const signal = s.execute(candles);
    setExecutedResults(prev => ({ ...prev, [s.id]: signal }));
  };

  const condStyle = market ? (CONDITION_STYLE[market.condition] || CONDITION_STYLE.SIDEWAYS) : CONDITION_STYLE.SIDEWAYS;

  return (
    <div className="px-4 pb-6 pt-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">Strategy Lab</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchCandles()}
            disabled={loading}
            className="p-2 rounded-xl bg-input border border-border text-muted-foreground"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Stock Selector */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'SBIN', 'WIPRO', 'ITC', 'TATAMOTORS'].map(sym => (
          <button
            key={sym}
            onClick={() => setSelectedSymbol(sym)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-mono font-bold transition-all ${
              selectedSymbol === sym ? 'bg-accent/20 text-accent border-accent/40' : 'bg-input border-border text-muted-foreground'
            }`}
          >
            {sym}
          </button>
        ))}
      </div>

      {/* Market Condition Card */}
      {market && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4 border"
          style={{ borderColor: condStyle.border + '60', background: condStyle.border + '08' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs font-bold px-2 py-1 rounded-full border ${condStyle.badge}`}>
              {condStyle.label}
            </span>
            {lastUpdate && (
              <span className="text-[10px] text-muted-foreground">
                {lastUpdate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-3">{market.description}</p>
          <div className="flex gap-4 mb-3 text-xs">
            <div><span className="text-muted-foreground">ADX: </span><span className="font-bold text-foreground">{market.adx}</span></div>
            <div><span className="text-muted-foreground">Trend: </span><span className="font-bold text-foreground">{market.trendDirection}</span></div>
            <div><span className="text-muted-foreground">Vol: </span><span className="font-bold text-foreground">{market.volatility}</span></div>
          </div>
          <div className="flex flex-wrap gap-1">
            <span className="text-[10px] text-muted-foreground mr-1">Best for:</span>
            {market.bestStrategyIds.map(id => {
              const s = allStrategies.find(st => st.id === id);
              return s ? (
                <span key={id} className="text-[10px] bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                  {s.emoji} {s.name.split(' ')[0]}
                </span>
              ) : null;
            })}
          </div>
        </motion.div>
      )}

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-2xl border p-4" style={{ borderColor: '#FFD70040', background: '#FFD70006' }}>
          <p className="text-sm font-bold text-yellow-400 mb-3 flex items-center gap-2">
            🤖 AI Strategy Recommendation
          </p>
          <div className="space-y-3">
            {recommendations.slice(0, 3).map((rec, idx) => {
              const medals = ['🥇', '🥈', '🥉'];
              const isActive = rec.signal.triggered;
              return (
                <motion.div
                  key={rec.strategy.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.07 }}
                  className={`rounded-xl p-3 border ${isActive ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{medals[idx]}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-bold text-sm text-foreground">{rec.strategy.emoji} {rec.strategy.name}</span>
                        <ConfidenceRing value={rec.suitabilityScore} size={36} />
                      </div>
                      <p className="text-[11px] text-muted-foreground mb-1.5">{rec.reason}</p>
                      {isActive && (
                        <div className="flex items-center gap-2">
                          <SignalBadge signal={rec.signal} />
                          {rec.signal.entry > 0 && (
                            <span className="text-[10px] text-muted-foreground font-mono">
                              Entry {fmtINR(rec.signal.entry)} | SL {fmtINR(rec.signal.stopLoss)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveModal(rec)}
                    className="w-full mt-2 h-7 rounded-lg bg-input border border-border text-[11px] text-muted-foreground flex items-center justify-center gap-1 active:scale-95 transition-transform"
                  >
                    View Details <ArrowRight size={10} />
                  </button>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Strategy Grid */}
      <div>
        <p className="text-sm font-bold text-foreground mb-3">All Strategies ({allStrategies.length})</p>
        <div className="space-y-3">
          {allStrategies.map((s, idx) => {
            const result = executedResults[s.id];
            const rec = recommendations.find(r => r.strategy.id === s.id);
            const suitability = rec?.suitabilityScore || 50;
            const isBestMatch = market?.bestStrategyIds.includes(s.id);
            const isExpanded = expandedCard === s.id;
            const typeColor = TYPE_COLOR[s.type] || '#888';
            const isBest = isBestMatch;

            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
                className="rounded-2xl border overflow-hidden"
                style={{ borderColor: isBest ? '#00FF8830' : '#2A2A3E', background: '#12121A' }}
              >
                <div className="p-3.5">
                  {/* Header row */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-base">{s.emoji}</span>
                        <span className="font-bold text-sm text-foreground">{s.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: typeColor + '15', color: typeColor }}>
                          {TYPE_LABEL[s.type]}
                        </span>
                        <span className="text-[9px] font-bold" style={{ color: RISK_COLOR[s.riskLevel] }}>
                          ● {s.riskLevel.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <SignalBadge signal={result || rec?.signal || { triggered: false, action: 'HOLD', entry: 0, stopLoss: 0, target1: 0, target2: 0, target3: 0, confidence: 0, riskReward: 0, reasoning: [] }} />
                  </div>

                  {/* Stats row */}
                  <div className="flex gap-3 mb-2 text-[11px] text-muted-foreground">
                    <span>Win: <span className="text-primary font-bold">{s.expectedWinRate}%</span></span>
                    <span>Avg +<span className="text-primary font-bold">{s.avgProfit}%</span></span>
                    <span>Avg -<span className="text-destructive font-bold">{s.avgLoss}%</span></span>
                  </div>

                  {/* Timeframes */}
                  <div className="flex gap-1 mb-2">
                    {s.timeframes.map(tf => (
                      <span key={tf} className="text-[9px] bg-input border border-border px-1.5 py-0.5 rounded-md font-mono">{tf}</span>
                    ))}
                  </div>

                  {/* Market match bar */}
                  <div className="mb-2">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[10px] text-muted-foreground">Market Match</span>
                      <span className="text-[10px] font-bold" style={{ color: isBest ? '#00FF88' : suitability < 40 ? '#FF3366' : '#FFD700' }}>
                        {suitability}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-input rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${suitability}%`,
                          background: isBest ? '#00FF88' : suitability < 40 ? '#FF3366' : '#FFD700',
                        }}
                      />
                    </div>
                    {isBest && (
                      <p className="text-[9px] text-primary mt-0.5 font-bold">✅ Ideal for current market</p>
                    )}
                    {!isBest && suitability < 40 && (
                      <p className="text-[9px] text-destructive mt-0.5">⚠️ Not recommended now</p>
                    )}
                  </div>

                  {/* Active signal details */}
                  {result?.triggered && (
                    <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 mb-2 text-[11px] font-mono">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Entry</span>
                        <span className="text-foreground font-bold">{fmtINR(result.entry)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">SL</span>
                        <span className="text-destructive font-bold">{fmtINR(result.stopLoss)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">T1</span>
                        <span className="text-primary font-bold">{fmtINR(result.target1)}</span>
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setExpandedCard(isExpanded ? null : s.id)}
                      className="flex-1 h-8 rounded-xl bg-input border border-border text-[11px] text-muted-foreground flex items-center justify-center gap-1 active:scale-95"
                    >
                      📋 Rules {isExpanded ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                    </button>
                    <button
                      onClick={() => {
                        runStrategy(s);
                        const r = { strategy: s, signal: s.execute(candles), suitabilityScore: suitability, reason: '' };
                        setActiveModal(r);
                      }}
                      className="flex-1 h-8 rounded-xl bg-accent/10 border border-accent/20 text-accent text-[11px] font-bold flex items-center justify-center gap-1 active:scale-95"
                    >
                      ▶️ Apply
                    </button>
                  </div>
                </div>

                {/* Expanded rules */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-border overflow-hidden"
                    >
                      <div className="p-3.5 space-y-3">
                        {[
                          { title: '🎯 Entry Rules', rules: s.rules.entry },
                          { title: '🏁 Exit Rules', rules: s.rules.exit },
                          { title: '🛡️ Stop Loss', rules: s.rules.stopLoss },
                          { title: '⚙️ Management', rules: s.rules.management },
                        ].map(({ title, rules }) => (
                          <div key={title}>
                            <p className="text-[11px] font-bold text-foreground mb-1">{title}</p>
                            {rules.map((r, i) => (
                              <p key={i} className="text-[10px] text-muted-foreground pl-2 mb-0.5">{i + 1}. {r}</p>
                            ))}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Strategy Detail Modal */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 z-[200] flex items-end"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-h-[85vh] overflow-y-auto bg-background rounded-t-3xl border-t border-border p-5"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-8 h-1 bg-border rounded-full mx-auto mb-4" />
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{activeModal.strategy.emoji}</span>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{activeModal.strategy.name}</h2>
                  <p className="text-xs text-muted-foreground">{activeModal.strategy.description}</p>
                </div>
              </div>

              {/* Signal result */}
              {activeModal.signal.triggered ? (
                <div className={`rounded-2xl p-4 border mb-4 ${activeModal.signal.action === 'BUY' ? 'border-primary/30 bg-primary/5' : 'border-destructive/30 bg-destructive/5'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`text-sm font-bold px-2 py-1 rounded-full border ${activeModal.signal.action === 'BUY' ? 'text-primary bg-primary/10 border-primary/20' : 'text-destructive bg-destructive/10 border-destructive/20'}`}>
                      {activeModal.signal.action === 'BUY' ? '🟢' : '🔴'} {activeModal.signal.action} SIGNAL
                    </span>
                    <ConfidenceRing value={activeModal.signal.confidence} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    {[
                      ['Entry', fmtINR(activeModal.signal.entry)],
                      ['Stop Loss', fmtINR(activeModal.signal.stopLoss)],
                      ['Target 1', fmtINR(activeModal.signal.target1)],
                      ['Target 2', fmtINR(activeModal.signal.target2)],
                      ['Target 3', fmtINR(activeModal.signal.target3)],
                      ['R:R Ratio', `${activeModal.signal.riskReward}:1`],
                    ].map(([label, val]) => (
                      <div key={label} className="bg-input rounded-xl px-3 py-2">
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                        <p className="font-bold font-mono text-foreground">{val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1">
                    {activeModal.signal.reasoning.map((r, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground">{r}</p>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl p-4 border border-border bg-input mb-4">
                  <p className="text-sm font-bold text-muted-foreground mb-2">⚪ No Active Signal</p>
                  {activeModal.signal.reasoning.map((r, i) => (
                    <p key={i} className="text-[11px] text-muted-foreground">{r}</p>
                  ))}
                </div>
              )}

              {/* Rules */}
              <div className="space-y-3">
                {[
                  { title: '🎯 Entry Rules', rules: activeModal.strategy.rules.entry },
                  { title: '🏁 Exit Rules', rules: activeModal.strategy.rules.exit },
                  { title: '🛡️ Stop Loss', rules: activeModal.strategy.rules.stopLoss },
                  { title: '⚙️ Management', rules: activeModal.strategy.rules.management },
                ].map(({ title, rules }) => (
                  <div key={title} className="bg-card rounded-xl p-3">
                    <p className="text-xs font-bold text-foreground mb-2">{title}</p>
                    {rules.map((r, i) => (
                      <p key={i} className="text-[11px] text-muted-foreground mb-1">{i + 1}. {r}</p>
                    ))}
                  </div>
                ))}
              </div>

              <button
                onClick={() => setActiveModal(null)}
                className="w-full mt-4 h-12 rounded-2xl bg-accent/10 border border-accent/20 text-accent font-bold"
              >
                Close
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
