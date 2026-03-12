import { useState, useEffect } from 'react';
import { useStore } from '@/store/use-store';
import { angelOne } from '@/broker/angelOne';
import type { Holding, Position, OrderBook } from '@/broker/angelOne';
import {
  PieChart, Wallet, ArrowUpRight, ArrowDownRight, History,
  RefreshCw, TrendingUp, TrendingDown, Clock, CheckCircle2,
  XCircle, AlertCircle, Loader2, BarChart3,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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
        {['Holdings', 'Orders', 'History'].map((t) => (
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

          {/* ORDERS */}
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
