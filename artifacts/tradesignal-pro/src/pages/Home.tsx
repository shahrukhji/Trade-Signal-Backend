import { useState, useEffect } from 'react';
import { Link } from 'wouter';
import { Bell, TrendingUp, TrendingDown, Target, BrainCircuit, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { motion } from 'framer-motion';

interface IndexQuote {
  name: string;
  token: string;
  exchange: string;
  ltp: number;
  change: number;
  percentChange: number;
}

interface HotSignal {
  symbol: string;
  signal: string;
  ltp: number;
  score: number;
  rsi?: number;
}

function isMarketOpen(): boolean {
  const now = new Date();
  const day = now.getDay();
  const h = now.getHours(), m = now.getMinutes();
  const total = h * 60 + m;
  return day >= 1 && day <= 5 && total >= 9 * 60 + 15 && total <= 15 * 60 + 30;
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
}

// ─── Indices strip ─────────────────────────────────────────────────────────────
function useIndices() {
  const [indices, setIndices] = useState<IndexQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState<boolean | null>(null);

  const fetch_ = async () => {
    try {
      const res = await fetch('/api/market/indices');
      const json = await res.json();
      if (json.success && Array.isArray(json.data) && json.data.length > 0) {
        setIndices(json.data.filter((d: IndexQuote) => d.ltp > 0));
        setConnected(true);
      } else {
        setConnected(false);
      }
    } catch {
      setConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, 60_000); // refresh every 60s
    return () => clearInterval(id);
  }, []);

  return { indices, loading, connected, refresh: fetch_ };
}

