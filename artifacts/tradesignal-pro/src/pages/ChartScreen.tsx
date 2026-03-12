import { useState } from 'react';
import { Search, BrainCircuit, Activity, ChevronDown, Plus, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChartWidget } from '@/components/ChartWidget';
import { useMarketData, useIndicators, useSignalAnalysis } from '@/hooks/use-trading';
import { useToast } from '@/hooks/use-toast';

export function ChartScreen() {
  const [symbol, setSymbol] = useState('RELIANCE-EQ');
  const [timeframe, setTimeframe] = useState('15m');
  const { data, loading, currentPrice, change } = useMarketData(symbol, timeframe);
  const indicators = useIndicators();
  const { analyze, analyzing, result } = useSignalAnalysis();
  const { toast } = useToast();

  const [showOrderModal, setShowOrderModal] = useState(false);

  const TIMEFRAMES = ['1m', '3m', '5m', '15m', '30m', '1H', '4H', '1D'];

  const handleAIAnalysis = () => {
    analyze(symbol);
    toast({
      title: "AI Analysis Started",
      description: `Analyzing ${symbol} with Gemini...`,
    });
  };

  const handleExecute = () => {
    setShowOrderModal(true);
  };

  return (
    <div className="relative min-h-screen pb-24">
      {/* Header Search & Info */}
      <div className="p-4 bg-background z-20 relative">
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
            <input 
              type="text" 
              value={symbol}
              onChange={(e) => setSymbol(e.target.value.toUpperCase())}
              className="w-full bg-input border border-border rounded-xl h-12 pl-10 pr-4 text-foreground focus:border-accent focus:ring-1 focus:ring-accent outline-none font-mono text-sm"
              placeholder="Search symbol..."
            />
          </div>
          <button className="w-12 h-12 bg-card border border-border rounded-xl flex items-center justify-center text-foreground active:scale-95 transition-transform">
            <Plus size={20} />
          </button>
        </div>

        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold font-mono text-foreground flex items-center gap-2">
              {symbol} <span className="bg-accent/20 text-accent text-[10px] px-1.5 py-0.5 rounded font-sans">NSE</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xl font-mono font-medium">₹{currentPrice.toFixed(2)}</span>
              <span className={`text-sm font-mono font-medium ${change >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {change >= 0 ? '+' : ''}{change.toFixed(2)}%
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase">Vol: 1.2M</p>
            <p className="text-xs text-muted-foreground uppercase">O: 2940 H: 2965 L: 2930</p>
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

      {/* Chart Area */}
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
              {analyzing ? 'Analyzing Setup...' : 'AI Deep Analysis'}
            </span>
          </div>
        </button>
      </div>

      {/* Technicals Preview */}
      <div className="px-4 pb-20">
        <div className="glass-panel rounded-xl p-4 border border-border">
          <h3 className="text-sm font-bold uppercase text-muted-foreground mb-3">Live Indicators</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">RSI (14)</p>
              <p className={`font-mono font-bold ${indicators.RSI < 30 ? 'text-primary' : indicators.RSI > 70 ? 'text-destructive' : 'text-foreground'}`}>
                {indicators.RSI}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Supertrend</p>
              <p className={`font-mono font-bold ${indicators.Supertrend.signal === 'BUY' ? 'text-primary' : 'text-destructive'}`}>
                {indicators.Supertrend.value}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Patterns</p>
              <p className="text-xs font-bold text-accent truncate">{indicators.patterns.candlestick[0]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">EMA Crossover</p>
              <p className="text-xs font-bold text-primary flex items-center"><TrendingUp size={12} className="mr-1"/> Bullish</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Signal Result / Action Box */}
      <AnimatePresence>
        {result && (
          <motion.div 
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-[64px] w-full max-w-md bg-card/95 backdrop-blur-xl border-t border-border p-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-40"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 text-xs font-bold rounded bg-primary/20 text-primary`}>
                  {result.signal}
                </span>
                <span className="text-sm font-bold text-foreground">{result.confidence}% Conf.</span>
              </div>
              <span className="text-xs font-mono font-bold text-muted-foreground">R:R 1:{result.riskReward}</span>
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

      {/* Trade Modal Overlay */}
      <AnimatePresence>
        {showOrderModal && result && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="w-full max-w-md bg-card rounded-t-3xl border-t border-border p-6 shadow-2xl"
            >
              <h2 className="text-xl font-bold mb-4">Place Order</h2>
              
              <div className="space-y-4 mb-6">
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
                    toast({ title: "Order Placed", description: "Your order was submitted successfully."});
                    setShowOrderModal(false);
                    setResult(null);
                  }} 
                  className="flex-1 py-3.5 rounded-xl bg-primary text-background font-bold shadow-[0_0_15px_rgba(0,255,136,0.3)]"
                >
                  Confirm BUY
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
