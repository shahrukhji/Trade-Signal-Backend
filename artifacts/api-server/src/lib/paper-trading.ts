import { v4 as uuidv4 } from "uuid";

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
}

const INITIAL_BALANCE = 1000000;

interface PaperState {
  balance: number;
  orders: PaperOrder[];
  positions: Map<string, { quantity: number; avgPrice: number }>;
  ltpCache: Map<string, number>;
}

const state: PaperState = {
  balance: INITIAL_BALANCE,
  orders: [],
  positions: new Map(),
  ltpCache: new Map(),
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
    } else if (order.ordertype === "STOPLOSS_LIMIT" && order.limitPrice !== undefined) {
      if (order.transactiontype === "SELL" && ltp <= order.limitPrice) {
        shouldFill = true;
        fillPrice = order.limitPrice;
      }
    }

    if (shouldFill) {
      fillOrder(order, fillPrice);
    }
  }
}

function fillOrder(order: PaperOrder, fillPrice: number): void {
  const cost = fillPrice * order.quantity;

  if (order.transactiontype === "BUY") {
    if (state.balance < cost) {
      console.warn(`[Paper] Insufficient balance for ${order.symbol}`);
      return;
    }
    state.balance -= cost;
    const pos = state.positions.get(order.symbol) ?? { quantity: 0, avgPrice: 0 };
    const totalQty = pos.quantity + order.quantity;
    pos.avgPrice = (pos.avgPrice * pos.quantity + fillPrice * order.quantity) / totalQty;
    pos.quantity = totalQty;
    state.positions.set(order.symbol, pos);
  } else {
    const pos = state.positions.get(order.symbol);
    if (!pos || pos.quantity < order.quantity) {
      console.warn(`[Paper] Insufficient position for ${order.symbol}`);
      return;
    }
    state.balance += fillPrice * order.quantity;
    pos.quantity -= order.quantity;
    if (pos.quantity === 0) state.positions.delete(order.symbol);
    else state.positions.set(order.symbol, pos);
  }

  order.status = "FILLED";
  order.filledAt = Date.now();
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
    id: uuidv4(),
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

  if (params.ordertype === "MARKET") {
    const ltp = state.ltpCache.get(params.symbol) ?? params.price ?? 0;
    fillOrder(order, ltp);
  }

  return order;
}

export function cancelPaperOrder(id: string): boolean {
  const order = state.orders.find(o => o.id === id);
  if (!order || order.status !== "PENDING") return false;
  order.status = "CANCELLED";
  return true;
}

export function getPaperPortfolio(): {
  balance: number;
  invested: number;
  totalValue: number;
  pnl: number;
  pnlPct: number;
  positions: PaperPosition[];
  orders: PaperOrder[];
} {
  const positions: PaperPosition[] = [];
  let invested = 0;

  for (const [symbol, pos] of state.positions.entries()) {
    const currentPrice = state.ltpCache.get(symbol) ?? pos.avgPrice;
    const pnl = (currentPrice - pos.avgPrice) * pos.quantity;
    const pnlPct = ((currentPrice - pos.avgPrice) / pos.avgPrice) * 100;
    const posValue = currentPrice * pos.quantity;
    invested += pos.avgPrice * pos.quantity;
    positions.push({
      symbol,
      symboltoken: "",
      quantity: pos.quantity,
      avgPrice: pos.avgPrice,
      currentPrice,
      pnl,
      pnlPct,
    });
  }

  const totalValue = state.balance + positions.reduce((sum, p) => sum + p.currentPrice * p.quantity, 0);
  const pnl = totalValue - INITIAL_BALANCE;
  const pnlPct = (pnl / INITIAL_BALANCE) * 100;

  return {
    balance: state.balance,
    invested,
    totalValue,
    pnl,
    pnlPct,
    positions,
    orders: state.orders,
  };
}

export function isPaperMode(): boolean {
  return process.env.PAPER_MODE === "true";
}
