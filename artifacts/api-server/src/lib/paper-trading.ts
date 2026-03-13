/**
 * Paper Trading Engine — full-featured live-market simulation
 * Tracks balance, positions, closed trades, P&L, and statistics.
 */

function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export interface PaperOrder {
  id: string;
  symbol: string;
  symboltoken: string;
  transactiontype: "BUY" | "SELL";
  ordertype: "MARKET" | "LIMIT" | "STOPLOSS_LIMIT" | "STOPLOSS_MARKET";
  quantity: number;
  price: number;
  limitPrice?: number;
  status: "PENDING" | "FILLED" | "CANCELLED";
  filledAt?: number;
  filledPrice?: number;
  createdAt: number;
}

export interface PaperPosition {
  symbol: string;
  symboltoken: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  pnl: number;
  pnlPct: number;
  entryTime: number;
}

export interface ClosedTrade {
  id: string;
  symbol: string;
  symboltoken: string;
  side: "BUY" | "SELL";
  quantity: number;
  entryPrice: number;
  exitPrice: number;
  pnl: number;
  pnlPct: number;
  entryTime: number;
  exitTime: number;
  won: boolean;
}

const INITIAL_BALANCE = 1_000_000;

interface InternalPosition {
  quantity: number;
  avgPrice: number;
  symboltoken: string;
  entryTime: number;
}

interface PaperState {
  balance: number;
  orders: PaperOrder[];
  positions: Map<string, InternalPosition>;
  ltpCache: Map<string, number>;
  closedTrades: ClosedTrade[];
}

const state: PaperState = {
  balance: INITIAL_BALANCE,
  orders: [],
  positions: new Map(),
  ltpCache: new Map(),
  closedTrades: [],
};

export function updateLTP(symbol: string, price: number): void {
  state.ltpCache.set(symbol, price);
  processPendingOrders();
}

function processPendingOrders(): void {
  const pending = state.orders.filter(o => o.status === "PENDING");
  for (const order of pending) {
    const ltp = state.ltpCache.get(order.symbol);
    if (ltp === undefined) continue;

    let shouldFill = false;
    let fillPrice = ltp;

    if (order.ordertype === "MARKET") {
      shouldFill = true;
    } else if (order.ordertype === "LIMIT" && order.limitPrice !== undefined) {
      if (order.transactiontype === "BUY" && ltp <= order.limitPrice) {
        shouldFill = true;
        fillPrice = order.limitPrice;
      } else if (order.transactiontype === "SELL" && ltp >= order.limitPrice) {
        shouldFill = true;
        fillPrice = order.limitPrice;
      }
    } else if ((order.ordertype === "STOPLOSS_LIMIT" || order.ordertype === "STOPLOSS_MARKET") && order.limitPrice !== undefined) {
      if (order.transactiontype === "SELL" && ltp <= order.limitPrice) {
        shouldFill = true;
        fillPrice = order.limitPrice;
      } else if (order.transactiontype === "BUY" && ltp >= order.limitPrice) {
        shouldFill = true;
        fillPrice = order.limitPrice;
      }
    }

    if (shouldFill) fillOrder(order, fillPrice);
  }
}

function fillOrder(order: PaperOrder, fillPrice: number): void {
  const cost = fillPrice * order.quantity;
  const now = Date.now();

  if (order.transactiontype === "BUY") {
    if (state.balance < cost) {
      console.warn(`[Paper] Insufficient balance for ${order.symbol}`);
      return;
    }
    state.balance -= cost;
    const pos = state.positions.get(order.symbol);
    if (pos) {
      const totalQty = pos.quantity + order.quantity;
      pos.avgPrice = (pos.avgPrice * pos.quantity + fillPrice * order.quantity) / totalQty;
      pos.quantity = totalQty;
    } else {
      state.positions.set(order.symbol, {
        quantity: order.quantity,
        avgPrice: fillPrice,
        symboltoken: order.symboltoken,
        entryTime: now,
      });
    }
  } else {
    const pos = state.positions.get(order.symbol);
    if (!pos || pos.quantity < order.quantity) {
      console.warn(`[Paper] Insufficient position for ${order.symbol}`);
      return;
    }
    state.balance += fillPrice * order.quantity;

    const pnl = (fillPrice - pos.avgPrice) * order.quantity;
    const pnlPct = ((fillPrice - pos.avgPrice) / pos.avgPrice) * 100;

    state.closedTrades.push({
      id: genId(),
      symbol: order.symbol,
      symboltoken: order.symboltoken,
      side: "SELL",
      quantity: order.quantity,
      entryPrice: pos.avgPrice,
      exitPrice: fillPrice,
      pnl,
      pnlPct,
      entryTime: pos.entryTime,
      exitTime: now,
      won: pnl > 0,
    });

    pos.quantity -= order.quantity;
    if (pos.quantity === 0) state.positions.delete(order.symbol);
    else state.positions.set(order.symbol, pos);
  }

  order.status = "FILLED";
  order.filledAt = now;
  order.filledPrice = fillPrice;
}

export function placePaperOrder(params: {
  symbol: string;
  symboltoken: string;
  transactiontype: "BUY" | "SELL";
  ordertype: "MARKET" | "LIMIT" | "STOPLOSS_LIMIT" | "STOPLOSS_MARKET";
  quantity: number;
  price?: number;
}): PaperOrder {
  const order: PaperOrder = {
    id: genId(),
    symbol: params.symbol,
    symboltoken: params.symboltoken,
    transactiontype: params.transactiontype,
    ordertype: params.ordertype,
    quantity: params.quantity,
    price: params.price ?? 0,
    limitPrice: params.price,
    status: "PENDING",
    createdAt: Date.now(),
  };

  state.orders.push(order);

  const ltp = state.ltpCache.get(params.symbol) ?? params.price ?? 0;
  if (params.ordertype === "MARKET" && ltp > 0) {
    fillOrder(order, ltp);
  } else {
    processPendingOrders();
  }

  return order;
}

