import { useState, useEffect, useCallback } from 'react';
import {
  FlaskConical, TrendingUp, TrendingDown, RotateCcw, Plus, Minus,
  ChevronDown, Clock, Trophy, Target, Zap, BarChart3, X, RefreshCw,
  CheckCircle2, XCircle, Calendar, AlertCircle,
} from 'lucide-react';

const API = import.meta.env.BASE_URL.replace(/\/$/, '');

const STOCKS = [
  { symbol: 'RELIANCE-EQ', token: '2885',  name: 'Reliance' },
  { symbol: 'TCS-EQ',       token: '11536', name: 'TCS' },
  { symbol: 'HDFCBANK-EQ',  token: '1333',  name: 'HDFC Bank' },
  { symbol: 'INFY-EQ',      token: '1594',  name: 'Infosys' },
  { symbol: 'ICICIBANK-EQ', token: '4963',  name: 'ICICI Bank' },
  { symbol: 'HINDUNILVR-EQ',token: '1394',  name: 'HUL' },
  { symbol: 'ITC-EQ',       token: '1660',  name: 'ITC' },
  { symbol: 'SBIN-EQ',      token: '3045',  name: 'SBI' },
  { symbol: 'BAJFINANCE-EQ',token: '317',   name: 'Bajaj Finance' },
  { symbol: 'BHARTIARTL-EQ',token: '10604', name: 'Airtel' },
  { symbol: 'KOTAKBANK-EQ', token: '1922',  name: 'Kotak Bank' },
  { symbol: 'WIPRO-EQ',     token: '3787',  name: 'Wipro' },
  { symbol: 'HCLTECH-EQ',   token: '7229',  name: 'HCL Tech' },
  { symbol: 'AXISBANK-EQ',  token: '5900',  name: 'Axis Bank' },
  { symbol: 'MARUTI-EQ',    token: '10999', name: 'Maruti' },
  { symbol: 'SUNPHARMA-EQ', token: '3351',  name: 'Sun Pharma' },
  { symbol: 'TATASTEEL-EQ', token: '3499',  name: 'Tata Steel' },
  { symbol: 'LT-EQ',        token: '11483', name: 'L&T' },
  { symbol: 'ONGC-EQ',      token: '2031',  name: 'ONGC' },
  { symbol: 'NTPC-EQ',      token: '11630', name: 'NTPC' },
];

function fmt(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 }); }
function fmtExact(n: number) { return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 }); }
function pct(n: number) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
function pnlColor(n: number) { return n >= 0 ? 'text-green-400' : 'text-red-400'; }
function pnlBg(n: number) { return n >= 0 ? 'bg-green-400/10 border-green-400/20' : 'bg-red-400/10 border-red-400/20'; }
function timeFmt(ts: number) {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}
function dateFmt(ts: number) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

interface PeriodStats {
  trades: number; wins: number; losses: number;
  winRate: number; pnl: number;
  avgWin: number; avgLoss: number;
  bestTrade: number; worstTrade: number;
}
interface PaperPosition {
  symbol: string; symboltoken: string;
  quantity: number; avgPrice: number; currentPrice: number;
  pnl: number; pnlPct: number; entryTime: number;
}
interface ClosedTrade {
  id: string; symbol: string; side: string;
  quantity: number; entryPrice: number; exitPrice: number;
  pnl: number; pnlPct: number; entryTime: number; exitTime: number; won: boolean;
}
interface StatsData {
  account: {
    initialBalance: number; balance: number; totalValue: number;
    unrealizedPnl: number; realizedPnl: number;
    overallPnl: number; overallPnlPct: number;
  };
  today: PeriodStats; yesterday: PeriodStats;
  wtd: PeriodStats; mtd: PeriodStats;
  last3: PeriodStats; last7: PeriodStats; allTime: PeriodStats;
  positions: PaperPosition[];
  openOrders: unknown[];
}

type TabKey = 'dashboard' | 'trade' | 'history';
type PeriodKey = 'today' | 'yesterday' | '3days' | '7days';

