import * as angelone from "./angelone.js";
import * as groww from "./groww.js";

export type BrokerName = "ANGELONE" | "GROWW";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export class BrokerAdapter {
  constructor(public broker: BrokerName) {}

  async login(creds: Record<string, string>): Promise<unknown> {
    if (this.broker === "ANGELONE") {
      return angelone.login();
    } else {
      return groww.loginWithToken(creds.accessToken);
    }
  }

  async getProfile(): Promise<unknown> {
    return this.broker === "ANGELONE" ? angelone.getProfile() : groww.getProfile();
  }

  async getHoldings(): Promise<unknown> {
    return this.broker === "ANGELONE" ? angelone.getHoldings() : groww.getHoldings();
  }

  async getPositions(): Promise<unknown> {
    return this.broker === "ANGELONE" ? angelone.getPositions() : groww.getPositions();
  }

  async getFunds(): Promise<unknown> {
    return this.broker === "ANGELONE" ? angelone.getFunds() : groww.getFunds();
  }

  async placeOrder(params: Record<string, unknown>): Promise<unknown> {
    if (this.broker === "ANGELONE") {
      return angelone.placeOrder(params);
    } else {
      return groww.placeOrder(params);
    }
  }

  async getLTP(symbol: string, exchange = "NSE"): Promise<number> {
    if (this.broker === "ANGELONE") {
      const { NIFTY50 } = await import("./constants.js");
      const stock = NIFTY50.find(s => s.symbol === symbol);
      if (!stock) throw new Error(`Symbol not found: ${symbol}`);
      const data = await angelone.getLiveQuote("LTP", { [exchange]: [stock.token] }) as Record<string, unknown>;
      const fetched = (data as Record<string, unknown>).fetched as Array<{ ltp: number }>;
      return fetched?.[0]?.ltp ?? 0;
    } else {
      const data = await groww.getLTP(exchange, symbol) as { last_price?: number };
      return data?.last_price ?? 0;
    }
  }

  async getCandles(
    symbol: string,
    symboltoken: string,
    interval: string,
    fromdate: string,
    todate: string,
    exchange = "NSE"
  ): Promise<Candle[]> {
    if (this.broker === "ANGELONE") {
      const raw = await angelone.getCandleData({ exchange, symboltoken, interval, fromdate, todate });
      return raw.map(([ts, open, high, low, close, volume]) => ({
        time: new Date(ts).getTime() / 1000,
        open,
        high,
        low,
        close,
        volume,
      }));
    }
    return [];
  }
}

const adapters: Map<string, BrokerAdapter> = new Map();

export function getAdapter(broker: BrokerName): BrokerAdapter {
  if (!adapters.has(broker)) {
    adapters.set(broker, new BrokerAdapter(broker));
  }
  return adapters.get(broker)!;
}

export function getBrokerFromHeader(header: string | undefined): BrokerName {
  if (header?.toUpperCase() === "GROWW") return "GROWW";
  return "ANGELONE";
}
