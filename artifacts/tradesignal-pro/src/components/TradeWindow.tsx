import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, TrendingUp, TrendingDown, Zap, Shield, Target, Clock, ChevronDown, AlertCircle, CheckCircle, Loader2, Activity } from 'lucide-react';
import { ChartWidget } from '@/components/ChartWidget';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}`;
const fmtPnL = (n: number) =>
  `${n >= 0 ? '+' : ''}₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Math.abs(n))}`;

export interface TradeSignal {
  symbol: string;
  symbolToken: string;
  exchange: string;
  companyName?: string;
  signal: string;
  entry: number;
  stopLoss: number;
  target1: number;
  target2?: number;
  confidence: number;
  riskReward?: number;
}

interface ActiveTrade {
  orderId: string;
  symbol: string;
  symbolToken: string;
  exchange: string;
  companyName?: string;
  signal: string;
  entryPrice: number;
  qty: number;
  stopLoss: number;
  target1: number;
  target2?: number;
  mode: 'paper' | 'live';
  placedAt: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function elapsed(ms: number) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ─── Trade Execution Modal ─────────────────────────────────────────────────────
interface TradeExecuteModalProps {
  signal: TradeSignal;
  onClose: () => void;
  onTradeOpen: (trade: ActiveTrade) => void;
}

export function TradeExecuteModal({ signal, onClose, onTradeOpen }: TradeExecuteModalProps) {
  const isBuy = signal.signal.includes('BUY');
  const isSell = signal.signal.includes('SELL');

  const defaultQty = Math.max(1, Math.floor(10000 / Math.max(1, signal.entry)));
  const [qty, setQty] = useState(defaultQty);
  const [mode, setMode] = useState<'paper' | 'live'>('paper');
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalValue = qty * signal.entry;
  const maxLoss = qty * Math.abs(signal.entry - signal.stopLoss);
  const maxProfit = qty * Math.abs(signal.target1 - signal.entry);

  const handleConfirm = useCallback(async () => {
    setPlacing(true);
    setError(null);
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (mode === 'live') headers['x-force-live'] = 'true';

      const res = await fetch(`${BASE}/api/orders/place`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          symbol: signal.symbol,
          symboltoken: signal.symbolToken,
          exchange: signal.exchange,
          transactiontype: isBuy ? 'BUY' : 'SELL',
          ordertype: 'MARKET',
          producttype: 'INTRADAY',
          quantity: qty,
          price: 0,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error ?? 'Order failed');

      onTradeOpen({
        orderId: json.orderId ?? `sim-${Date.now()}`,
        symbol: signal.symbol,
        symbolToken: signal.symbolToken,
        exchange: signal.exchange,
        companyName: signal.companyName,
        signal: signal.signal,
        entryPrice: signal.entry,
        qty,
        stopLoss: signal.stopLoss,
        target1: signal.target1,
        target2: signal.target2,
        mode,
        placedAt: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to place order');
    } finally {
      setPlacing(false);
    }
  }, [signal, qty, mode, isBuy, onTradeOpen]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        onClick={e => e.stopPropagation()}
        className="w-full max-w-md bg-background border-t border-border rounded-t-3xl px-5 pt-4 pb-8 space-y-4"
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-border rounded-full mx-auto" />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-foreground font-mono">{signal.symbol.replace('-EQ', '')}</h2>
            <p className="text-xs text-muted-foreground">{signal.companyName ?? signal.exchange}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm px-3 py-1 rounded-full border font-bold ${
              isBuy ? 'text-primary bg-primary/10 border-primary/20' :
              isSell ? 'text-destructive bg-destructive/10 border-destructive/20' :
              'text-muted-foreground bg-input border-border'
            }`}>
              {isBuy ? '🟢' : isSell ? '🔴' : '⚪'} {signal.signal.replace('_', ' ')}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-xl bg-input text-muted-foreground">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Trade levels */}
        <div className="grid grid-cols-3 gap-2">
          <div className="bg-input rounded-xl p-2.5 text-center">
            <p className="text-[9px] text-muted-foreground">ENTRY</p>
            <p className="text-sm font-bold font-mono text-foreground">{fmtINR(signal.entry)}</p>
          </div>
          <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-2.5 text-center">
            <p className="text-[9px] text-destructive/80">STOP LOSS</p>
            <p className="text-sm font-bold font-mono text-destructive">{fmtINR(signal.stopLoss)}</p>
          </div>
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-2.5 text-center">
            <p className="text-[9px] text-primary/80">TARGET</p>
            <p className="text-sm font-bold font-mono text-primary">{fmtINR(signal.target1)}</p>
          </div>
        </div>

        {/* Quantity selector */}
        <div>
          <label className="text-xs text-muted-foreground font-bold mb-2 block">QUANTITY</label>
          <div className="flex items-center gap-3 bg-input border border-border rounded-xl px-3 py-2.5">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg bg-background text-foreground font-black text-lg flex items-center justify-center active:scale-90 transition-all"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="flex-1 bg-transparent text-center font-black text-xl text-foreground font-mono outline-none"
            />
            <button
              onClick={() => setQty(q => q + 1)}
              className="w-8 h-8 rounded-lg bg-background text-foreground font-black text-lg flex items-center justify-center active:scale-90 transition-all"
            >
              +
            </button>
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5 px-1">
            <span>Total: <span className="text-foreground font-bold">{fmtINR(totalValue)}</span></span>
            <span>Max loss: <span className="text-destructive font-bold">{fmtINR(maxLoss)}</span></span>
            <span>Max gain: <span className="text-primary font-bold">{fmtINR(maxProfit)}</span></span>
          </div>
        </div>

        {/* Paper / Live toggle */}
        <div>
          <label className="text-xs text-muted-foreground font-bold mb-2 block">EXECUTION MODE</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode('paper')}
              className={`py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                mode === 'paper'
                  ? 'bg-accent text-background border-accent shadow-lg shadow-accent/20'
                  : 'bg-input text-muted-foreground border-border'
              }`}
            >
              <Shield size={16} /> Paper Trade
            </button>
            <button
              onClick={() => setMode('live')}
              className={`py-3 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 border transition-all ${
                mode === 'live'
                  ? 'bg-destructive text-white border-destructive shadow-lg shadow-destructive/20'
                  : 'bg-input text-muted-foreground border-border'
              }`}
            >
              <Zap size={16} /> Live Trade
            </button>
          </div>
          {mode === 'live' && (
            <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-2 px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-xl text-[11px] text-destructive flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5 flex-shrink-0" />
              Live mode places REAL orders with your Angel One account. Real money is at risk.
            </motion.div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="px-3 py-2 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive">
            {error}
          </div>
        )}

        {/* Confirm button */}
        <button
          onClick={handleConfirm}
          disabled={placing}
          className={`w-full h-14 rounded-2xl font-black text-base flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 ${
            mode === 'live'
              ? 'bg-destructive text-white'
              : 'bg-accent text-background'
          }`}
        >
          {placing ? (
            <><Loader2 size={18} className="animate-spin" /> Placing Order...</>
          ) : (
            <>{mode === 'live' ? <Zap size={18} /> : <Shield size={18} />}
              {isBuy ? 'BUY' : 'SELL'} {qty} × {signal.symbol.replace('-EQ', '')} — {mode === 'live' ? 'LIVE' : 'PAPER'}
            </>
          )}
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Active Trade Window ───────────────────────────────────────────────────────
interface ActiveTradeWindowProps {
  trade: ActiveTrade;
  onClose: () => void;
}