function WinRateRing({ rate, trades }: { rate: number; trades: number }) {
  const r = 36, circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;
  return (
    <div className="flex flex-col items-center">
      <div className="relative w-20 h-20">
        <svg viewBox="0 0 84 84" className="w-full h-full -rotate-90">
          <circle cx="42" cy="42" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="8" />
          <circle cx="42" cy="42" r={r} fill="none"
            stroke={rate >= 60 ? '#4ade80' : rate >= 40 ? '#facc15' : '#f87171'}
            strokeWidth="8" strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round" className="transition-all duration-700" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-base font-bold leading-none ${rate >= 60 ? 'text-green-400' : rate >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
            {rate.toFixed(0)}%
          </span>
          <span className="text-[8px] text-muted-foreground leading-none mt-0.5">WIN</span>
        </div>
      </div>
      <span className="text-[10px] text-muted-foreground mt-1">{trades} trades</span>
    </div>
  );
}

function StatCard({ label, pnl, stats, accent }: { label: string; pnl: number; stats: PeriodStats; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-1 ${pnlBg(pnl)} ${accent ? 'ring-1 ring-accent/30' : ''}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-[9px] text-muted-foreground">{stats.trades}T</span>
      </div>
      <span className={`text-sm font-bold ${pnlColor(pnl)}`}>{pnl >= 0 ? '+' : ''}{fmt(pnl)}</span>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[9px] text-green-400">{stats.wins}W</span>
        <span className="text-[9px] text-red-400">{stats.losses}L</span>
        <span className={`text-[9px] font-semibold ml-auto ${stats.winRate >= 60 ? 'text-green-400' : stats.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
          {stats.winRate.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: ClosedTrade }) {
  return (
    <div className={`flex items-center gap-2 p-2.5 rounded-lg border ${trade.won ? 'border-green-400/20 bg-green-400/5' : 'border-red-400/20 bg-red-400/5'}`}>
      <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${trade.won ? 'bg-green-400/20' : 'bg-red-400/20'}`}>
        {trade.won ? <CheckCircle2 size={12} className="text-green-400" /> : <XCircle size={12} className="text-red-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-semibold truncate">{trade.symbol.replace('-EQ','')}</span>
          <span className={`text-[9px] px-1 py-0.5 rounded font-bold ${trade.side === 'SELL' ? 'bg-red-400/20 text-red-400' : 'bg-green-400/20 text-green-400'}`}>
            {trade.side}
          </span>
          <span className="text-[9px] text-muted-foreground ml-auto">{dateFmt(trade.exitTime)} {timeFmt(trade.exitTime)}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] text-muted-foreground">{trade.quantity} × {fmtExact(trade.entryPrice)} → {fmtExact(trade.exitPrice)}</span>
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <div className={`text-xs font-bold ${pnlColor(trade.pnl)}`}>{trade.pnl >= 0 ? '+' : ''}{fmt(trade.pnl)}</div>
        <div className={`text-[9px] ${pnlColor(trade.pnlPct)}`}>{pct(trade.pnlPct)}</div>
      </div>
    </div>
  );
}

