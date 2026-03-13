import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/use-store';
import { angelOne } from '@/broker/angelOne';
import type { Holding, Position, OrderBook, WalletBalance } from '@/broker/angelOne';
import {
  RefreshCw, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  History, Clock, AlertCircle, Loader2,
  Zap, LogOut, User, Wifi, WifiOff, BarChart3,
  Shield, Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

interface LivePosition {
  symbol: string; tradingSymbol: string; symbolToken: string;
  exchange: string; productType: string; side: 'BUY' | 'SELL';
  netQty: number; avgPrice: number; ltp: number;
  unrealisedPnl: number; pnlPct: number; dayChange: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);
const fmtC = (n: number) => `₹${fmt(Math.abs(n))}`;
const maskEmail = (e: string) => {
  if (!e?.includes('@')) return e || '—';
  const [l, d] = e.split('@'); return `${l.slice(0, 3)}***@${d}`;
};
const maskPhone = (p: string) => {
  if (!p || p.length < 6) return p || '—';
  return `${p.slice(0, 2)}****${p.slice(-4)}`;
};

function StatusBadge({ status }: { status: OrderBook['status'] }) {
  const map: Record<OrderBook['status'], { color: string; label: string }> = {
    complete: { color: 'text-primary bg-primary/10 border-primary/20', label: 'Complete' },
    open: { color: 'text-accent bg-accent/10 border-accent/20', label: 'Open' },
    cancelled: { color: 'text-muted-foreground bg-muted/10 border-white/10', label: 'Cancelled' },
    rejected: { color: 'text-destructive bg-destructive/10 border-destructive/20', label: 'Rejected' },
    pending: { color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20', label: 'Pending' },
    'trigger pending': { color: 'text-orange-400 bg-orange-400/10 border-orange-400/20', label: 'Trigger' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${s.color}`}>
      {s.label}
    </span>
  );
}

type Tab = 'Account' | 'Holdings' | 'Positions' | 'Orders';

export function Portfolio() {
  const { toast } = useToast();
  const {
    brokerProfile, brokerSession, brokerIsDemo, brokerApiKey,
    walletBalance, setWalletBalance,
    holdings, setHoldings,
    positions, setPositions,
    orderBook, setOrderBook,
    clearBrokerSession,
  } = useStore();

  const [tab, setTab] = useState<Tab>('Account');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sessionCountdown, setSessionCountdown] = useState('');
  const [latency, setLatency] = useState<number | null>(null);

  const [livePositions, setLivePositions] = useState<LivePosition[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [exitingSymbols, setExitingSymbols] = useState<Set<string>>(new Set());

  // Connected if either: frontend has session token OR backend returned real data (balance loaded)
  const isConnected = !!brokerSession || !!walletBalance;
  const profile = brokerProfile;
  const balance: WalletBalance | null = walletBalance;

  // ── Session countdown ───────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      if (brokerSession?.lastLoginTime) {
        const loginTime = new Date(brokerSession.lastLoginTime).getTime();
        const expiresAt = loginTime + 24 * 60 * 60 * 1000;
        const remaining = expiresAt - Date.now();
        if (remaining > 0) {
          const h = Math.floor(remaining / 3600000);
          const m = Math.floor((remaining % 3600000) / 60000);
          setSessionCountdown(`${h}h ${m}m`);
        } else { setSessionCountdown('Expired'); }
      }
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [brokerSession]);

  // ── Restore session ─────────────────────────────────────────────────────
  useEffect(() => {
    if (brokerSession && brokerApiKey) {
      angelOne.restoreSession(brokerSession, brokerIsDemo, brokerApiKey);
    }
  }, []);

  // ── Fetch all real Angel One data ──────────────────────────────────────
  const fetchAll = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    const t0 = Date.now();
    try {
      const [bal, hold, pos, orders] = await Promise.all([
        angelOne.getWalletBalance(),
        angelOne.getHoldings(),
        angelOne.getPositions(),
        angelOne.getOrderBook(),
      ]);
      setLatency(Date.now() - t0);
      setWalletBalance(bal);
      setHoldings(hold);
      setPositions(pos);
      setOrderBook(orders);
    } catch { /* silent — show stale data */ }
    setLoading(false);
    setRefreshing(false);
  }, [setWalletBalance, setHoldings, setPositions, setOrderBook]);

  useEffect(() => { fetchAll(); }, []);

  // ── Live positions (Angel One real positions enriched with live LTP) ────
  const fetchLive = useCallback(async () => {
    setLiveLoading(true);
    setLiveError('');
    try {
      const res = await fetch(`${BASE}/api/portfolio/live-positions`);
      const json = await res.json();
      if (json.success) setLivePositions(json.positions ?? []);
      else setLiveError(json.error ?? 'Failed to fetch');
    } catch { setLiveError('Network error'); }
    finally { setLiveLoading(false); }
  }, []);

  const exitPosition = useCallback(async (pos: LivePosition) => {
    setExitingSymbols(prev => new Set([...prev, pos.tradingSymbol]));
    try {
      const res = await fetch(`${BASE}/api/orders/exit-position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradingSymbol: pos.tradingSymbol, symbolToken: pos.symbolToken,
          exchange: pos.exchange, netQty: pos.netQty,
          side: pos.side, productType: pos.productType,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({ title: '✅ Exit Order Placed', description: `${json.exitSide} ${json.qty} × ${pos.symbol} sent to Angel One.` });
        setTimeout(fetchLive, 1500);
      } else throw new Error(json.error ?? 'Exit failed');
    } catch (err) {
      toast({ title: '❌ Exit Failed', description: err instanceof Error ? err.message : 'Failed', variant: 'destructive' });
    } finally {
      setExitingSymbols(prev => { const n = new Set(prev); n.delete(pos.tradingSymbol); return n; });
    }
  }, [fetchLive, toast]);

  useEffect(() => {
    if (tab !== 'Positions') return;
    fetchLive();
    const id = setInterval(fetchLive, 10_000);
    return () => clearInterval(id);
  }, [tab, fetchLive]);

  // ── Computed totals (from real Angel One holdings) ─────────────────────
  const totalInvested = holdings.reduce((s, h) => s + h.investedValue, 0);
  const totalCurrent = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const portfolioValue = balance?.totalPortfolioValue ?? totalCurrent;
  const availCash = balance?.availableCash ?? 0;
  const todayPnL = balance?.todayPnL ?? 0;

  const TABS: Tab[] = ['Account', 'Holdings', 'Positions', 'Orders'];

  return (
    <div className="p-4 pt-10 min-h-screen pb-28">
      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isConnected
              ? <><div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /><span className="text-[10px] text-primary font-semibold">Angel One Live</span></>
              : <><div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /><span className="text-[10px] text-muted-foreground">Not connected</span></>
            }
          </div>
        </div>
        <button
          onClick={() => fetchAll(true)}
          disabled={refreshing}
          className="p-2 rounded-xl bg-input border border-border text-muted-foreground active:scale-95 transition-transform"
        >
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Hero Card — real Angel One data ── */}
      <div className="bg-gradient-to-br from-card to-input border border-border rounded-2xl p-5 mb-5 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Portfolio Value</p>
        <h2 className="text-3xl font-mono font-bold text-foreground mb-4">
          {loading
            ? <span className="inline-flex items-center gap-2 text-muted-foreground text-xl"><Loader2 size={18} className="animate-spin" /> Loading...</span>
            : `₹${fmt(portfolioValue)}`
          }
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Invested</p>
            <p className="font-mono font-medium text-sm">{fmtC(totalInvested)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Overall P&L</p>
            <p className={`font-mono font-bold text-sm flex items-center gap-1 ${totalPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {totalPnL >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {totalPnL >= 0 ? '+' : '-'}{fmtC(totalPnL)} ({totalPnLPct.toFixed(2)}%)
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Today's P&L</p>
            <p className={`font-mono font-medium text-sm ${todayPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {todayPnL >= 0 ? '+' : '-'}{fmtC(todayPnL)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Available Cash</p>
            <p className="font-mono font-medium text-sm">{fmtC(availCash)}</p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-input p-1 rounded-xl mb-4 gap-1">
        {TABS.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === t ? 'bg-card text-foreground shadow border border-white/5' : 'text-muted-foreground'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >

          {/* ─────────── ACCOUNT TAB ─────────── */}
          {tab === 'Account' && (
            <div className="space-y-4">
              {/* Profile card */}
              <div className="bg-card border border-white/8 rounded-2xl p-5">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/30 to-accent/30 flex items-center justify-center text-xl font-bold text-foreground border border-white/10">
                    {profile?.avatarInitials || 'AO'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground text-base leading-tight">{profile?.clientName || 'Angel One'}</p>
                    <p className="text-xs text-muted-foreground">{profile?.clientId || (balance ? 'Authenticated via server' : 'Not connected')}</p>
                    <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${isConnected ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-destructive/10 border-destructive/20 text-destructive'}`}>
                      {isConnected ? <Wifi size={9} /> : <WifiOff size={9} />}
                      {isConnected ? 'Live Connected' : 'Disconnected'}
                    </div>
                  </div>
                </div>

                {profile && (
                  <div className="space-y-2">
                    {[
                      { label: 'Email', value: maskEmail(profile.email) },
                      { label: 'Phone', value: maskPhone(profile.phone) },
                      { label: 'Broker', value: profile.broker || 'Angel One' },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                        <span className="text-xs text-muted-foreground">{row.label}</span>
                        <span className="text-xs font-mono font-semibold text-foreground">{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!profile && balance && (
                  <p className="text-xs text-muted-foreground/70 text-center pt-2 border-t border-white/5">
                    Account data is live from Angel One. Log in via Settings to see full profile details.
                  </p>
                )}
              </div>

              {/* Session & Connection */}
              {isConnected && (
                <div className="bg-card border border-white/8 rounded-2xl p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 font-semibold">Session Info</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: <Clock size={12} />, label: 'Session Expires', value: sessionCountdown || '—' },
                      { icon: <Activity size={12} />, label: 'API Latency', value: latency ? `${latency}ms` : '—' },
                      { icon: <Shield size={12} />, label: 'Mode', value: brokerIsDemo ? 'Demo' : 'Live' },
                      { icon: <Zap size={12} />, label: 'Exchange', value: brokerSession?.exchanges?.[0] || 'NSE' },
                    ].map(item => (
                      <div key={item.label} className="bg-input rounded-xl p-3">
                        <div className="flex items-center gap-1 text-muted-foreground mb-1">{item.icon}<span className="text-[9px] uppercase tracking-wide">{item.label}</span></div>
                        <p className="text-sm font-bold font-mono text-foreground">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Funds Breakdown */}
              {balance && (
                <div className="bg-card border border-white/8 rounded-2xl p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 font-semibold">Funds Breakdown</p>
                  <div className="space-y-2">
                    {[
                      { label: 'Available Cash', value: fmtC(balance.availableCash ?? 0), positive: true },
                      { label: 'Total Portfolio Value', value: fmtC(balance.totalPortfolioValue ?? 0), positive: true },
                      { label: "Today's P&L", value: `${(balance.todayPnL ?? 0) >= 0 ? '+' : '-'}${fmtC(balance.todayPnL ?? 0)}`, positive: (balance.todayPnL ?? 0) >= 0 },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
                        <span className="text-xs text-muted-foreground">{row.label}</span>
                        <span className={`text-sm font-mono font-bold ${row.label.includes('P&L') ? (row.positive ? 'text-primary' : 'text-destructive') : 'text-foreground'}`}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Exchanges & Products */}
              {profile && (
                <div className="bg-card border border-white/8 rounded-2xl p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 font-semibold">Permissions</p>
                  <div className="mb-3">
                    <p className="text-[10px] text-muted-foreground mb-2">Exchanges</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(profile.exchanges || ['NSE', 'BSE']).map(ex => (
                        <span key={ex} className="px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold">{ex}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-2">Products</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(profile.products || ['DELIVERY', 'INTRADAY']).map(p => (
                        <span key={p} className="px-2.5 py-1 rounded-lg bg-accent/10 text-accent border border-accent/20 text-[10px] font-bold">{p}</span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Logout */}
              {isConnected && (
                <button
                  onClick={() => {
                    clearBrokerSession();
                    toast({ title: 'Disconnected', description: 'Angel One session cleared.' });
                  }}
                  className="w-full py-3.5 rounded-2xl bg-destructive/10 text-destructive border border-destructive/20 font-bold text-sm flex items-center justify-center gap-2"
                >
                  <LogOut size={15} /> Disconnect Angel One
                </button>
              )}
            </div>
          )}

          {/* ─────────── HOLDINGS TAB ─────────── */}
          {tab === 'Holdings' && (
            <div className="space-y-3">
              {/* Summary bar */}
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div className="bg-card border border-white/8 rounded-2xl p-3">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Invested</p>
                  <p className="font-mono font-bold text-sm">{fmtC(totalInvested)}</p>
                </div>
                <div className="bg-card border border-white/8 rounded-2xl p-3">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Current</p>
                  <p className={`font-mono font-bold text-sm ${totalPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmtC(totalCurrent)}</p>
                </div>
              </div>

              {loading && holdings.length === 0 && (
                <div className="text-center py-10"><Loader2 size={28} className="animate-spin text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">Loading holdings…</p></div>
              )}

              {!loading && holdings.length === 0 && (
                <div className="text-center py-12">
                  <BarChart3 size={36} className="mx-auto text-muted-foreground opacity-20 mb-3" />
                  <p className="text-sm text-muted-foreground">No holdings found</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Your Angel One equity holdings will appear here</p>
                </div>
              )}

              {holdings.map((h, i) => {
                const pnl = h.currentValue - h.investedValue;
                const pnlPct = h.investedValue > 0 ? (pnl / h.investedValue) * 100 : 0;
                return (
                  <motion.div
                    key={h.tradingSymbol + i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="bg-card border border-white/5 rounded-2xl p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-bold text-foreground text-sm">{h.tradingSymbol.replace('-EQ', '')}</p>
                        <p className="text-[10px] text-muted-foreground">Qty: {h.quantity} • LTP: ₹{fmt(h.ltp)}</p>
                      </div>
                      <div className="text-right">
                        <p className={`font-mono font-bold text-sm ${pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          {pnl >= 0 ? '+' : '-'}{fmtC(pnl)}
                        </p>
                        <p className={`text-[10px] font-semibold ${pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          {pnl >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-between pt-2 border-t border-white/5">
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase">Invested</p>
                        <p className="text-xs font-mono font-semibold">{fmtC(h.investedValue)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-[9px] text-muted-foreground uppercase">Current</p>
                        <p className="text-xs font-mono font-semibold">{fmtC(h.currentValue)}</p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ─────────── POSITIONS TAB ─────────── */}
          {tab === 'Positions' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-orange-400" />
                  <span className="text-sm font-bold">Live Positions</span>
                  {livePositions.length > 0 && (
                    <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full px-2 py-0.5 font-bold">
                      {livePositions.length} Open
                    </span>
                  )}
                </div>
                <button onClick={fetchLive} disabled={liveLoading} className="p-2 bg-white/5 rounded-xl border border-white/10 text-muted-foreground">
                  <RefreshCw size={12} className={liveLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {livePositions.length > 0 && (() => {
                const total = livePositions.reduce((s, p) => s + p.unrealisedPnl, 0);
                return (
                  <div className={`p-4 rounded-2xl border ${total >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-destructive/10 border-destructive/20'}`}>
                    <p className="text-xs text-muted-foreground mb-1">Total Unrealised P&L</p>
                    <p className={`text-2xl font-bold font-mono ${total >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {total >= 0 ? '+' : ''}₹{fmt(Math.abs(total))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">Auto-refreshes every 10s • {new Date().toLocaleTimeString('en-IN')}</p>
                  </div>
                );
              })()}

              {liveLoading && livePositions.length === 0 && (
                <div className="text-center py-10"><Loader2 size={28} className="animate-spin text-orange-400 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Fetching live positions…</p></div>
              )}
              {liveError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex gap-2">
                  <AlertCircle size={14} className="text-destructive shrink-0 mt-0.5" />
                  <div><p className="text-sm font-bold text-destructive">Error</p><p className="text-xs text-muted-foreground">{liveError}</p></div>
                </div>
              )}
              {!liveLoading && !liveError && livePositions.length === 0 && (
                <div className="text-center py-12">
                  <Zap size={36} className="mx-auto text-muted-foreground opacity-20 mb-3" />
                  <p className="text-sm text-muted-foreground">No open positions</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Your live Angel One trades appear here</p>
                </div>
              )}

              {livePositions.map(pos => {
                const isExiting = exitingSymbols.has(pos.tradingSymbol);
                const isProfit = pos.unrealisedPnl >= 0;
                return (
                  <motion.div
                    key={pos.tradingSymbol}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-white/5 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${pos.side === 'BUY' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}`}>
                          {pos.side}
                        </span>
                        <div>
                          <span className="text-sm font-bold">{pos.symbol}</span>
                          <span className="text-[10px] text-muted-foreground ml-1.5">{pos.productType}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => exitPosition(pos)}
                        disabled={isExiting}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-destructive/15 text-destructive border border-destructive/20 hover:bg-destructive/25 disabled:opacity-50 transition"
                      >
                        {isExiting ? <><Loader2 size={10} className="animate-spin" /> Exiting…</> : <><LogOut size={10} /> Exit</>}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Qty', value: String(Math.abs(pos.netQty)) },
                        { label: 'Avg Price', value: `₹${fmt(pos.avgPrice)}` },
                        { label: 'LTP', value: `₹${fmt(pos.ltp)}` },
                      ].map(f => (
                        <div key={f.label}>
                          <p className="text-[10px] text-muted-foreground mb-0.5">{f.label}</p>
                          <p className="text-sm font-mono font-bold">{f.value}</p>
                        </div>
                      ))}
                    </div>
                    <div className={`flex items-center justify-between mt-3 pt-2.5 border-t ${isProfit ? 'border-primary/10' : 'border-destructive/10'}`}>
                      <div className="flex items-center gap-1">
                        {isProfit ? <TrendingUp size={12} className="text-primary" /> : <TrendingDown size={12} className="text-destructive" />}
                        <span className={`text-xs font-bold font-mono ${isProfit ? 'text-primary' : 'text-destructive'}`}>
                          {isProfit ? '+' : ''}₹{fmt(Math.abs(pos.unrealisedPnl))}
                        </span>
                      </div>
                      <span className={`text-xs font-bold ${isProfit ? 'text-primary' : 'text-destructive'}`}>
                        {isProfit ? '+' : ''}{pos.pnlPct.toFixed(2)}%
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* ─────────── ORDERS TAB ─────────── */}
          {tab === 'Orders' && (
            <>
              {loading && orderBook.length === 0 && (
                <div className="text-center py-10"><Loader2 size={28} className="animate-spin text-muted-foreground mx-auto mb-2" /><p className="text-sm text-muted-foreground">Loading orders…</p></div>
              )}
              {!loading && orderBook.length === 0 && (
                <div className="text-center py-12">
                  <History size={36} className="mx-auto text-muted-foreground opacity-20 mb-3" />
                  <p className="text-sm text-muted-foreground">No orders today</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Your Angel One order book appears here</p>
                </div>
              )}
              {orderBook.map((order, i) => (
                <motion.div
                  key={order.orderId + i}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-card border border-white/5 rounded-2xl p-4 mb-3"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-foreground text-sm">{order.tradingSymbol}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${
                          order.transactionType === 'BUY'
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        }`}>{order.transactionType}</span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{order.orderType} • {order.productType}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-white/5">
                    <div><p className="text-[9px] text-muted-foreground uppercase">Qty</p><p className="text-xs font-mono font-bold">{order.filledQuantity}/{order.quantity}</p></div>
                    <div><p className="text-[9px] text-muted-foreground uppercase">Price</p><p className="text-xs font-mono font-bold">{order.price > 0 ? `₹${fmt(order.price)}` : 'MARKET'}</p></div>
                    <div><p className="text-[9px] text-muted-foreground uppercase">Avg Fill</p><p className="text-xs font-mono font-bold">{order.averagePrice > 0 ? `₹${fmt(order.averagePrice)}` : '—'}</p></div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                    <Clock size={9} />
                    {order.orderTimestamp ? new Date(order.orderTimestamp).toLocaleTimeString('en-IN') : '—'}
                  </p>
                </motion.div>
              ))}
            </>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
