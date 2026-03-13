import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/use-store';
import { angelOne } from '@/broker/angelOne';
import type { Holding, Position, OrderBook } from '@/broker/angelOne';
import {
  PieChart, Wallet, ArrowUpRight, ArrowDownRight, History,
  RefreshCw, TrendingUp, TrendingDown, Clock, CheckCircle2,
  XCircle, AlertCircle, Loader2, BarChart3, Zap, LogOut,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

interface LivePosition {
  symbol: string;
  tradingSymbol: string;
  symbolToken: string;
  exchange: string;
  productType: string;
  side: 'BUY' | 'SELL';
  netQty: number;
  avgPrice: number;
  ltp: number;
  unrealisedPnl: number;
  pnlPct: number;
  dayChange: number;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n);

const fmtCurrency = (n: number) => `₹${fmt(Math.abs(n))}`;

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

export function Portfolio() {
  const [tab, setTab] = useState('Holdings');
  const { toast } = useToast();

  // ── Live Positions state ─────────────────────────────────────────────────
  const [livePositions, setLivePositions] = useState<LivePosition[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [exitingSymbols, setExitingSymbols] = useState<Set<string>>(new Set());

  const fetchLivePositions = useCallback(async () => {
    setLiveLoading(true);
    setLiveError('');
    try {
      const res = await fetch(`${BASE}/api/portfolio/live-positions`);
      const json = await res.json();
      if (json.success) setLivePositions(json.positions ?? []);
      else setLiveError(json.error ?? 'Failed to fetch live positions');
    } catch {
      setLiveError('Network error — cannot reach server');
    } finally {
      setLiveLoading(false);
    }
  }, []);

  const exitPosition = useCallback(async (pos: LivePosition) => {
    setExitingSymbols(prev => new Set([...prev, pos.tradingSymbol]));
    try {
      const res = await fetch(`${BASE}/api/orders/exit-position`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradingSymbol: pos.tradingSymbol,
          symbolToken: pos.symbolToken,
          exchange: pos.exchange,
          netQty: pos.netQty,
          side: pos.side,
          productType: pos.productType,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast({
          title: '✅ Exit Order Placed',
          description: `${json.exitSide} ${json.qty} × ${pos.symbol} sent to Angel One.`,
        });
        // Refresh positions after exit
        setTimeout(fetchLivePositions, 1500);
      } else {
        throw new Error(json.error ?? 'Exit failed');
      }
    } catch (err) {
      toast({
        title: '❌ Exit Failed',
        description: err instanceof Error ? err.message : 'Exit order failed',
        variant: 'destructive',
      });
    } finally {
      setExitingSymbols(prev => {
        const next = new Set(prev);
        next.delete(pos.tradingSymbol);
        return next;
      });
    }
  }, [fetchLivePositions, toast]);

  // Auto-refresh live positions every 10s when on Live tab
  useEffect(() => {
    if (tab !== 'Live') return;
    fetchLivePositions();
    const interval = setInterval(fetchLivePositions, 10_000);
    return () => clearInterval(interval);
  }, [tab, fetchLivePositions]);
  const {
    paperMode, brokerSession, brokerIsDemo, brokerApiKey,
    holdings, positions, orderBook, walletBalance,
    setHoldings, setPositions, setOrderBook, setWalletBalance,
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Restore session + fetch data on mount
  useEffect(() => {
    if (brokerSession && brokerApiKey) {
      angelOne.restoreSession(brokerSession, brokerIsDemo, brokerApiKey);
    }
    fetchAllData();
  }, []);

  const fetchAllData = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const [bal, hold, pos, orders] = await Promise.all([
        angelOne.getWalletBalance(),
        angelOne.getHoldings(),
        angelOne.getPositions(),
        angelOne.getOrderBook(),
      ]);
      setWalletBalance(bal);
      setHoldings(hold);
      setPositions(pos);
      setOrderBook(orders);
    } catch (_) {}

    setLoading(false);
    setRefreshing(false);
  };

  // Computed totals from holdings
  const totalInvested = holdings.reduce((s, h) => s + h.investedValue, 0);
  const totalCurrent = holdings.reduce((s, h) => s + h.currentValue, 0);
  const totalPnL = totalCurrent - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  const todayPnL = walletBalance?.todayPnL ?? holdings.reduce((s, h) => s + h.dayChange * h.quantity, 0);

  const portfolioValue = walletBalance?.totalPortfolioValue ?? totalCurrent;
  const availCash = walletBalance?.availableCash ?? 0;

  return (
    <div className="p-4 pt-10 min-h-screen pb-28">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold text-foreground">Portfolio</h1>
        <div className="flex items-center gap-2">
          {paperMode && (
            <span className="bg-destructive/20 text-destructive text-[10px] px-2 py-1 rounded font-bold uppercase tracking-wide">
              Paper
            </span>
          )}
          <button
            onClick={() => fetchAllData(true)}
            disabled={refreshing}
            className="p-2 rounded-xl bg-input border border-border text-muted-foreground active:scale-95 transition-transform"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ── Main Portfolio Card ── */}
      <div className="bg-gradient-to-br from-card to-input border border-border rounded-2xl p-5 mb-5 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Portfolio Value</p>
        <h2 className="text-3xl font-mono font-bold text-foreground mb-4">
          {loading ? (
            <span className="inline-flex items-center gap-2 text-muted-foreground text-xl">
              <Loader2 size={18} className="animate-spin" /> Loading...
            </span>
          ) : (
            `₹${fmt(portfolioValue)}`
          )}
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Invested</p>
            <p className="font-mono font-medium text-sm">{fmtCurrency(totalInvested)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Overall P&L</p>
            <p className={`font-mono font-bold text-sm flex items-center gap-1 ${totalPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {totalPnL >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
              {totalPnL >= 0 ? '+' : '-'}{fmtCurrency(totalPnL)} ({totalPnLPct.toFixed(2)}%)
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Today's P&L</p>
            <p className={`font-mono font-medium text-sm ${todayPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
              {todayPnL >= 0 ? '+' : '-'}{fmtCurrency(todayPnL)}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase">Available Cash</p>
            <p className="font-mono font-medium text-sm">{fmtCurrency(availCash)}</p>
          </div>
        </div>
      </div>

      {/* ── Positions Summary (if any) ── */}
      {positions.length > 0 && (
        <div className="mb-4">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 font-semibold">
            Open Positions ({positions.length})
          </p>
          <div className="space-y-2">
            {positions.map((pos, i) => (
              <motion.div
                key={pos.tradingSymbol + i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="bg-input border border-border rounded-xl p-3 flex justify-between items-center"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-foreground">{pos.tradingSymbol}</span>
                    <span className="text-[9px] bg-accent/10 text-accent border border-accent/20 px-1.5 py-0.5 rounded font-bold uppercase">
                      {pos.productType}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">
                    Qty: {pos.netQuantity} • LTP: ₹{fmt(pos.ltp)}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-mono font-bold text-sm ${pos.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {pos.pnl >= 0 ? '+' : ''}{fmtCurrency(pos.pnl)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">Unrealised</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex bg-input p-1 rounded-xl mb-4">
        {['Holdings', 'Live', 'Orders', 'History'].map((t) => (
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

      {/* ── Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="space-y-3"
        >
          {/* HOLDINGS */}
          {tab === 'Holdings' && (
            <>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="mx-auto text-accent animate-spin mb-3" size={32} />
                  <p className="text-muted-foreground text-sm">Loading holdings...</p>
                </div>
              ) : holdings.length === 0 ? (
                <div className="text-center py-12">
                  <PieChart className="mx-auto text-muted-foreground mb-3 opacity-40" size={40} />
                  <p className="text-muted-foreground text-sm">No holdings found</p>
                </div>
              ) : (
                holdings.map((h, i) => (
                  <motion.div
                    key={h.tradingSymbol}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="glass-panel border border-border rounded-xl p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-bold text-foreground">{h.tradingSymbol}</h3>
                          <span className="text-[9px] text-muted-foreground bg-input px-1.5 py-0.5 rounded font-medium">
                            {h.exchange}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{h.companyName}</p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-mono font-bold text-sm">₹{fmt(h.lastTradedPrice)}</p>
                        <p className={`text-[11px] font-mono ${h.dayChange >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          {h.dayChange >= 0 ? '+' : ''}{fmt(h.dayChange)} ({h.dayChangePercent.toFixed(2)}%)
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase">Qty</p>
                        <p className="text-xs font-mono font-bold text-foreground">{h.quantity}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase">Avg Price</p>
                        <p className="text-xs font-mono font-bold text-foreground">₹{fmt(h.averagePrice)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase">P&L</p>
                        <p className={`text-xs font-mono font-bold ${h.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          {h.pnl >= 0 ? '+' : ''}{fmtCurrency(h.pnl)}
                          <span className="text-[9px] ml-1">({h.pnlPercent.toFixed(1)}%)</span>
                        </p>
                      </div>
                    </div>

                    {/* PnL bar */}
                    <div className="mt-2 h-1 bg-input rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${h.pnl >= 0 ? 'bg-primary' : 'bg-destructive'}`}
                        style={{ width: `${Math.min(Math.abs(h.pnlPercent) * 5, 100)}%` }}
                      />
                    </div>
                  </motion.div>
                ))
              )}

              {/* Portfolio summary bar */}
              {holdings.length > 0 && (
                <div className="glass-panel border border-border rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <BarChart3 size={14} className="text-accent" />
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Summary</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Total Invested</p>
                      <p className="font-mono font-bold text-sm">{fmtCurrency(totalInvested)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Current Value</p>
                      <p className="font-mono font-bold text-sm">{fmtCurrency(totalCurrent)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Total P&L</p>
                      <p className={`font-mono font-bold text-sm ${totalPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {totalPnL >= 0 ? '+' : '-'}{fmtCurrency(totalPnL)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Return %</p>
                      <p className={`font-mono font-bold text-sm ${totalPnLPct >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {totalPnLPct >= 0 ? '+' : ''}{totalPnLPct.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── Live Trades ── */}
          {tab === 'Live' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Zap size={16} className="text-orange-400" />
                  <span className="text-sm font-bold text-foreground">Live Positions</span>
                  {livePositions.length > 0 && (
                    <span className="text-[10px] bg-orange-500/20 text-orange-400 border border-orange-500/30 rounded-full px-2 py-0.5 font-bold">
                      {livePositions.length} Open
                    </span>
                  )}
                </div>
                <button
                  onClick={fetchLivePositions}
                  disabled={liveLoading}
                  className="p-2 bg-white/5 rounded-xl border border-white/10 text-muted-foreground hover:text-foreground transition"
                >
                  <RefreshCw size={12} className={liveLoading ? 'animate-spin' : ''} />
                </button>
              </div>

              {/* Live P&L Summary Bar */}
              {livePositions.length > 0 && (() => {
                const totalPnl = livePositions.reduce((s, p) => s + p.unrealisedPnl, 0);
                return (
                  <div className={`p-4 rounded-2xl border ${totalPnl >= 0 ? 'bg-primary/10 border-primary/20' : 'bg-destructive/10 border-destructive/20'}`}>
                    <p className="text-xs text-muted-foreground mb-1">Total Unrealised P&L</p>
                    <p className={`text-2xl font-bold font-mono ${totalPnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {totalPnl >= 0 ? '+' : ''}₹{fmt(Math.abs(totalPnl))}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Auto-refreshes every 10s • Last: {new Date().toLocaleTimeString('en-IN')}
                    </p>
                  </div>
                );
              })()}

              {liveLoading && livePositions.length === 0 && (
                <div className="text-center py-10">
                  <Loader2 size={28} className="animate-spin text-orange-400 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Fetching live positions…</p>
                </div>
              )}

              {liveError && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-4 flex gap-2 items-start">
                  <AlertCircle size={14} className="text-destructive shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-destructive mb-0.5">Could not load positions</p>
                    <p className="text-xs text-muted-foreground">{liveError}</p>
                  </div>
                </div>
              )}

              {!liveLoading && !liveError && livePositions.length === 0 && (
                <div className="text-center py-12">
                  <Zap size={36} className="mx-auto text-muted-foreground mb-3 opacity-30" />
                  <p className="text-sm text-muted-foreground">No open positions</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Your live Angel One trades will appear here</p>
                </div>
              )}

              {livePositions.map((pos) => {
                const isExiting = exitingSymbols.has(pos.tradingSymbol);
                const isProfit = pos.unrealisedPnl >= 0;
                return (
                  <motion.div
                    key={pos.tradingSymbol}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-card/50 border border-white/5 rounded-2xl p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${pos.side === 'BUY' ? 'bg-primary/20 text-primary' : 'bg-destructive/20 text-destructive'}`}>
                          {pos.side}
                        </div>
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
                        {isExiting
                          ? <><Loader2 size={10} className="animate-spin" /> Exiting…</>
                          : <><LogOut size={10} /> Exit</>
                        }
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">Qty</p>
                        <p className="text-sm font-mono font-bold">{Math.abs(pos.netQty)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">Avg Price</p>
                        <p className="text-sm font-mono font-bold">₹{fmt(pos.avgPrice)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground mb-0.5">LTP</p>
                        <p className="text-sm font-mono font-bold">₹{fmt(pos.ltp)}</p>
                      </div>
                    </div>
                    <div className={`flex items-center justify-between mt-3 pt-2.5 border-t ${isProfit ? 'border-primary/10' : 'border-destructive/10'}`}>
                      <div className="flex items-center gap-1">
                        {isProfit
                          ? <TrendingUp size={12} className="text-primary" />
                          : <TrendingDown size={12} className="text-destructive" />
                        }
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

          {tab === 'Orders' && (
            <>
              {loading ? (
                <div className="text-center py-12">
                  <Loader2 className="mx-auto text-accent animate-spin mb-3" size={32} />
                  <p className="text-muted-foreground text-sm">Loading orders...</p>
                </div>
              ) : orderBook.length === 0 ? (
                <div className="text-center py-12">
                  <Wallet className="mx-auto text-muted-foreground mb-3 opacity-40" size={40} />
                  <p className="text-muted-foreground text-sm">No orders today</p>
                </div>
              ) : (
                orderBook.map((order, i) => (
                  <motion.div
                    key={order.orderId}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="glass-panel border border-border rounded-xl p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="font-bold text-foreground">{order.tradingSymbol}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            order.transactionType === 'BUY'
                              ? 'bg-primary/10 text-primary border border-primary/20'
                              : 'bg-destructive/10 text-destructive border border-destructive/20'
                          }`}>
                            {order.transactionType}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{order.orderType} • {order.productType}</p>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>

                    <div className="grid grid-cols-3 gap-2 pt-2 border-t border-white/5">
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase">Qty</p>
                        <p className="text-xs font-mono font-bold text-foreground">
                          {order.filledQuantity}/{order.quantity}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase">Price</p>
                        <p className="text-xs font-mono font-bold text-foreground">
                          {order.price > 0 ? `₹${fmt(order.price)}` : 'MARKET'}
                        </p>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground uppercase">Avg Fill</p>
                        <p className="text-xs font-mono font-bold text-foreground">
                          {order.averagePrice > 0 ? `₹${fmt(order.averagePrice)}` : '—'}
                        </p>
                      </div>
                    </div>

                    <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                      <Clock size={9} />
                      {order.orderTimestamp ? new Date(order.orderTimestamp).toLocaleTimeString('en-IN') : '—'}
                    </p>
                  </motion.div>
                ))
              )}
            </>
          )}

          {/* HISTORY */}
          {tab === 'History' && (
            <div className="text-center py-12">
              <History className="mx-auto text-muted-foreground mb-3 opacity-40" size={40} />
              <p className="text-muted-foreground text-sm">Trade history coming soon</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Historical P&L and closed trades will appear here</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