export function PaperTrading() {
  const [tab, setTab] = useState<TabKey>('dashboard');
  const [stats, setStats] = useState<StatsData | null>(null);
  const [trades, setTrades] = useState<ClosedTrade[]>([]);
  const [histPeriod, setHistPeriod] = useState<PeriodKey>('today');
  const [loading, setLoading] = useState(true);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [resetting, setResetting] = useState(false);
  const [closingSymbol, setClosingSymbol] = useState<string | null>(null);

  const [selectedStock, setSelectedStock] = useState(STOCKS[0]);
  const [stockSearch, setStockSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState('1');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [limitPrice, setLimitPrice] = useState('');

  const loadStats = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/paper/stats`);
      const d = await r.json();
      if (d.success) setStats(d.data);
    } catch (_e) {}
    finally { setLoading(false); }
  }, []);

  const loadTrades = useCallback(async (period: PeriodKey) => {
    try {
      const map = { today: 'today', yesterday: 'yesterday', '3days': '3days', '7days': '7days' };
      const r = await fetch(`${API}/api/paper/trades?period=${map[period]}`);
      const d = await r.json();
      if (d.success) setTrades(d.data);
    } catch (_e) {}
  }, []);

  useEffect(() => {
    loadStats();
    const id = setInterval(loadStats, 10000);
    return () => clearInterval(id);
  }, [loadStats]);

  useEffect(() => {
    loadTrades(histPeriod);
  }, [histPeriod, loadTrades]);

  const showMsg = (text: string, ok: boolean) => {
    setMsg({ text, ok });
    setTimeout(() => setMsg(null), 3500);
  };

  const placeTrade = async () => {
    if (!qty || Number(qty) <= 0) { showMsg('Enter valid quantity', false); return; }
    if (orderType === 'LIMIT' && (!limitPrice || Number(limitPrice) <= 0)) { showMsg('Enter valid limit price', false); return; }
    setTradeLoading(true);
    try {
      const body: Record<string, unknown> = {
        symbol: selectedStock.symbol,
        symboltoken: selectedStock.token,
        transactiontype: side,
        ordertype: orderType,
        quantity: Number(qty),
      };
      if (orderType === 'LIMIT') body.price = Number(limitPrice);
      const r = await fetch(`${API}/api/paper/order`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (d.success) {
        showMsg(`${side} ${qty} ${selectedStock.name} — ${d.order.status}`, true);
        await loadStats();
      } else {
        showMsg(d.error || 'Order failed', false);
      }
    } catch (_e) { showMsg('Network error', false); }
    finally { setTradeLoading(false); }
  };

  const closePos = async (pos: PaperPosition) => {
    setClosingSymbol(pos.symbol);
    try {
      const r = await fetch(`${API}/api/paper/close/${encodeURIComponent(pos.symbol)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symboltoken: pos.symboltoken }),
      });
      const d = await r.json();
      if (d.success) { showMsg(`Closed ${pos.symbol.replace('-EQ','')} position`, true); await loadStats(); }
      else showMsg(d.error || 'Close failed', false);
    } catch (_e) { showMsg('Network error', false); }
    finally { setClosingSymbol(null); }
  };

  const resetAccount = async () => {
    if (!confirm('Reset paper account to ₹10,00,000? All trades and positions will be cleared.')) return;
    setResetting(true);
    try {
      await fetch(`${API}/api/paper/reset`, { method: 'POST' });
      showMsg('Account reset to ₹10,00,000', true);
      await loadStats();
      await loadTrades(histPeriod);
    } catch (_e) {}
    finally { setResetting(false); }
  };

  const filteredStocks = stockSearch
    ? STOCKS.filter(s => s.name.toLowerCase().includes(stockSearch.toLowerCase()) || s.symbol.toLowerCase().includes(stockSearch.toLowerCase()))
    : STOCKS;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <RefreshCw size={24} className="text-accent animate-spin" />
    </div>
  );

  const acc = stats?.account;
  const allTime = stats?.allTime;

  return (
    <div className="min-h-screen bg-background pb-4">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="glass-panel border-b border-white/10 px-4 pt-10 pb-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-accent/20 flex items-center justify-center">
              <FlaskConical size={14} className="text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-foreground">Paper Trading</h1>
              <p className="text-[9px] text-muted-foreground">Live market simulation</p>
            </div>
          </div>
          <button
            onClick={resetAccount}
            disabled={resetting}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive border border-white/10 rounded-lg px-2 py-1 transition-colors"
          >
            <RotateCcw size={11} className={resetting ? 'animate-spin' : ''} />
            Reset
          </button>
        </div>

        {/* Portfolio Value */}
        <div className="text-center mb-3">
          <div className="text-2xl font-bold text-foreground">{acc ? fmt(acc.totalValue) : '—'}</div>
          <div className="text-xs text-muted-foreground">Virtual Portfolio Value</div>
          {acc && (
            <div className={`flex items-center justify-center gap-2 mt-1`}>
              <span className={`text-sm font-semibold ${pnlColor(acc.overallPnl)}`}>
                {acc.overallPnl >= 0 ? '+' : ''}{fmt(acc.overallPnl)}
              </span>
              <span className={`text-xs ${pnlColor(acc.overallPnlPct)}`}>
                ({pct(acc.overallPnlPct)})
              </span>
              <span className="text-[10px] text-muted-foreground">Overall</span>
            </div>
          )}
        </div>

        {/* Mini stats row */}
        {acc && (
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/5 rounded-lg px-2 py-1.5">
              <div className="text-[9px] text-muted-foreground uppercase">Cash</div>
              <div className="text-xs font-semibold">{fmt(acc.balance)}</div>
            </div>
            <div className="bg-white/5 rounded-lg px-2 py-1.5">
              <div className="text-[9px] text-muted-foreground uppercase">Realized</div>
              <div className={`text-xs font-semibold ${pnlColor(acc.realizedPnl)}`}>{acc.realizedPnl >= 0 ? '+' : ''}{fmt(acc.realizedPnl)}</div>
            </div>
            <div className="bg-white/5 rounded-lg px-2 py-1.5">
              <div className="text-[9px] text-muted-foreground uppercase">Unrealized</div>
              <div className={`text-xs font-semibold ${pnlColor(acc.unrealizedPnl)}`}>{acc.unrealizedPnl >= 0 ? '+' : ''}{fmt(acc.unrealizedPnl)}</div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Tab bar ────────────────────────────────────────────────────── */}
      <div className="flex border-b border-white/10 bg-background/80 sticky top-0 z-20">
        {(['dashboard','trade','history'] as TabKey[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2.5 text-[11px] font-semibold uppercase tracking-wider transition-colors ${tab === t ? 'text-accent border-b-2 border-accent' : 'text-muted-foreground'}`}
          >
            {t === 'dashboard' ? '📊 Dashboard' : t === 'trade' ? '⚡ Trade' : '📋 History'}
          </button>
        ))}
      </div>

      {/* ─── Toast ──────────────────────────────────────────────────────── */}
      {msg && (
        <div className={`mx-4 mt-3 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-2 border ${msg.ok ? 'border-green-400/30 bg-green-400/10 text-green-300' : 'border-red-400/30 bg-red-400/10 text-red-300'}`}>
          {msg.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          {msg.text}
        </div>
      )}

      {/* ═══════════════════ DASHBOARD TAB ══════════════════════════════ */}
      {tab === 'dashboard' && stats && (
        <div className="px-4 pt-4 space-y-4">

          {/* Period P&L cards */}
          <div>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Calendar size={10} /> Performance Summary
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <StatCard label="Today" pnl={stats.today.pnl} stats={stats.today} accent />
              <StatCard label="Yesterday" pnl={stats.yesterday.pnl} stats={stats.yesterday} />
              <StatCard label="Week to Date" pnl={stats.wtd.pnl} stats={stats.wtd} />
              <StatCard label="Month to Date" pnl={stats.mtd.pnl} stats={stats.mtd} />
            </div>
          </div>

          {/* Accumulated results */}
          <div>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Trophy size={10} /> Accumulated Winnings
            </h3>
            <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden">
              {[
                { label: 'Today', stats: stats.today },
                { label: '2-Day (Yesterday + Today)', stats: { ...stats.last3, pnl: stats.today.pnl + stats.yesterday.pnl, trades: stats.today.trades + stats.yesterday.trades, wins: stats.today.wins + stats.yesterday.wins, losses: stats.today.losses + stats.yesterday.losses, winRate: (stats.today.wins + stats.yesterday.wins) / Math.max(1, stats.today.trades + stats.yesterday.trades) * 100, avgWin: 0, avgLoss: 0, bestTrade: Math.max(stats.today.bestTrade, stats.yesterday.bestTrade), worstTrade: Math.min(stats.today.worstTrade, stats.yesterday.worstTrade) } },
                { label: '3-Day Accumulated', stats: stats.last3 },
                { label: '7-Day Accumulated', stats: stats.last7 },
                { label: 'All Time', stats: stats.allTime },
              ].map(({ label, stats: s }, i) => (
                <div key={label} className={`flex items-center justify-between px-3 py-2.5 ${i > 0 ? 'border-t border-white/5' : ''}`}>
                  <div>
                    <div className="text-xs text-foreground font-medium">{label}</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">
                      {s.wins}W / {s.losses}L / {s.trades} trades
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${pnlColor(s.pnl)}`}>{s.pnl >= 0 ? '+' : ''}{fmt(s.pnl)}</div>
                    <div className={`text-[9px] font-semibold ${s.winRate >= 60 ? 'text-green-400' : s.winRate >= 40 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {s.winRate.toFixed(0)}% win rate
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Win Rate gauge + period breakdown */}
          <div>
            <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Target size={10} /> Win Rate Analysis
            </h3>
            <div className="bg-white/5 rounded-xl border border-white/10 p-3">
              <div className="flex items-center justify-around">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] text-muted-foreground">Today</span>
                  <WinRateRing rate={stats.today.winRate} trades={stats.today.trades} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] text-muted-foreground">7-Day</span>
                  <WinRateRing rate={stats.last7.winRate} trades={stats.last7.trades} />
                </div>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-[9px] text-muted-foreground">All Time</span>
                  <WinRateRing rate={stats.allTime.winRate} trades={stats.allTime.trades} />
                </div>
              </div>
              {allTime && allTime.trades > 0 && (
                <div className="grid grid-cols-2 gap-2 mt-3 border-t border-white/10 pt-3">
                  <div className="text-center">
                    <div className="text-[9px] text-muted-foreground">Avg Win</div>
                    <div className="text-xs font-semibold text-green-400">+{fmt(allTime.avgWin)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-muted-foreground">Avg Loss</div>
                    <div className="text-xs font-semibold text-red-400">{fmt(allTime.avgLoss)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-muted-foreground">Best Trade</div>
                    <div className="text-xs font-semibold text-green-400">+{fmt(allTime.bestTrade)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[9px] text-muted-foreground">Worst Trade</div>
                    <div className="text-xs font-semibold text-red-400">{fmt(allTime.worstTrade)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Open positions */}
          {stats.positions.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <BarChart3 size={10} /> Open Positions ({stats.positions.length})
              </h3>
              <div className="space-y-2">
                {stats.positions.map(pos => (
                  <div key={pos.symbol} className={`rounded-xl border p-3 ${pnlBg(pos.pnl)}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="text-xs font-bold">{pos.symbol.replace('-EQ','')}</span>
                        <span className="text-[9px] text-muted-foreground ml-2">×{pos.quantity} @ {fmtExact(pos.avgPrice)}</span>
                      </div>
                      <button
                        onClick={() => closePos(pos)}
                        disabled={closingSymbol === pos.symbol}
                        className="text-[10px] px-2 py-1 rounded-lg bg-red-400/20 text-red-400 hover:bg-red-400/30 flex items-center gap-1 disabled:opacity-50"
                      >
                        {closingSymbol === pos.symbol ? <RefreshCw size={9} className="animate-spin" /> : <X size={9} />}
                        Close
                      </button>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="text-[9px] text-muted-foreground">LTP</div>
                          <div className="text-xs font-semibold">{fmtExact(pos.currentPrice)}</div>
                        </div>
                        <div>
                          <div className="text-[9px] text-muted-foreground">Value</div>
                          <div className="text-xs font-semibold">{fmt(pos.currentPrice * pos.quantity)}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-sm font-bold ${pnlColor(pos.pnl)}`}>{pos.pnl >= 0 ? '+' : ''}{fmt(pos.pnl)}</div>
                        <div className={`text-[10px] ${pnlColor(pos.pnlPct)}`}>{pct(pos.pnlPct)}</div>
                      </div>
                    </div>
                    <div className="text-[9px] text-muted-foreground flex items-center gap-1 mt-1">
                      <Clock size={8} /> Since {timeFmt(pos.entryTime)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {stats.positions.length === 0 && stats.allTime.trades === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <FlaskConical size={32} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No trades yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Go to the Trade tab to start paper trading with live market prices</p>
              <button onClick={() => setTab('trade')} className="mt-4 text-xs text-accent border border-accent/30 rounded-lg px-4 py-2 hover:bg-accent/10">
                Start Trading →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ TRADE TAB ═══════════════════════════════════ */}
      {tab === 'trade' && (
        <div className="px-4 pt-4 space-y-4">
          <div className="bg-white/5 rounded-xl border border-white/10 p-4 space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Zap size={14} className="text-accent" />
              <span className="text-sm font-bold">Place Paper Order</span>
              <span className="ml-auto text-[9px] bg-accent/20 text-accent px-2 py-0.5 rounded-full font-semibold">LIVE PRICES</span>
            </div>

            {/* Stock picker */}
            <div className="relative">
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Stock</label>
              <button
                className="w-full flex items-center justify-between bg-white/5 border border-white/15 rounded-xl px-3 py-2.5 text-sm font-medium"
                onClick={() => setShowDropdown(v => !v)}
              >
                <span>{selectedStock.name} <span className="text-[10px] text-muted-foreground">({selectedStock.symbol.replace('-EQ','')})</span></span>
                <ChevronDown size={14} className={`text-muted-foreground transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
              </button>
              {showDropdown && (
                <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-card border border-white/15 rounded-xl shadow-xl overflow-hidden">
                  <div className="p-2 border-b border-white/10">
                    <input
                      autoFocus
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs outline-none placeholder:text-muted-foreground"
                      placeholder="Search stock…"
                      value={stockSearch}
                      onChange={e => setStockSearch(e.target.value)}
                    />
                  </div>
                  <div className="max-h-48 overflow-y-auto">
                    {filteredStocks.map(s => (
                      <button
                        key={s.symbol}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 flex items-center justify-between"
                        onClick={() => { setSelectedStock(s); setShowDropdown(false); setStockSearch(''); }}
                      >
                        <span className="font-medium">{s.name}</span>
                        <span className="text-muted-foreground text-[10px]">{s.symbol.replace('-EQ','')}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* BUY / SELL toggle */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Direction</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setSide('BUY')}
                  className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${side === 'BUY' ? 'bg-green-400/20 border-green-400/40 text-green-400' : 'border-white/10 text-muted-foreground'}`}
                >
                  <Plus size={14} className="inline mr-1" />BUY
                </button>
                <button
                  onClick={() => setSide('SELL')}
                  className={`py-2.5 rounded-xl text-sm font-bold border transition-all ${side === 'SELL' ? 'bg-red-400/20 border-red-400/40 text-red-400' : 'border-white/10 text-muted-foreground'}`}
                >
                  <Minus size={14} className="inline mr-1" />SELL
                </button>
              </div>
            </div>

            {/* Order type */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Order Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['MARKET', 'LIMIT'] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setOrderType(t)}
                    className={`py-2 rounded-xl text-xs font-semibold border transition-all ${orderType === t ? 'bg-accent/20 border-accent/40 text-accent' : 'border-white/10 text-muted-foreground'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div>
              <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Quantity</label>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(q => String(Math.max(1, Number(q) - 1)))} className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <Minus size={14} />
                </button>
                <input
                  type="number" min="1"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-center font-semibold outline-none"
                  value={qty}
                  onChange={e => setQty(e.target.value)}
                />
                <button onClick={() => setQty(q => String(Number(q) + 1))} className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground">
                  <Plus size={14} />
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                {[5, 10, 25, 50, 100].map(q => (
                  <button key={q} onClick={() => setQty(String(q))} className={`flex-1 py-1 text-[10px] rounded-lg border transition-all ${qty === String(q) ? 'border-accent/40 text-accent bg-accent/10' : 'border-white/10 text-muted-foreground'}`}>
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Limit price */}
            {orderType === 'LIMIT' && (
              <div>
                <label className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-1">Limit Price (₹)</label>
                <input
                  type="number"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm outline-none"
                  placeholder="Enter limit price"
                  value={limitPrice}
                  onChange={e => setLimitPrice(e.target.value)}
                />
              </div>
            )}

            {/* Balance info */}
            {acc && (
              <div className="flex items-center justify-between text-[10px] text-muted-foreground bg-white/5 rounded-lg px-3 py-2">
                <span>Available Cash</span>
                <span className="font-semibold text-foreground">{fmt(acc.balance)}</span>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={placeTrade}
              disabled={tradeLoading}
              className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                side === 'BUY'
                  ? 'bg-green-400/20 border border-green-400/40 text-green-400 hover:bg-green-400/30'
                  : 'bg-red-400/20 border border-red-400/40 text-red-400 hover:bg-red-400/30'
              } disabled:opacity-50`}
            >
              {tradeLoading
                ? <RefreshCw size={14} className="animate-spin" />
                : side === 'BUY' ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              {tradeLoading ? 'Placing…' : `${side} ${qty} × ${selectedStock.name}`}
            </button>

            <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground/60">
              <AlertCircle size={9} />
              Paper trades use live Angel One market prices. No real money involved.
            </div>
          </div>

          {/* Open positions in trade tab too */}
          {stats && stats.positions.length > 0 && (
            <div>
              <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Open Positions</h3>
              <div className="space-y-2">
                {stats.positions.map(pos => (
                  <div key={pos.symbol} className={`rounded-xl border p-3 flex items-center justify-between ${pnlBg(pos.pnl)}`}>
                    <div>
                      <span className="text-xs font-bold">{pos.symbol.replace('-EQ','')}</span>
                      <div className="text-[9px] text-muted-foreground">×{pos.quantity} @ {fmtExact(pos.avgPrice)} → {fmtExact(pos.currentPrice)}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right">
                        <div className={`text-xs font-bold ${pnlColor(pos.pnl)}`}>{pos.pnl >= 0 ? '+' : ''}{fmt(pos.pnl)}</div>
                        <div className={`text-[9px] ${pnlColor(pos.pnlPct)}`}>{pct(pos.pnlPct)}</div>
                      </div>
                      <button
                        onClick={() => closePos(pos)}
                        disabled={closingSymbol === pos.symbol}
                        className="text-[10px] px-2 py-1 rounded-lg bg-red-400/20 text-red-400 hover:bg-red-400/30 flex items-center gap-1"
                      >
                        {closingSymbol === pos.symbol ? <RefreshCw size={9} className="animate-spin" /> : <X size={9} />}
                        Close
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════ HISTORY TAB ═════════════════════════════════ */}
      {tab === 'history' && (
        <div className="px-4 pt-4 space-y-3">
          {/* Period selector */}
          <div className="flex gap-2">
            {([
              { key: 'today',     label: 'Today' },
              { key: 'yesterday', label: 'Yesterday' },
              { key: '3days',     label: '3 Days' },
              { key: '7days',     label: '7 Days' },
            ] as { key: PeriodKey; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setHistPeriod(key)}
                className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg border transition-all ${histPeriod === key ? 'border-accent/40 text-accent bg-accent/10' : 'border-white/10 text-muted-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Summary for period */}
          {stats && (() => {
            const s = histPeriod === 'today' ? stats.today : histPeriod === 'yesterday' ? stats.yesterday : histPeriod === '3days' ? stats.last3 : stats.last7;
            return s.trades > 0 ? (
              <div className={`rounded-xl border p-3 ${pnlBg(s.pnl)}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs font-bold">{s.trades} Trades</div>
                    <div className="text-[9px] text-muted-foreground mt-0.5">{s.wins} wins · {s.losses} losses · {s.winRate.toFixed(0)}% win rate</div>
                  </div>
                  <div className="text-right">
                    <div className={`text-sm font-bold ${pnlColor(s.pnl)}`}>{s.pnl >= 0 ? '+' : ''}{fmt(s.pnl)}</div>
                    <div className="text-[9px] text-muted-foreground">Net P&L</div>
                  </div>
                </div>
              </div>
            ) : null;
          })()}

          {/* Trade list */}
          {trades.length > 0 ? (
            <div className="space-y-2">
              {trades.map(t => <TradeRow key={t.id} trade={t} />)}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-14 text-center">
              <Clock size={28} className="text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No closed trades for this period</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Place and close trades to see results here</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