interface CandleRow {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export function ActiveTradeWindow({ trade, onClose }: ActiveTradeWindowProps) {
  const isBuy = trade.signal.includes('BUY');
  const [currentPrice, setCurrentPrice] = useState(trade.entryPrice);
  const [candles, setCandles] = useState<CandleRow[]>([]);
  const [loadingChart, setLoadingChart] = useState(true);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [closedPnL, setClosedPnL] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const priceRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const unrealizedPnL = isBuy
    ? (currentPrice - trade.entryPrice) * trade.qty
    : (trade.entryPrice - currentPrice) * trade.qty;

  const pnlColor = unrealizedPnL > 0 ? 'text-primary' : unrealizedPnL < 0 ? 'text-destructive' : 'text-muted-foreground';
  const pnlBg = unrealizedPnL > 0 ? 'bg-primary/10 border-primary/20' : unrealizedPnL < 0 ? 'bg-destructive/10 border-destructive/20' : 'bg-input border-border';

  const pricePct = trade.entryPrice > 0
    ? ((currentPrice - trade.entryPrice) / trade.entryPrice * 100).toFixed(2)
    : '0.00';

  // ─── Fetch candle chart data + use last close as LTP ─────────────────────
  const fetchCandles = useCallback(async () => {
    try {
      const now = new Date();
      const from = new Date(now); from.setDate(from.getDate() - 3);
      const pad = (n: number) => String(n).padStart(2, '0');
      const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 09:15`;
      const fmtTo = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} 23:59`;

      const res = await fetch(`${BASE}/api/market/candles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symboltoken: trade.symbolToken,
          exchange: trade.exchange,
          interval: 'FIVE_MINUTE',
          fromdate: fmt(from),
          todate: fmtTo(now),
        }),
      });
      const json = await res.json();
      if (json.success && json.candles?.length) {
        setCandles(json.candles);
        // Use last candle close as initial LTP
        const last = json.candles[json.candles.length - 1];
        if (last?.close > 0) setCurrentPrice(last.close);
      }
    } catch (_) {}
    finally { setLoadingChart(false); }
  }, [trade.symbolToken, trade.exchange]);

  // ─── Poll current price via quote endpoint ─────────────────────────────────
  const pollPrice = useCallback(async () => {
    try {
      const sym = trade.symbol.replace('-EQ', '');
      const res = await fetch(`${BASE}/api/market/quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbols: [sym], exchange: trade.exchange }),
      });
      const json = await res.json();
      const ltp = Array.isArray(json.data) && json.data[0]?.ltp ? Number(json.data[0].ltp) : 0;
      if (ltp > 0) {
        setCurrentPrice(ltp);
        // Feed paper engine so SL/target trigger orders work
        if (trade.mode === 'paper') {
          fetch(`${BASE}/api/paper/ltp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: trade.symbol, ltp }),
          }).catch(() => {});
        }
      }
    } catch (_) {}
  }, [trade.symbol, trade.exchange, trade.mode]);

  useEffect(() => {
    fetchCandles();
    pollPrice();
    priceRef.current = setInterval(pollPrice, 8000);
    timerRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (priceRef.current) clearInterval(priceRef.current);
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchCandles, pollPrice]);

  // ─── Refresh candles every 5 min ──────────────────────────────────────────
  useEffect(() => {
    const id = setInterval(fetchCandles, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [fetchCandles]);

  // ─── Close position ────────────────────────────────────────────────────────
  const handleClosePosition = useCallback(async () => {
    setClosing(true);
    try {
      const endpoint = trade.mode === 'live'
        ? `${BASE}/api/orders/exit-position`
        : `${BASE}/api/paper/close/${encodeURIComponent(trade.symbol)}`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: trade.symbol,
          symboltoken: trade.symbolToken,
          exchange: trade.exchange,
          transactiontype: isBuy ? 'SELL' : 'BUY',
          ordertype: 'MARKET',
          producttype: 'INTRADAY',
          quantity: trade.qty,
          price: 0,
        }),
      });
      const json = await res.json();
      if (json.success !== false) {
        const finalPnL = isBuy
          ? (currentPrice - trade.entryPrice) * trade.qty
          : (trade.entryPrice - currentPrice) * trade.qty;
        setClosedPnL(finalPnL);
        setClosed(true);
      }
    } catch (_) {}
    finally { setClosing(false); }
  }, [trade, isBuy, currentPrice]);

  // ─── Chart data with entry/SL/target overlays ─────────────────────────────
  const chartWithOverlay = candles.slice(-120); // last 120 5m candles = 10h

  // Price % from entry for SL and target
  const slPct = trade.entryPrice > 0 ? ((trade.stopLoss - trade.entryPrice) / trade.entryPrice * 100).toFixed(2) : '';
  const tgtPct = trade.entryPrice > 0 ? ((trade.target1 - trade.entryPrice) / trade.entryPrice * 100).toFixed(2) : '';

  if (closed) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-md px-6"
      >
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className={`w-full max-w-sm glass-panel border rounded-3xl p-8 text-center ${closedPnL! >= 0 ? 'border-primary/30' : 'border-destructive/30'}`}
        >
          <div className={`w-20 h-20 rounded-full mx-auto flex items-center justify-center mb-4 ${closedPnL! >= 0 ? 'bg-primary/20' : 'bg-destructive/20'}`}>
            {closedPnL! >= 0
              ? <TrendingUp size={40} className="text-primary" />
              : <TrendingDown size={40} className="text-destructive" />
            }
          </div>
          <p className="text-sm text-muted-foreground mb-1">Trade Closed</p>
          <p className="text-4xl font-black font-mono mb-1" style={{ color: closedPnL! >= 0 ? '#00FF88' : '#FF3366' }}>
            {fmtPnL(closedPnL!)}
          </p>
          <p className="text-xs text-muted-foreground mb-6">
            {trade.qty} × {trade.symbol.replace('-EQ', '')} · {trade.mode === 'live' ? '🔴 LIVE' : '🛡️ PAPER'} · {elapsed(now - trade.placedAt)}
          </p>
          <button
            onClick={onClose}
            className="w-full py-3.5 rounded-2xl bg-accent text-background font-black text-base"
          >
            Done
          </button>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 60 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full animate-pulse ${trade.mode === 'live' ? 'bg-destructive' : 'bg-accent'}`} />
          <div>
            <p className="font-black text-foreground font-mono text-base leading-tight">
              {trade.symbol.replace('-EQ', '')}
            </p>
            <p className="text-[10px] text-muted-foreground">{trade.companyName ?? trade.exchange} · {trade.mode === 'live' ? '🔴 LIVE' : '🛡️ PAPER'}</p>
          </div>
          <span className={`text-[11px] px-2.5 py-1 rounded-full border font-bold ml-1 ${
            isBuy ? 'text-primary bg-primary/10 border-primary/20' : 'text-destructive bg-destructive/10 border-destructive/20'
          }`}>
            {isBuy ? '🟢' : '🔴'} {trade.signal.replace('_', ' ')}
          </span>
        </div>
        <button onClick={onClose} className="p-2 rounded-xl bg-input text-muted-foreground">
          <X size={18} />
        </button>
      </div>

      {/* ── Live P&L strip ── */}
      <div className={`px-4 py-3 border-b border-border flex items-center justify-between flex-shrink-0 ${pnlBg}`}>
        <div>
          <p className="text-[10px] text-muted-foreground">UNREALIZED P&L</p>
          <p className={`text-2xl font-black font-mono ${pnlColor}`}>{fmtPnL(unrealizedPnL)}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">LTP</p>
          <p className="text-xl font-black font-mono text-foreground">{fmtINR(currentPrice)}</p>
          <p className={`text-[11px] font-bold font-mono ${Number(pricePct) >= 0 ? 'text-primary' : 'text-destructive'}`}>
            {Number(pricePct) >= 0 ? '+' : ''}{pricePct}%
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">TIME</p>
          <p className="text-base font-black font-mono text-foreground">{elapsed(now - trade.placedAt)}</p>
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <Activity size={9} className="text-accent animate-pulse" />
            <p className="text-[9px] text-accent">LIVE</p>
          </div>
        </div>
      </div>

      {/* ── Live Chart ── */}
      <div className="flex-1 relative overflow-hidden">
        {loadingChart ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-accent" />
          </div>
        ) : chartWithOverlay.length > 0 ? (
          <div className="h-full">
            <ChartWidget data={chartWithOverlay} height={260} />
            {/* Overlay price lines labels */}
            <div className="absolute top-2 right-2 space-y-1">
              <div className="flex items-center gap-1.5 px-2 py-1 bg-background/80 border border-primary/30 rounded-lg backdrop-blur-sm">
                <div className="w-3 h-0.5 bg-primary" />
                <span className="text-[10px] font-mono text-primary font-bold">T1 {fmtINR(trade.target1)} ({tgtPct}%)</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-background/80 border border-border rounded-lg backdrop-blur-sm">
                <div className="w-3 h-0.5 bg-muted-foreground" />
                <span className="text-[10px] font-mono text-muted-foreground font-bold">Entry {fmtINR(trade.entryPrice)}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2 py-1 bg-background/80 border border-destructive/30 rounded-lg backdrop-blur-sm">
                <div className="w-3 h-0.5 bg-destructive" />
                <span className="text-[10px] font-mono text-destructive font-bold">SL {fmtINR(trade.stopLoss)} ({slPct}%)</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Chart data unavailable
          </div>
        )}
      </div>

      {/* ── Trade details grid ── */}
      <div className="px-4 py-3 border-t border-border flex-shrink-0">
        <div className="grid grid-cols-4 gap-2 mb-3">
          <div className="text-center">
            <p className="text-[9px] text-muted-foreground">QTY</p>
            <p className="text-sm font-bold font-mono text-foreground">{trade.qty}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-muted-foreground">ENTRY</p>
            <p className="text-sm font-bold font-mono text-foreground">{fmtINR(trade.entryPrice)}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-destructive/80">STOP</p>
            <p className="text-sm font-bold font-mono text-destructive">{fmtINR(trade.stopLoss)}</p>
          </div>
          <div className="text-center">
            <p className="text-[9px] text-primary/80">TARGET</p>
            <p className="text-sm font-bold font-mono text-primary">{fmtINR(trade.target1)}</p>
          </div>
        </div>

        {/* Close position button */}
        <button
          onClick={handleClosePosition}
          disabled={closing}
          className="w-full h-12 rounded-2xl bg-destructive text-white font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
        >
          {closing
            ? <><Loader2 size={16} className="animate-spin" /> Closing...</>
            : <><X size={16} /> Close Position — Market Order</>
          }
        </button>
      </div>
    </motion.div>
  );
}

// ─── Convenience wrapper — full trade flow ────────────────────────────────────
interface TradeFlowProps {
  signal: TradeSignal | null;
  onDismiss: () => void;
}

export function TradeFlow({ signal, onDismiss }: TradeFlowProps) {
  const [activeTrade, setActiveTrade] = useState<ActiveTrade | null>(null);

  if (!signal) return null;

  return (
    <AnimatePresence>
      {!activeTrade && (
        <TradeExecuteModal
          key="modal"
          signal={signal}
          onClose={onDismiss}
          onTradeOpen={t => setActiveTrade(t)}
        />
      )}
      {activeTrade && (
        <ActiveTradeWindow
          key="window"
          trade={activeTrade}
          onClose={() => { setActiveTrade(null); onDismiss(); }}
        />
      )}
    </AnimatePresence>
  );
}
