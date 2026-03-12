import { useState, useMemo } from 'react';
import { Target, ShieldAlert, ArrowRight, BrainCircuit, RefreshCw, Activity, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useMultiSignals } from '@/hooks/use-trading';
import { LiveSignal } from '@/engine';

const SIGNAL_BG: Record<string, string> = {
  STRONG_BUY: 'bg-primary/20 text-primary', BUY: 'bg-primary/20 text-primary', WEAK_BUY: 'bg-primary/10 text-primary',
  NEUTRAL: 'bg-muted text-muted-foreground',
  STRONG_SELL: 'bg-destructive/20 text-destructive', SELL: 'bg-destructive/20 text-destructive', WEAK_SELL: 'bg-destructive/10 text-destructive',
};

const SIGNAL_BAR: Record<string, string> = {
  STRONG_BUY: 'bg-primary', BUY: 'bg-primary', WEAK_BUY: 'bg-primary/60',
  NEUTRAL: 'bg-muted-foreground',
  STRONG_SELL: 'bg-destructive', SELL: 'bg-destructive', WEAK_SELL: 'bg-destructive/60',
};

function SignalIcon({ signal }: { signal: string }) {
  if (signal.includes('BUY')) return <TrendingUp size={14} className="text-primary" />;
  if (signal.includes('SELL')) return <TrendingDown size={14} className="text-destructive" />;
  return <Minus size={14} className="text-muted-foreground" />;
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

interface SignalDetailModalProps {
  signal: LiveSignal;
  onClose: () => void;
}

function SignalDetailModal({ signal, onClose }: SignalDetailModalProps) {
  const isBuy = signal.signal.includes('BUY');
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-card rounded-t-3xl border-t border-border shadow-2xl max-h-[85vh] overflow-y-auto"
      >
        <div className="p-5">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-xl font-bold">{signal.symbol}</h2>
              <p className="text-xs text-muted-foreground">{signal.stockName} · {signal.exchange} · {signal.timeframe}</p>
            </div>
            <span className={`px-2 py-1 text-xs font-bold rounded ${SIGNAL_BG[signal.signal]}`}>
              {signal.signalEmoji} {signal.signal.replace('_', ' ')}
            </span>
          </div>

          {/* Trade Setup */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="bg-input/60 rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">Entry</p>
              <p className="font-mono font-bold text-sm">₹{signal.tradeSetup.entry.toFixed(0)}</p>
            </div>
            <div className="bg-primary/10 rounded-xl p-3 text-center">
              <p className="text-[10px] text-primary/80 mb-1">Target 1</p>
              <p className="font-mono font-bold text-sm text-primary">₹{signal.tradeSetup.target1.toFixed(0)}</p>
            </div>
            <div className="bg-destructive/10 rounded-xl p-3 text-center">
              <p className="text-[10px] text-destructive/80 mb-1">Stop Loss</p>
              <p className="font-mono font-bold text-sm text-destructive">₹{signal.tradeSetup.stopLoss.toFixed(0)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <div className="bg-input/60 rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">Target 2</p>
              <p className="font-mono font-bold text-sm text-primary">₹{signal.tradeSetup.target2.toFixed(0)}</p>
            </div>
            <div className="bg-input/60 rounded-xl p-3 text-center">
              <p className="text-[10px] text-muted-foreground mb-1">R:R Ratio</p>
              <p className="font-mono font-bold text-sm">1:{signal.tradeSetup.riskRewardRatio}</p>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-input/40 rounded-xl p-3 mb-4">
            <p className="text-xs text-muted-foreground leading-relaxed">{signal.summary}</p>
          </div>

          {/* Key Indicators */}
          <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Key Indicators</h4>
          <div className="grid grid-cols-3 gap-2 mb-4 text-xs font-mono">
            <div className="bg-input/40 p-2 rounded-lg">
              <p className="text-muted-foreground text-[10px]">RSI</p>
              <p className={`font-bold ${signal.indicators.rsi < 30 ? 'text-primary' : signal.indicators.rsi > 70 ? 'text-destructive' : 'text-foreground'}`}>
                {signal.indicators.rsi.toFixed(1)}
              </p>
            </div>
            <div className="bg-input/40 p-2 rounded-lg">
              <p className="text-muted-foreground text-[10px]">Supertrend</p>
              <p className={`font-bold ${signal.indicators.supertrend.signal === 'BUY' ? 'text-primary' : 'text-destructive'}`}>
                {signal.indicators.supertrend.signal}
              </p>
            </div>
            <div className="bg-input/40 p-2 rounded-lg">
              <p className="text-muted-foreground text-[10px]">ADX</p>
              <p className="font-bold text-foreground">{signal.indicators.adx.adx.toFixed(0)}</p>
            </div>
            <div className="bg-input/40 p-2 rounded-lg">
              <p className="text-muted-foreground text-[10px]">MFI</p>
              <p className={`font-bold ${signal.indicators.mfi < 20 ? 'text-primary' : signal.indicators.mfi > 80 ? 'text-destructive' : 'text-foreground'}`}>
                {signal.indicators.mfi.toFixed(0)}
              </p>
            </div>
            <div className="bg-input/40 p-2 rounded-lg">
              <p className="text-muted-foreground text-[10px]">VWAP</p>
              <p className="font-bold text-foreground">₹{signal.indicators.vwap.toFixed(0)}</p>
            </div>
            <div className="bg-input/40 p-2 rounded-lg">
              <p className="text-muted-foreground text-[10px]">ATR</p>
              <p className="font-bold text-foreground">₹{signal.indicators.atr.toFixed(1)}</p>
            </div>
          </div>

          {/* Patterns */}
          {(signal.candlePatterns.length > 0 || signal.chartPatterns.length > 0) && (
            <div className="mb-4">
              <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Detected Patterns</h4>
              <div className="flex flex-wrap gap-1.5">
                {signal.candlePatterns.map(p => (
                  <span key={p.name} className={`text-[10px] px-2 py-0.5 rounded font-medium ${p.type === 'bullish' ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                    🕯️ {p.name}
                  </span>
                ))}
                {signal.chartPatterns.map(p => (
                  <span key={p.name} className={`text-[10px] px-2 py-0.5 rounded font-medium ${p.type === 'bullish' ? 'bg-accent/10 text-accent' : 'bg-destructive/10 text-destructive'}`}>
                    📐 {p.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Top Reasons */}
          <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">
            {isBuy ? '✅ Bullish Signals' : '❌ Bearish Signals'} ({isBuy ? signal.bullishReasons.length : signal.bearishReasons.length})
          </h4>
          <div className="space-y-1.5 mb-5">
            {(isBuy ? signal.bullishReasons : signal.bearishReasons).slice(0, 5).map((r, i) => (
              <div key={i} className="flex gap-2 text-xs">
                <span className="shrink-0">{r.icon}</span>
                <div>
                  <span className="font-bold text-foreground">{r.indicator}: </span>
                  <span className="text-muted-foreground">{r.interpretation.slice(0, 90)}</span>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-secondary text-foreground font-bold"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export function Signals() {
  const { signals, loading, lastUpdate, refresh } = useMultiSignals();
  const [filter, setFilter] = useState('All');
  const [selectedSignal, setSelectedSignal] = useState<LiveSignal | null>(null);
  const filters = ['All', '🟢 Buy', '🔴 Sell', '💪 Strong', '⚡ Active'];

  const filtered = useMemo(() => {
    if (filter === 'All') return signals;
    if (filter.includes('Buy')) return signals.filter(s => s.signal.includes('BUY'));
    if (filter.includes('Sell')) return signals.filter(s => s.signal.includes('SELL'));
    if (filter.includes('Strong')) return signals.filter(s => s.signal.includes('STRONG'));
    if (filter.includes('Active')) return signals.filter(s => s.signal !== 'NEUTRAL');
    return signals;
  }, [signals, filter]);

  const buyCount = signals.filter(s => s.signal.includes('BUY')).length;
  const sellCount = signals.filter(s => s.signal.includes('SELL')).length;
  const avgConf = signals.length > 0
    ? Math.round(signals.reduce((a, s) => a + s.confidence, 0) / signals.length)
    : 0;

  return (
    <div className="p-4 pt-10 min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-foreground">Trading Signals</h1>
        <button
          onClick={refresh}
          className="w-9 h-9 rounded-full bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:scale-90"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin text-accent' : ''} />
        </button>
      </div>

      {/* Summary Bar */}
      <div className="glass-panel rounded-xl p-3 mb-4 flex justify-between items-center text-xs font-mono border border-border">
        <span className="text-muted-foreground">Signals: <strong className="text-foreground">{signals.length}</strong></span>
        <span className="text-primary flex items-center gap-1"><TrendingUp size={11} /> {buyCount} Buy</span>
        <span className="text-destructive flex items-center gap-1"><TrendingDown size={11} /> {sellCount} Sell</span>
        <span className="text-accent">Avg {avgConf}%</span>
      </div>

      {lastUpdate > 0 && (
        <p className="text-[10px] text-muted-foreground text-right mb-2">Updated {timeAgo(lastUpdate)}</p>
      )}

      {/* Filter Chips */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2 mb-4">
        {filters.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              filter === f ? 'bg-foreground text-background shadow-md' : 'bg-card text-muted-foreground border border-border'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Activity size={32} className="text-accent animate-pulse" />
          <p className="text-sm text-muted-foreground">Running signal engine on {signals.length > 0 ? signals.length : 8} symbols...</p>
        </div>
      )}

      {/* Signals List */}
      {!loading && (
        <div className="space-y-4 pb-24">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">No signals match this filter</p>
            </div>
          ) : (
            filtered.map((sig, i) => {
              const isBuy = sig.signal.includes('BUY');
              const isActive = sig.signal !== 'NEUTRAL';
              return (
                <motion.div
                  key={sig.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-panel border border-border rounded-2xl p-4 overflow-hidden relative"
                >
                  {/* Side color bar */}
                  {isActive && (
                    <div className={`absolute top-0 left-0 w-1 h-full ${isBuy ? 'bg-primary' : 'bg-destructive'}`} />
                  )}

                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-input rounded-full flex items-center justify-center font-bold text-sm text-foreground border border-white/5">
                        {sig.symbol.substring(0, 2)}
                      </div>
                      <div>
                        <h3 className="font-bold text-foreground text-base flex items-center gap-1.5">
                          {sig.symbol}
                          <SignalIcon signal={sig.signal} />
                        </h3>
                        <p className="text-xs text-muted-foreground">{sig.stockName} · {timeAgo(sig.timestamp)}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase tracking-wider ${SIGNAL_BG[sig.signal] || 'bg-muted text-muted-foreground'}`}>
                        {sig.signal.replace('_', ' ')}
                      </span>
                      <span className="text-xs font-mono font-bold text-accent">{sig.confidence}% Conf</span>
                    </div>
                  </div>

                  {/* Score bar */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] text-muted-foreground w-12 shrink-0">Score {sig.score > 0 ? '+' : ''}{sig.score}</span>
                    <div className="flex-1 h-1.5 bg-input rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${SIGNAL_BAR[sig.signal] || 'bg-muted'}`}
                        style={{ width: `${sig.confidence}%` }}
                      />
                    </div>
                  </div>

                  {/* Trade Setup grid */}
                  <div className="grid grid-cols-4 gap-1.5 mb-3 bg-input/50 p-2.5 rounded-xl border border-white/5">
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase flex items-center gap-0.5">
                        <ArrowRight size={8} /> Entry
                      </p>
                      <p className="font-mono font-bold text-xs mt-0.5">₹{sig.tradeSetup.entry.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase flex items-center gap-0.5">
                        <Target size={8} /> T1
                      </p>
                      <p className="font-mono font-bold text-xs mt-0.5 text-primary">₹{sig.tradeSetup.target1.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase flex items-center gap-0.5">
                        <ShieldAlert size={8} /> SL
                      </p>
                      <p className="font-mono font-bold text-xs mt-0.5 text-destructive">₹{sig.tradeSetup.stopLoss.toFixed(0)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] text-muted-foreground uppercase">R:R</p>
                      <p className="font-mono font-bold text-xs mt-0.5">1:{sig.tradeSetup.riskRewardRatio}</p>
                    </div>
                  </div>

                  {/* Patterns */}
                  {(sig.candlePatterns.length > 0 || sig.chartPatterns.length > 0) && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {sig.candlePatterns.slice(0, 2).map(p => (
                        <span key={p.name} className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary">🕯️ {p.name}</span>
                      ))}
                      {sig.chartPatterns.slice(0, 1).map(p => (
                        <span key={p.name} className="text-[9px] px-1.5 py-0.5 rounded bg-accent/10 text-accent">📐 {p.name}</span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedSignal(sig)}
                      className="flex-1 py-2.5 rounded-xl border border-border bg-card text-xs font-bold text-foreground flex items-center justify-center gap-2 hover:bg-input transition-colors"
                    >
                      <BrainCircuit size={13} className="text-[#FFD700]" /> Details
                    </button>
                    {isActive ? (
                      <button className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-background shadow-lg transition-transform active:scale-95 ${
                        isBuy ? 'bg-primary shadow-primary/20' : 'bg-destructive shadow-destructive/20'
                      }`}>
                        {isBuy ? 'Execute BUY' : 'Execute SHORT'}
                      </button>
                    ) : (
                      <button className="flex-1 py-2.5 rounded-xl border border-border bg-card text-xs font-bold text-muted-foreground flex items-center justify-center gap-1.5">
                        <RefreshCw size={12} /> Wait
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      )}

      {/* Signal Detail Modal */}
      {selectedSignal && (
        <SignalDetailModal signal={selectedSignal} onClose={() => setSelectedSignal(null)} />
      )}
    </div>
  );
}
