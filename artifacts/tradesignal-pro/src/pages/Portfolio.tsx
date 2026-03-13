import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/use-store';
import {
  RefreshCw, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  History, Clock, AlertCircle, Loader2, Zap, LogOut, User,
  Wifi, WifiOff, BarChart3, Shield, Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

// ─── Types returned by /api/portfolio/summary ────────────────────────────────
interface Balance {
  availableCash: number; usedMargin: number; totalNet: number;
  availableMargin: number; collateral: number; totalPortfolioValue: number;
  todayPnL: number; unrealizedPnL: number;
}
interface Holding {
  tradingSymbol: string; exchange: string; symbolToken: string;
  companyName: string; quantity: number; averagePrice: number;
  ltp: number; currentValue: number; investedValue: number;
  pnl: number; pnlPercent: number; product: string; dayChange: number;
}
interface Position {
  tradingSymbol: string; symbolToken: string; exchange: string;
  productType: string; side: 'BUY' | 'SELL'; netQty: number;
  avgPrice: number; ltp: number; unrealisedPnl: number; pnlPct: number;
}
interface Order {
  orderId: string; tradingSymbol: string; transactionType: string;
  exchange: string; orderType: string; productType: string;
  status: string; quantity: number; filledQuantity: number;
  price: number; averagePrice: number; orderTimestamp: string;
}
interface Summary {
  balance: Balance | null; balanceError: string | null;
  holdings: Holding[]; holdingsError: string | null;
  positions: Position[]; positionsError: string | null;
  orders: Order[]; ordersError: string | null;
  latencyMs: number;
}

// ─── Live position from /api/portfolio/live-positions ────────────────────────
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

function OrderStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    complete: 'text-primary bg-primary/10 border-primary/20',
    open: 'text-accent bg-accent/10 border-accent/20',
    cancelled: 'text-muted-foreground bg-muted/10 border-white/10',
    rejected: 'text-destructive bg-destructive/10 border-destructive/20',
    pending: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
    'trigger pending': 'text-orange-400 bg-orange-400/10 border-orange-400/20',
  };
  return (
    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}

type Tab = 'Account' | 'Holdings' | 'Positions' | 'Orders';

