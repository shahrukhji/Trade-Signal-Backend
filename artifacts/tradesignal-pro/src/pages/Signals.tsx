import { useState } from 'react';
import { Target, ShieldAlert, ArrowRight, BrainCircuit, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';

const MOCK_SIGNALS = [
  { id: 1, symbol: 'RELIANCE', type: 'STRONG BUY', conf: 88, entry: 2950, t1: 2980, sl: 2910, rr: '1:2.5', time: '10m ago', active: true },
  { id: 2, symbol: 'INFY', type: 'SELL', conf: 75, entry: 1420, t1: 1390, sl: 1440, rr: '1:1.5', time: '1h ago', active: true },
  { id: 3, symbol: 'TCS', type: 'WEAK BUY', conf: 55, entry: 3850, t1: 3900, sl: 3820, rr: '1:1.6', time: '2h ago', active: false },
  { id: 4, symbol: 'HDFCBANK', type: 'STRONG SELL', conf: 92, entry: 1450, t1: 1400, sl: 1470, rr: '1:2.5', time: '3h ago', active: false },
];

export function Signals() {
  const [filter, setFilter] = useState('All');
  const filters = ['All', '🟢Buy', '🔴Sell', '💪Strong', '⚡Active'];

  return (
    <div className="p-4 pt-10 min-h-screen">
      <h1 className="text-2xl font-bold text-foreground mb-4">Trading Signals</h1>
      
      {/* Summary Bar */}
      <div className="glass-panel rounded-xl p-3 mb-4 flex justify-between items-center text-xs font-mono border border-border">
        <span className="text-muted-foreground">Today: <strong className="text-foreground">5</strong></span>
        <span className="text-primary">3 Buy</span>
        <span className="text-destructive">2 Sell</span>
        <span className="text-accent">Avg 78%</span>
      </div>

      {/* Filter Chips */}
      <div className="flex overflow-x-auto no-scrollbar gap-2 pb-2 mb-4">
        {filters.map(f => (
          <button 
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 px-4 py-2 rounded-full text-xs font-bold transition-all ${
              filter === f 
                ? 'bg-foreground text-background shadow-md' 
                : 'bg-card text-muted-foreground border border-border'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Signals List */}
      <div className="space-y-4">
        {MOCK_SIGNALS.map((sig, i) => (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={sig.id} 
            className="glass-panel border border-border rounded-2xl p-4 overflow-hidden relative"
          >
            {/* Active Indicator Glow */}
            {sig.active && (
              <div className={`absolute top-0 left-0 w-1 h-full ${sig.type.includes('BUY') ? 'bg-primary' : 'bg-destructive'} shadow-[0_0_10px_currentColor]`} />
            )}
            
            <div className="flex justify-between items-start mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-input rounded-full flex items-center justify-center font-bold text-sm text-foreground border border-white/5">
                  {sig.symbol.substring(0, 2)}
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-lg">{sig.symbol}</h3>
                  <p className="text-xs text-muted-foreground">{sig.time}</p>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className={`px-2 py-1 text-[10px] font-bold rounded uppercase tracking-wider mb-1 ${
                  sig.type.includes('BUY') ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'
                }`}>
                  {sig.type}
                </span>
                <span className="text-xs font-mono font-bold text-accent">{sig.conf}% Conf</span>
              </div>
            </div>

            {/* Confidence Bar */}
            <div className="w-full h-1 bg-input rounded-full mb-4 overflow-hidden">
              <div 
                className={`h-full ${sig.type.includes('BUY') ? 'bg-primary' : 'bg-destructive'}`} 
                style={{ width: `${sig.conf}%` }} 
              />
            </div>

            {/* Price Grid */}
            <div className="grid grid-cols-3 gap-2 mb-4 bg-input/50 p-3 rounded-xl border border-white/5">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><ArrowRight size={10}/> Entry</p>
                <p className="font-mono font-bold text-sm mt-0.5">₹{sig.entry}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><Target size={10}/> Target 1</p>
                <p className="font-mono font-bold text-sm mt-0.5 text-primary">₹{sig.t1}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase flex items-center gap-1"><ShieldAlert size={10}/> Stop Loss</p>
                <p className="font-mono font-bold text-sm mt-0.5 text-destructive">₹{sig.sl}</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <button className="flex-1 py-2.5 rounded-xl border border-border bg-card text-xs font-bold text-foreground flex items-center justify-center gap-2 hover:bg-input transition-colors">
                <BrainCircuit size={14} className="text-[#FFD700]" /> Details
              </button>
              {sig.active ? (
                <button className={`flex-1 py-2.5 rounded-xl text-xs font-bold text-background shadow-lg transition-transform active:scale-95 ${
                  sig.type.includes('BUY') ? 'bg-primary shadow-primary/20' : 'bg-destructive shadow-destructive/20'
                }`}>
                  Execute Trade
                </button>
              ) : (
                <button className="flex-1 py-2.5 rounded-xl border border-border bg-card text-xs font-bold text-muted-foreground flex items-center justify-center gap-2">
                  <RefreshCw size={14} /> Closed
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
