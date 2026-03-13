import { useState } from 'react';
import { Search, BrainCircuit, Activity, Plus, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChartWidget } from '@/components/ChartWidget';
import { useMarketData, useIndicators, useSignalAnalysis } from '@/hooks/use-trading';
import { useToast } from '@/hooks/use-toast';

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

export function ChartScreen() {
  const [symbol, setSymbol] = useState('RELIANCE-EQ');
  const [timeframe, setTimeframe] = useState('15m');
  const { data, loading, currentPrice, change } = useMarketData(symbol, timeframe);
  const indicators = useIndicators(symbol);
  const { analyze, analyzing, result, setResult } = useSignalAnalysis();
  const { toast } = useToast();
  const [showOrderModal, setShowOrderModal] = useState(false);

  const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1H', '4H', '1D'];

  const handleAIAnalysis = () => {
    analyze(symbol);
    toast({ title: '🧠 Engine Analysis Started', description: `Running 20 indicators on ${symbol}...` });
  };

  const handleExecute = () => setShowOrderModal(true);

  const rsi = indicators.RSI;
  const supertrend = indicators.Supertrend;
  const macd = indicators.MACD;
  const candlePattern = indicators.patterns.candlestick[0];
  const chartPattern = indicators.patterns.chart[0];
  const liveSignal = indicators.liveSignal;

  return (
    <div className="relative min-h-screen pb-24">
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

      {/* AI Analysis Button */}
      <div className="p-4">
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
              {analyzing ? 'Running 20 Indicators...' : 'Deep Signal Analysis'}
            </span>
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

          {/* Pattern row */}
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

      {/* Sticky Signal Result */}
      <AnimatePresence>
        {result && (
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
              <span className="text-xs font-mono font-bold text-muted-foreground">R:R 1:{result.riskReward}</span>
            </div>

            {/* Top reason */}
            {result.reasons?.[0] && (
              <p className="text-[11px] text-muted-foreground mb-3 line-clamp-2">{result.reasons[0]}</p>
            )}

            {/* Trade grid */}
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
              <button onClick={() => setResult(null)} className="px-4 py-3 rounded-xl bg-secondary text-foreground text-sm font-bold">
                Dismiss
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
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-card rounded-t-3xl border-t border-border p-6 shadow-2xl"
            >
              <h2 className="text-xl font-bold mb-1">Place Order</h2>
              <p className="text-xs text-muted-foreground mb-4">{result.summary?.slice(0, 100)}...</p>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between p-3 bg-input rounded-xl">
                  <span className="text-muted-foreground text-sm">Symbol</span>
                  <span className="font-bold">{result.symbol}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-input rounded-xl">
                    <span className="text-muted-foreground text-xs block mb-1">Entry Price</span>
                    <input type="number" defaultValue={result.entry} className="bg-transparent w-full font-mono font-bold text-foreground outline-none" />
                  </div>
                  <div className="p-3 bg-input rounded-xl">
                    <span className="text-muted-foreground text-xs block mb-1">Stop Loss</span>
                    <input type="number" defaultValue={result.stopLoss} className="bg-transparent w-full font-mono font-bold text-destructive outline-none" />
                  </div>
                </div>
                <div className="p-3 bg-input rounded-xl flex justify-between items-center">
                  <span className="text-muted-foreground text-sm">Quantity</span>
                  <input type="number" defaultValue={100} className="bg-transparent w-24 text-right font-mono font-bold text-foreground outline-none border-b border-border focus:border-accent" />
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowOrderModal(false)} className="flex-1 py-3.5 rounded-xl bg-secondary text-foreground font-bold">
                  Cancel
                </button>
                <button
                  onClick={() => {
                    toast({ title: '✅ Order Placed', description: 'Your paper trade was submitted.' });
                    setShowOrderModal(false);
                    setResult(null);
                  }}
                  className={`flex-1 py-3.5 rounded-xl font-bold shadow-lg ${
                    result.signal.includes('SELL') ? 'bg-destructive text-background shadow-destructive/20' : 'bg-primary text-background shadow-primary/20'
                  }`}
                >
                  Confirm {result.signal.includes('SELL') ? 'SHORT' : 'BUY'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