export function Portfolio() {
  const { toast } = useToast();
  const { brokerProfile, brokerSession, brokerIsDemo } = useStore();

  const [tab, setTab] = useState<Tab>('Account');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [latency, setLatency] = useState<number | null>(null);
  const [sessionCountdown, setSessionCountdown] = useState('');

  const [livePositions, setLivePositions] = useState<LivePosition[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [exitingSymbols, setExitingSymbols] = useState<Set<string>>(new Set());


  // ── Session countdown ─────────────────────────────────────────────────────
  useEffect(() => {
    const tick = () => {
      if (brokerSession?.lastLoginTime) {
        const rem = new Date(brokerSession.lastLoginTime).getTime() + 86400000 - Date.now();
        if (rem > 0) {
          const h = Math.floor(rem / 3600000);
          const m = Math.floor((rem % 3600000) / 60000);
          setSessionCountdown(`${h}h ${m}m`);
        } else setSessionCountdown('Expired');
      }
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [brokerSession]);

  // ── Fetch all portfolio data from backend ────────────────────────────────
  const fetchSummary = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/portfolio/summary`);
      const json: { success: boolean } & Summary = await res.json();
      if (json.success) {
        setSummary(json);
        setLatency(json.latencyMs);
      }
    } catch {
      // Network error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchSummary(); }, [fetchSummary]);

  // ── Live positions (auto-refresh when on Positions tab) ───────────────────
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

  // ── Computed values from REAL data only ───────────────────────────────────
  const holdings = summary?.holdings ?? [];
  const orders   = summary?.orders ?? [];
  const balance  = summary?.balance ?? null;

  const totalInvested = holdings.reduce((s, h) => s + h.investedValue, 0);
  const totalCurrent  = holdings.reduce((s, h) => s + h.currentValue,  0);
  const totalPnL      = totalCurrent - totalInvested;
  const totalPnLPct   = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;

  // Portfolio value: getRMS net → calculated from holdings → null
  const portfolioValue = balance?.totalNet ?? (holdings.length > 0 ? totalCurrent : null);
  const availCash      = balance?.availableCash ?? null;
  const todayPnL       = balance?.todayPnL ?? null;

  // The account is live if summary loaded from backend successfully
  const isLive = summary !== null;
  const profile = brokerProfile;

  const TABS: Tab[] = ['Account', 'Holdings', 'Positions', 'Orders'];

  return (
    <div className="p-4 pt-10 min-h-screen pb-28">

      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            {isLive
              ? <><div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /><span className="text-[10px] text-primary font-semibold">Angel One Live</span></>
              : <><div className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /><span className="text-[10px] text-muted-foreground">Loading…</span></>
            }
          </div>
        </div>
        <button onClick={() => fetchSummary(true)} disabled={refreshing}
          className="p-2 rounded-xl bg-input border border-border text-muted-foreground active:scale-95 transition-transform">
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Hero Card — REAL DATA ONLY ── */}
      <div className="bg-gradient-to-br from-card to-input border border-border rounded-2xl p-5 mb-5 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Portfolio Value</p>
        <h2 className="text-3xl font-mono font-bold text-foreground mb-4">
          {loading
            ? <span className="inline-flex items-center gap-2 text-muted-foreground text-xl"><Loader2 size={18} className="animate-spin" /> Loading…</span>
            : portfolioValue !== null
              ? `₹${fmt(portfolioValue)}`
              : <span className="text-xl text-muted-foreground">— unavailable</span>
          }
        </h2>

        {/* Show balance error inline if funds unavailable */}
        {summary?.balanceError && (
          <div className="mb-3 bg-orange-500/10 border border-orange-500/20 rounded-xl p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertCircle size={11} className="text-orange-400 shrink-0" />
              <p className="text-[10px] font-bold text-orange-300">Funds data unavailable (AB1004)</p>
            </div>
            <p className="text-[9px] text-muted-foreground leading-relaxed">
              Enable <span className="text-orange-300 font-semibold">Funds/RMS</span> permission in your Angel One Developer Portal → My API → Edit API Key. Or deposit funds if account is unfunded.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Invested</p>
            <p className="font-mono font-medium text-sm">
              {loading ? '…' : holdings.length > 0 ? fmtC(totalInvested) : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Overall P&L</p>
            <p className={`font-mono font-bold text-sm flex items-center gap-1 ${totalPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {loading ? '…' : holdings.length > 0
                ? <>{totalPnL >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}{totalPnL >= 0 ? '+' : '-'}{fmtC(totalPnL)} ({totalPnLPct.toFixed(2)}%)</>
                : '—'
              }
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Today's P&L</p>
            <p className={`font-mono font-medium text-sm ${(todayPnL ?? 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {loading ? '…' : todayPnL !== null ? `${todayPnL >= 0 ? '+' : '-'}${fmtC(todayPnL)}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Available Cash</p>
            <p className="font-mono font-medium text-sm">
              {loading ? '…' : availCash !== null ? fmtC(availCash) : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex bg-input p-1 rounded-xl mb-4 gap-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
              tab === t ? 'bg-card text-foreground shadow border border-white/5' : 'text-muted-foreground'
            }`}>
            {t}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>

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
                    <p className="font-bold text-foreground text-base leading-tight">
                      {profile?.clientName || 'Angel One Account'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {profile?.clientId || 'Server-authenticated'}
                    </p>
                    <div className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      isLive ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted/10 border-white/10 text-muted-foreground'
                    }`}>
                      {isLive ? <Wifi size={9} /> : <WifiOff size={9} />}
                      {isLive ? 'Live Connected' : 'Loading…'}
                    </div>
                  </div>
                </div>
                {profile && (
                  <div className="space-y-1">
                    {[
                      { label: 'Email',  value: maskEmail(profile.email)  },
                      { label: 'Phone',  value: maskPhone(profile.phone)  },
                      { label: 'Broker', value: profile.broker || 'Angel One' },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                        <span className="text-xs text-muted-foreground">{r.label}</span>
                        <span className="text-xs font-mono font-semibold">{r.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!profile && isLive && (
                  <p className="text-xs text-muted-foreground/70 pt-2 border-t border-white/5 text-center">
                    Data is live from Angel One. Log in via Settings to see full profile.
                  </p>
                )}
              </div>

              {/* Connection stats */}
              {isLive && (
                <div className="bg-card border border-white/8 rounded-2xl p-4">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 font-semibold">Connection</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { icon: <Activity size={12} />, label: 'API Latency',    value: latency ? `${latency}ms` : '—' },
                      { icon: <Shield size={12} />,   label: 'Mode',           value: brokerIsDemo ? 'Demo' : 'Live' },
                      { icon: <Clock size={12} />,    label: 'Session',        value: sessionCountdown || '—' },
                      { icon: <Zap size={12} />,      label: 'Exchange',       value: brokerSession?.exchanges?.[0] || 'NSE' },
                    ].map(item => (
                      <div key={item.label} className="bg-input rounded-xl p-3">
                        <div className="flex items-center gap-1 text-muted-foreground mb-1">
                          {item.icon}
                          <span className="text-[9px] uppercase tracking-wide">{item.label}</span>
                        </div>
                        <p className="text-sm font-bold font-mono">{item.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Funds breakdown — REAL data or clearly labelled unavailable */}
              <div className="bg-card border border-white/8 rounded-2xl p-4">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-3 font-semibold">Funds</p>
                {loading && (
                  <div className="flex items-center gap-2 py-4 justify-center text-muted-foreground">
                    <Loader2 size={16} className="animate-spin" /><span className="text-sm">Loading…</span>
                  </div>
                )}
                {!loading && balance && (
                  <div className="space-y-1">
                    {[
                      { label: 'Available Cash',       value: fmtC(balance.availableCash) },
                      { label: 'Net Balance',          value: fmtC(balance.totalNet) },
                      { label: 'Used Margin',          value: fmtC(balance.usedMargin) },
                      { label: 'Available Intraday',   value: fmtC(balance.availableMargin) },
                      { label: "Today's Realised P&L", value: balance.todayPnL >= 0 ? `+${fmtC(balance.todayPnL)}` : `-${fmtC(balance.todayPnL)}`, positive: balance.todayPnL >= 0 },
                      { label: 'Unrealised P&L',       value: balance.unrealizedPnL >= 0 ? `+${fmtC(balance.unrealizedPnL)}` : `-${fmtC(balance.unrealizedPnL)}`, positive: balance.unrealizedPnL >= 0 },
                    ].map(r => (
                      <div key={r.label} className="flex justify-between items-center py-2.5 border-b border-white/5 last:border-0">
                        <span className="text-xs text-muted-foreground">{r.label}</span>
                        <span className={`text-sm font-mono font-bold ${
                          r.positive === undefined ? 'text-foreground'
                            : r.positive ? 'text-primary' : 'text-destructive'
                        }`}>{r.value}</span>
                      </div>
                    ))}
                  </div>
                )}
                {!loading && !balance && summary?.balanceError && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-xl p-3">
                    <div className="flex gap-2 items-start mb-2">
                      <AlertCircle size={13} className="text-orange-400 shrink-0 mt-0.5" />
                      <p className="text-xs font-bold text-orange-300">Funds data unavailable (AB1004)</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">
                      Angel One's <span className="text-foreground font-medium">getRMS</span> API is returning no data for this account.
                    </p>
                    <div className="bg-black/20 rounded-lg p-2 space-y-1">
                      <p className="text-[9px] text-orange-300 font-semibold uppercase tracking-wider">How to fix</p>
                      <p className="text-[10px] text-muted-foreground">1. Open <span className="text-foreground">smartapi.angelone.in</span></p>
                      <p className="text-[10px] text-muted-foreground">2. Go to <span className="text-foreground">My API → Edit API Key</span></p>
                      <p className="text-[10px] text-muted-foreground">3. Enable <span className="text-orange-300 font-semibold">Funds / RMS</span> permission</p>
                      <p className="text-[10px] text-muted-foreground">4. Or deposit funds if account is unfunded</p>
                    </div>
                  </div>
                )}
              </div>

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
            </div>
          )}

          {/* ─────────── HOLDINGS TAB ─────────── */}
          {tab === 'Holdings' && (
            <div className="space-y-3">
              {loading && (
                <div className="text-center py-10">
                  <Loader2 size={28} className="animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading holdings…</p>
                </div>
              )}
              {!loading && summary?.holdingsError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex gap-2">
                  <AlertCircle size={14} className="text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-destructive">Holdings error</p>
                    <p className="text-xs text-muted-foreground">{summary.holdingsError}</p>
                  </div>
                </div>
              )}
              {!loading && !summary?.holdingsError && holdings.length === 0 && (
                <div className="text-center py-12">
                  <BarChart3 size={36} className="mx-auto text-muted-foreground opacity-20 mb-3" />
                  <p className="text-sm text-muted-foreground">No holdings in this account</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Your Angel One equity holdings will appear here</p>
                </div>
              )}
              {holdings.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mb-1">
                  <div className="bg-card border border-white/8 rounded-2xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Invested</p>
                    <p className="font-mono font-bold text-sm">{fmtC(totalInvested)}</p>
                  </div>
                  <div className="bg-card border border-white/8 rounded-2xl p-3">
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Current</p>
                    <p className={`font-mono font-bold text-sm ${totalPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>{fmtC(totalCurrent)}</p>
                  </div>
                </div>
              )}
              {holdings.map((h, i) => {
                const pnl = h.pnl !== 0 ? h.pnl : h.currentValue - h.investedValue;
                const pnlPct = h.pnlPercent !== 0 ? h.pnlPercent : (h.investedValue > 0 ? (pnl / h.investedValue) * 100 : 0);
                return (
                  <motion.div key={h.tradingSymbol + i} initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className="bg-card border border-white/5 rounded-2xl p-4">
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
                      <div><p className="text-[9px] text-muted-foreground uppercase">Invested</p><p className="text-xs font-mono font-semibold">{fmtC(h.investedValue)}</p></div>
                      <div className="text-right"><p className="text-[9px] text-muted-foreground uppercase">Current</p><p className="text-xs font-mono font-semibold">{fmtC(h.currentValue)}</p></div>
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
                  <motion.div key={pos.tradingSymbol} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-card border border-white/5 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${pos.side === 'BUY' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}`}>{pos.side}</span>
                        <span className="text-sm font-bold">{pos.symbol}</span>
                        <span className="text-[10px] text-muted-foreground">{pos.productType}</span>
                      </div>
                      <button onClick={() => exitPosition(pos)} disabled={isExiting}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-destructive/15 text-destructive border border-destructive/20 hover:bg-destructive/25 disabled:opacity-50 transition">
                        {isExiting ? <><Loader2 size={10} className="animate-spin" /> Exiting…</> : <><LogOut size={10} /> Exit</>}
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: 'Qty',       value: String(Math.abs(pos.netQty)) },
                        { label: 'Avg Price', value: `₹${fmt(pos.avgPrice)}` },
                        { label: 'LTP',       value: `₹${fmt(pos.ltp)}` },
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
              {loading && (
                <div className="text-center py-10">
                  <Loader2 size={28} className="animate-spin text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading orders…</p>
                </div>
              )}
              {!loading && orders.length === 0 && (
                <div className="text-center py-12">
                  <History size={36} className="mx-auto text-muted-foreground opacity-20 mb-3" />
                  <p className="text-sm text-muted-foreground">No orders today</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Your Angel One order book appears here</p>
                </div>
              )}
              {orders.map((order, i) => (
                <motion.div key={order.orderId + i} initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="bg-card border border-white/5 rounded-2xl p-4 mb-3">
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
                    <OrderStatusBadge status={order.status} />
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