// ─── Hot signals ──────────────────────────────────────────────────────────────
function useHotSignals() {
  const [signals, setSignals] = useState<HotSignal[]>([]);

  useEffect(() => {
    fetch('/api/signals/?limit=6&minConfidence=55')
      .then(r => r.json())
      .then(json => {
        if (json.success && Array.isArray(json.data)) {
          setSignals(json.data.slice(0, 5).map((d: any) => ({
            symbol: d.symbol,
            signal: d.signal,
            ltp: d.ltp || 0,
            score: d.score || 0,
            rsi: d.rsi,
          })));
        }
      })
      .catch(() => {});

    // Refresh every 5 minutes
    const id = setInterval(() => {
      fetch('/api/signals/?limit=6&minConfidence=55')
        .then(r => r.json())
        .then(json => {
          if (json.success && Array.isArray(json.data)) {
            setSignals(json.data.slice(0, 5).map((d: any) => ({
              symbol: d.symbol, signal: d.signal, ltp: d.ltp || 0,
              score: d.score || 0, rsi: d.rsi,
            })));
          }
        }).catch(() => {});
    }, 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  return signals;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function Home() {
  const [greeting] = useState(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Morning';
    if (h < 18) return 'Afternoon';
    return 'Evening';
  });
  const [now, setNow] = useState(new Date());
  const { indices, loading: indicesLoading, connected, refresh: refreshIndices } = useIndices();
  const hotSignals = useHotSignals();
  const marketOpen = isMarketOpen();

  // Update clock every minute
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="p-4 pt-10 min-h-screen">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">TradeSignal Pro</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${marketOpen ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
            {marketOpen ? 'Market Open' : 'Market Closed'}
            {connected !== null && (
              <span className="ml-1">
                {connected ? <Wifi size={11} className="text-primary inline" /> : <WifiOff size={11} className="text-muted-foreground inline" />}
              </span>
            )}
          </p>
        </div>
        <button className="touch-target bg-card rounded-full border border-border text-foreground hover:bg-white/5 transition-colors p-2">
          <Bell size={20} />
        </button>
      </div>

      {/* Greeting */}
      <div className="mb-6">
        <h2 className="text-2xl font-light text-foreground">
          Good {greeting}, <span className="font-bold">Trader! 👋</span>
        </h2>
        <p className="text-muted-foreground text-sm mt-1 font-mono">
          {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
          {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>

      {/* Market Indices */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Live Market</h3>
        <button onClick={refreshIndices} className="text-muted-foreground hover:text-foreground transition-colors">
          <RefreshCw size={13} className={indicesLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex overflow-x-auto no-scrollbar gap-3 pb-4 mb-6 -mx-4 px-4 snap-x">
        {indicesLoading && indices.length === 0 ? (
          // Skeleton
          [1, 2, 3, 4].map(i => (
            <div key={i} className="snap-start shrink-0 w-[140px] glass-panel p-3 rounded-xl border border-border animate-pulse">
              <div className="h-3 w-20 bg-border rounded mb-2" />
              <div className="h-5 w-24 bg-border rounded mb-1" />
              <div className="h-3 w-12 bg-border rounded" />
            </div>
          ))
        ) : indices.length > 0 ? (
          indices.map(idx => (
            <div key={idx.token} className="snap-start shrink-0 w-[148px] glass-panel p-3 rounded-xl border border-border">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium truncate">{idx.name}</p>
              <p className="text-sm font-mono font-bold text-foreground">{fmt(idx.ltp)}</p>
              <p className={`text-xs font-mono mt-1 flex items-center gap-1 ${idx.percentChange >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {idx.percentChange >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {idx.percentChange >= 0 ? '+' : ''}{idx.percentChange.toFixed(2)}%
              </p>
            </div>
          ))
        ) : (
          // Offline fallback — show placeholder cards
          [
            { name: 'NIFTY 50', note: 'Connecting...' },
            { name: 'BANK NIFTY', note: 'Connecting...' },
            { name: 'SENSEX', note: 'Connecting...' },
          ].map(idx => (
            <div key={idx.name} className="snap-start shrink-0 w-[148px] glass-panel p-3 rounded-xl border border-border opacity-50">
              <p className="text-[10px] text-muted-foreground mb-1">{idx.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{idx.note}</p>
            </div>
          ))
        )}
      </div>

      {/* AI Scanner Button */}
      <Link href="/scanner" className="w-full flex items-center justify-between bg-gradient-to-r from-card to-[#1a1a2e] border border-accent/30 p-4 rounded-2xl mb-6 shadow-[0_0_20px_rgba(0,191,255,0.15)] active:scale-[0.98] transition-transform cursor-pointer">
        <div className="flex items-center gap-3">
          <div className="bg-accent/20 p-2 rounded-full text-accent">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h3 className="font-bold text-foreground">AI Market Scanner</h3>
            <p className="text-xs text-muted-foreground">Scan NIFTY50 for live setups</p>
          </div>
        </div>
        <div className="bg-accent text-background text-xs font-bold px-3 py-1.5 rounded-full">
          RUN SCAN
        </div>
      </Link>

      {/* Hot Signals */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">
          Top Signals {hotSignals.length > 0 && <span className="text-primary ml-1">({hotSignals.length})</span>}
        </h3>
        <Link href="/signals" className="text-xs text-accent font-medium">View All</Link>
      </div>

      {hotSignals.length === 0 ? (
        <div className="glass-panel p-6 rounded-xl border border-border text-center">
          <Target size={24} className="mx-auto mb-2 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">Scanning NIFTY50 for signals...</p>
          <p className="text-xs text-muted-foreground mt-1 opacity-60">Results appear after first scan</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {hotSignals.map(sig => {
            const isBuy = sig.signal.includes('BUY');
            const isSell = sig.signal.includes('SELL');
            return (
              <motion.div
                key={sig.symbol}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-4 rounded-xl flex items-center justify-between border border-border"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                    isBuy ? 'bg-primary/20 text-primary' : isSell ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                  }`}>
                    {sig.symbol.substring(0, 2)}
                  </div>
                  <div>
                    <p className="font-bold text-foreground font-mono">{sig.symbol}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {sig.rsi !== undefined ? `RSI ${sig.rsi.toFixed(0)}` : 'NIFTY 50'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className={`text-xs font-bold px-2 py-1 rounded mb-1 ${
                    isBuy ? 'bg-primary/10 text-primary' : isSell ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'
                  }`}>
                    {isBuy ? '🟢' : isSell ? '🔴' : '⚪'} {sig.signal.replace('_', ' ')}
                  </p>
                  {sig.ltp > 0 && (
                    <p className="text-sm font-mono font-medium">₹{fmt(sig.ltp)}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center mt-8 opacity-50">
        Live data from Angel One SmartAPI · Made with ❤️ by Shahrukh
      </p>
    </div>
  );
}
