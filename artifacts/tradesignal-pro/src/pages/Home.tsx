import { useState } from 'react';
import { Link } from 'wouter';
import { Bell, Search, TrendingUp, TrendingDown, Target, BrainCircuit, Activity } from 'lucide-react';
import { motion } from 'framer-motion';

const INDICES = [
  { name: 'NIFTY 50', price: 22450.50, change: +0.85 },
  { name: 'BANKNIFTY', price: 47890.10, change: -0.21 },
  { name: 'SENSEX', price: 73900.00, change: +0.72 },
  { name: 'INDIA VIX', price: 12.40, change: -2.50 },
];

const HOT_SIGNALS = [
  { symbol: 'RELIANCE', signal: 'STRONG BUY', price: 2950.4, time: '2m ago', score: 88 },
  { symbol: 'HDFCBANK', signal: 'SELL', price: 1450.1, time: '15m ago', score: -65 },
];

export function Home() {
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 18) return 'Afternoon';
    return 'Evening';
  });

  return (
    <div className="p-4 pt-10 min-h-screen">
      {/* Top Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">TradeSignal Pro</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Market Open
          </p>
        </div>
        <button className="touch-target bg-card rounded-full border border-border text-foreground hover:bg-white/5 transition-colors">
          <Bell size={20} />
        </button>
      </div>

      {/* Greeting */}
      <div className="mb-6">
        <h2 className="text-2xl font-light text-foreground">
          Good {greeting}, <span className="font-bold">Trader! 👋</span>
        </h2>
        <p className="text-muted-foreground text-sm mt-1 font-mono">
          {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} • 
          {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* 2x2 Grid Cards */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        <motion.div whileTap={{ scale: 0.98 }} className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-28">
          <p className="text-xs text-muted-foreground font-medium uppercase">Portfolio Value</p>
          <div>
            <h3 className="text-xl font-bold font-mono text-foreground">₹10,04,500</h3>
            <p className="text-xs text-primary font-mono mt-1 flex items-center"><TrendingUp size={12} className="mr-1"/> +4.5% All time</p>
          </div>
        </motion.div>
        
        <motion.div whileTap={{ scale: 0.98 }} className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-28 border-primary/20">
          <p className="text-xs text-muted-foreground font-medium uppercase">Today's P&L</p>
          <div>
            <h3 className="text-xl font-bold font-mono text-primary">+₹12,450</h3>
            <p className="text-xs text-primary font-mono mt-1">+1.24%</p>
          </div>
        </motion.div>

        <motion.div whileTap={{ scale: 0.98 }} className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-28">
          <p className="text-xs text-muted-foreground font-medium uppercase">Win Rate</p>
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#1A1A2E" strokeWidth="4" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="#00BFFF" strokeWidth="4" strokeDasharray="68, 100" />
              </svg>
              <span className="absolute text-[10px] font-bold">68%</span>
            </div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </div>
        </motion.div>

        <motion.div whileTap={{ scale: 0.98 }} className="glass-panel p-4 rounded-2xl flex flex-col justify-between h-28">
          <p className="text-xs text-muted-foreground font-medium uppercase">Active Signals</p>
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold text-accent">8</h3>
            <div className="bg-accent/20 text-accent p-2 rounded-full"><Target size={18} /></div>
          </div>
        </motion.div>
      </div>

      {/* Market Indices Scroll */}
      <h3 className="text-sm font-bold text-foreground mb-3 uppercase tracking-wider">Market Overview</h3>
      <div className="flex overflow-x-auto no-scrollbar gap-3 pb-4 mb-4 -mx-4 px-4 snap-x">
        {INDICES.map(idx => (
          <div key={idx.name} className="snap-start shrink-0 w-[140px] glass-panel p-3 rounded-xl border border-border">
            <p className="text-xs text-muted-foreground mb-1">{idx.name}</p>
            <p className="text-sm font-mono font-bold">{idx.price.toLocaleString('en-IN')}</p>
            <p className={`text-xs font-mono mt-1 ${idx.change >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {idx.change >= 0 ? '+' : ''}{idx.change}%
            </p>
          </div>
        ))}
      </div>

      {/* AI Scanner Button */}
      <Link href="/scanner" className="w-full flex items-center justify-between bg-gradient-to-r from-card to-[#1a1a2e] border border-accent/30 p-4 rounded-2xl mb-8 shadow-[0_0_20px_rgba(0,191,255,0.15)] active:scale-[0.98] transition-transform cursor-pointer">
        <div className="flex items-center gap-3">
          <div className="bg-accent/20 p-2 rounded-full text-accent">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h3 className="font-bold text-foreground">AI Market Scanner</h3>
            <p className="text-xs text-muted-foreground">Scan NIFTY50 for setups</p>
          </div>
        </div>
        <div className="bg-accent text-background text-xs font-bold px-3 py-1.5 rounded-full">
          RUN SCAN
        </div>
      </Link>

      {/* Hot Signals */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Hot Signals</h3>
        <Link href="/signals" className="text-xs text-accent font-medium">View All</Link>
      </div>
      <div className="flex flex-col gap-3">
        {HOT_SIGNALS.map(sig => (
          <div key={sig.symbol} className="glass-panel p-4 rounded-xl flex items-center justify-between border border-border">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${sig.score > 0 ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}`}>
                {sig.symbol.substring(0, 2)}
              </div>
              <div>
                <p className="font-bold text-foreground">{sig.symbol}</p>
                <p className="text-xs text-muted-foreground">{sig.time}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-xs font-bold px-2 py-1 rounded mb-1 ${sig.score > 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'}`}>
                {sig.signal}
              </p>
              <p className="text-sm font-mono font-medium">₹{sig.price}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