export function cancelPaperOrder(id: string): boolean {
  const order = state.orders.find(o => o.id === id);
  if (!order || order.status !== "PENDING") return false;
  order.status = "CANCELLED";
  return true;
}

export function closePosition(symbol: string): PaperOrder | null {
  const pos = state.positions.get(symbol);
  if (!pos) return null;
  const ltp = state.ltpCache.get(symbol) ?? pos.avgPrice;
  return placePaperOrder({
    symbol,
    symboltoken: pos.symboltoken,
    transactiontype: "SELL",
    ordertype: "MARKET",
    quantity: pos.quantity,
    price: ltp,
  });
}

export function resetPaperAccount(): void {
  state.balance = INITIAL_BALANCE;
  state.orders = [];
  state.positions.clear();
  state.closedTrades = [];
  state.ltpCache.clear();
}

function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfWeek(ts: number): number {
  const d = new Date(ts);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function startOfMonth(ts: number): number {
  const d = new Date(ts);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface PeriodStats {
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  pnl: number;
  avgWin: number;
  avgLoss: number;
  bestTrade: number;
  worstTrade: number;
}

function calcStats(trades: ClosedTrade[]): PeriodStats {
  const wins = trades.filter(t => t.won);
  const losses = trades.filter(t => !t.won);
  const pnl = trades.reduce((s, t) => s + t.pnl, 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.pnl, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pnl, 0) / losses.length : 0;
  const allPnls = trades.map(t => t.pnl);
  return {
    trades: trades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
    pnl,
    avgWin,
    avgLoss,
    bestTrade: allPnls.length ? Math.max(...allPnls) : 0,
    worstTrade: allPnls.length ? Math.min(...allPnls) : 0,
  };
}

export function getPaperStats() {
  const now = Date.now();
  const todayStart = startOfDay(now);
  const weekStart = startOfWeek(now);
  const monthStart = startOfMonth(now);
  const yesterdayStart = todayStart - 86_400_000;
  const day3Start = todayStart - 2 * 86_400_000;
  const day7Start = todayStart - 6 * 86_400_000;

  const all = state.closedTrades;
  const today    = all.filter(t => t.exitTime >= todayStart);
  const wtd      = all.filter(t => t.exitTime >= weekStart);
  const mtd      = all.filter(t => t.exitTime >= monthStart);
  const yest     = all.filter(t => t.exitTime >= yesterdayStart && t.exitTime < todayStart);
  const last3    = all.filter(t => t.exitTime >= day3Start);
  const last7    = all.filter(t => t.exitTime >= day7Start);

  const positions: PaperPosition[] = [];
  let unrealizedPnl = 0;
  for (const [symbol, pos] of state.positions.entries()) {
    const currentPrice = state.ltpCache.get(symbol) ?? pos.avgPrice;
    const pnl = (currentPrice - pos.avgPrice) * pos.quantity;
    const pnlPct = ((currentPrice - pos.avgPrice) / pos.avgPrice) * 100;
    unrealizedPnl += pnl;
    positions.push({
      symbol, symboltoken: pos.symboltoken,
      quantity: pos.quantity, avgPrice: pos.avgPrice,
      currentPrice, pnl, pnlPct, entryTime: pos.entryTime,
    });
  }

  const totalValue = state.balance + positions.reduce((s, p) => s + p.currentPrice * p.quantity, 0);
  const overallPnl = totalValue - INITIAL_BALANCE;

  return {
    account: {
      initialBalance: INITIAL_BALANCE,
      balance: state.balance,
      totalValue,
      unrealizedPnl,
      realizedPnl: all.reduce((s, t) => s + t.pnl, 0),
      overallPnl,
      overallPnlPct: (overallPnl / INITIAL_BALANCE) * 100,
    },
    today:    calcStats(today),
    yesterday:calcStats(yest),
    wtd:      calcStats(wtd),
    mtd:      calcStats(mtd),
    last3:    calcStats(last3),
    last7:    calcStats(last7),
    allTime:  calcStats(all),
    positions,
    openOrders: state.orders.filter(o => o.status === "PENDING"),
  };
}

export function getClosedTrades(period: "today" | "yesterday" | "3days" | "7days" | "all"): ClosedTrade[] {
  const now = Date.now();
  const todayStart = startOfDay(now);
  let fromTs: number;
  let toTs = now;
  switch (period) {
    case "today":     fromTs = todayStart; break;
    case "yesterday": fromTs = todayStart - 86_400_000; toTs = todayStart; break;
    case "3days":     fromTs = todayStart - 2 * 86_400_000; break;
    case "7days":     fromTs = todayStart - 6 * 86_400_000; break;
    default:          fromTs = 0;
  }
  return state.closedTrades
    .filter(t => t.exitTime >= fromTs && t.exitTime <= toTs)
    .slice()
    .reverse();
}

export function getPaperPortfolio() {
  const stats = getPaperStats();
  return {
    balance: stats.account.balance,
    invested: stats.positions.reduce((s, p) => s + p.avgPrice * p.quantity, 0),
    totalValue: stats.account.totalValue,
    pnl: stats.account.overallPnl,
    pnlPct: stats.account.overallPnlPct,
    positions: stats.positions,
    orders: state.orders,
  };
}

export function isPaperMode(): boolean {
  return process.env.PAPER_MODE === "true";
}
