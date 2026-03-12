import { useState } from 'react';
import { useStore } from '@/store/use-store';
import { PieChart, Wallet, ArrowUpRight, ArrowDownRight, History } from 'lucide-react';
import { motion } from 'framer-motion';

const HOLDINGS = [
  { symbol: 'RELIANCE', qty: 50, avg: 2850, cmp: 2950.4, pnl: 5020, pnlPct: 3.5 },
  { symbol: 'TCS', qty: 20, avg: 3900, cmp: 3850.1, pnl: -998, pnlPct: -1.2 },
  { symbol: 'HDFCBANK', qty: 100, avg: 1400, cmp: 1450.5, pnl: 5050, pnlPct: 3.6 },
];

export function Portfolio() {
  const [tab, setTab] = useState('Holdings');
  const { paperMode } = useStore();

  return (
    <div className="p-4 pt-10 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
        {paperMode && <span className="bg-destructive/20 text-destructive text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wide">Paper Mode</span>}
      </div>

      {/* Main Card */}
      <div className="bg-gradient-to-br from-card to-input border border-border rounded-2xl p-5 mb-6 shadow-2xl relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl" />
        
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Total Value</p>
        <h2 className="text-3xl font-mono font-bold text-foreground mb-4">₹10,09,072.00</h2>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Invested</p>
            <p className="font-mono font-medium text-sm">₹8,50,000</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Overall P&L</p>
            <p className="font-mono font-bold text-sm text-primary flex items-center gap-1">
              <ArrowUpRight size={12} /> +₹9,072 (+1.06%)
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-input p-1 rounded-xl mb-6">
        {['Holdings', 'Orders', 'History'].map(t => (
          <button 
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
              tab === t ? 'bg-card text-foreground shadow border border-white/5' : 'text-muted-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-3">
        {tab === 'Holdings' && HOLDINGS.map((h, i) => (
          <motion.div 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            key={h.symbol} 
            className="glass-panel border border-border rounded-xl p-4 flex justify-between items-center"
          >
            <div>
              <h3 className="font-bold text-foreground">{h.symbol}</h3>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{h.qty} qty • Avg ₹{h.avg}</p>
            </div>
            <div className="text-right">
              <p className="font-mono font-bold text-sm">₹{h.cmp}</p>
              <p className={`text-xs font-mono mt-0.5 ${h.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {h.pnl >= 0 ? '+' : ''}₹{Math.abs(h.pnl)} ({h.pnlPct}%)
              </p>
            </div>
          </motion.div>
        ))}

        {tab === 'Orders' && (
          <div className="text-center py-10">
            <Wallet className="mx-auto text-muted-foreground mb-3 opacity-50" size={40} />
            <p className="text-muted-foreground text-sm">No open orders</p>
          </div>
        )}

        {tab === 'History' && (
          <div className="text-center py-10">
            <History className="mx-auto text-muted-foreground mb-3 opacity-50" size={40} />
            <p className="text-muted-foreground text-sm">Trade history empty</p>
          </div>
        )}
      </div>
    </div>
  );
}
