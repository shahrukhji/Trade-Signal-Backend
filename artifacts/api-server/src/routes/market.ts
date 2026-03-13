import { Router } from "express";
import * as angelone from "../lib/angelone.js";
import { getMarketStatus } from "../lib/market-hours.js";
import { MARKET_INDICES, NIFTY50, MIDCAP_STOCKS, SMALLCAP_STOCKS } from "../lib/constants.js";

const router = Router();

// Token → display name map for indices
const INDEX_NAME: Record<string, string> = {
  "99926000": "NIFTY 50",
  "99926009": "BANK NIFTY",
  "99926011": "MIDCAP 100",
  "1": "SENSEX",
  "12": "BANKEX",
  "999920003": "INDIA VIX",
};

router.post("/quote", async (req, res) => {
  try {
    const { symbols, exchange = "NSE", mode = "FULL" } = req.body as {
      symbols: string[];
      exchange?: string;
      mode?: string;
    };

    if (!symbols || !Array.isArray(symbols)) {
      res.status(400).json({ error: "symbols array required" });
      return;
    }

    const tokens: string[] = [];
    for (const sym of symbols.slice(0, 50)) {
      const stock = NIFTY50.find(s => s.symbol === sym || s.symbol === sym + "-EQ" || s.name === sym);
      if (stock) tokens.push(stock.token);
    }

    if (tokens.length === 0) {
      res.status(400).json({ error: "No valid symbols found" });
      return;
    }

    const data = await angelone.getLiveQuote(mode, { [exchange]: tokens });
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Quote failed";
    res.status(500).json({ error: msg });
  }
});

router.post("/candles", async (req, res) => {
  try {
    const { symbol, symboltoken, exchange = "NSE", interval, fromdate, todate } = req.body as {
      symbol?: string;
      symboltoken?: string;
      exchange?: string;
      interval: string;
      fromdate: string;
      todate: string;
    };

    let token = symboltoken;
    if (!token && symbol) {
      // Try exact match first, then with -EQ suffix
      const stock = NIFTY50.find(s =>
        s.symbol === symbol ||
        s.symbol === symbol + "-EQ" ||
        s.symbol.replace("-EQ", "") === symbol
      );
      token = stock?.token;
    }

    if (!token) {
      res.status(400).json({ error: "symboltoken or valid symbol required" });
      return;
    }

    const raw = await angelone.getCandleData({ exchange, symboltoken: token, interval, fromdate, todate });
    const candles = raw.map(([ts, open, high, low, close, volume]) => ({
      time: new Date(ts).getTime() / 1000,
      open, high, low, close, volume,
    }));

    res.json({ success: true, candles });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Candle fetch failed";
    res.status(500).json({ error: msg });
  }
});

router.get("/status", (_req, res) => {
  const status = getMarketStatus();
  res.json(status);
});

// Returns clean array: [{ name, token, exchange, ltp, change, percentChange, open, high, low }]
router.get("/indices", async (_req, res) => {
  try {
    const nseTokens = MARKET_INDICES.filter(i => i.exchange === "NSE").map(i => i.token);
    const bseTokens = MARKET_INDICES.filter(i => i.exchange === "BSE").map(i => i.token);

    const out: Array<{
      name: string; token: string; exchange: string;
      ltp: number; open: number; high: number; low: number; close: number;
      change: number; percentChange: number;
    }> = [];

    const parseQuoteData = (raw: unknown, exchange: string) => {
      if (!raw || typeof raw !== "object") return;
      const fetched = (raw as Record<string, unknown>)?.fetched;
      if (!Array.isArray(fetched)) return;
      for (const q of fetched) {
        const token = String(q.symbolToken ?? q.token ?? "");
        const name = INDEX_NAME[token] || MARKET_INDICES.find(m => m.token === token)?.symbol || token;
        out.push({
          name, token, exchange,
          ltp: Number(q.ltp ?? 0),
          open: Number(q.open ?? 0),
          high: Number(q.high ?? 0),
          low: Number(q.low ?? 0),
          close: Number(q.close ?? 0),
          change: Number(q.netChange ?? q.change ?? 0),
          percentChange: Number(q.percentChange ?? q.pChange ?? 0),
        });
      }
    };

    if (nseTokens.length > 0) {
      try {
        const nseData = await angelone.getLiveQuote("FULL", { NSE: nseTokens });
        parseQuoteData(nseData, "NSE");
      } catch { /* ignore partial failure */ }
    }

    if (bseTokens.length > 0) {
      try {
        const bseData = await angelone.getLiveQuote("FULL", { BSE: bseTokens });
        parseQuoteData(bseData, "BSE");
      } catch { /* ignore partial failure */ }
    }

    res.json({ success: true, data: out });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Indices fetch failed";
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/market/movers?cap=large|mid|small&limit=5
 * Returns top gainers and losers for the selected market cap universe.
 * Fetches live FULL quotes from Angel One and computes % change.
 */
router.get("/movers", async (req, res) => {
  try {
    const cap = (req.query.cap as string) || "large";
    const limit = Math.min(Number(req.query.limit) || 5, 10);

    const universe =
      cap === "mid"   ? MIDCAP_STOCKS :
      cap === "small" ? SMALLCAP_STOCKS :
                        NIFTY50;

    const tokens = universe.map(s => s.token);
    const nameMap: Record<string, { name: string; symbol: string }> = {};
    for (const s of universe) nameMap[s.token] = { name: s.name, symbol: s.symbol };

    const raw = await angelone.getLiveQuote("FULL", { NSE: tokens }) as {
      fetched?: Array<{
        symbolToken?: string; token?: string;
        ltp?: number; close?: number; netChange?: number; percentChange?: number;
        open?: number; high?: number; low?: number;
      }>;
    };

    if (!raw?.fetched || !Array.isArray(raw.fetched) || raw.fetched.length === 0) {
      res.json({ success: true, gainers: [], losers: [], cap, total: 0 });
      return;
    }

    interface Mover {
      symbol: string; name: string; token: string;
      ltp: number; change: number; percentChange: number;
      open: number; high: number; low: number; close: number;
    }

    const movers: Mover[] = raw.fetched
      .filter(q => q.ltp && Number(q.ltp) > 0)
      .map(q => {
        const token = String(q.symbolToken ?? q.token ?? "");
        const info = nameMap[token] ?? { name: token, symbol: token };
        const ltp = Number(q.ltp ?? 0);
        const close = Number(q.close ?? 0);
        const pct = q.percentChange != null
          ? Number(q.percentChange)
          : close > 0 ? ((ltp - close) / close) * 100 : 0;
        const chg = q.netChange != null ? Number(q.netChange) : ltp - close;
        return {
          symbol: info.symbol.replace("-EQ", ""),
          name: info.name,
          token,
          ltp,
          change: chg,
          percentChange: pct,
          open: Number(q.open ?? 0),
          high: Number(q.high ?? 0),
          low: Number(q.low ?? 0),
          close,
        };
      });

    const sorted = [...movers].sort((a, b) => b.percentChange - a.percentChange);
    const gainers = sorted.slice(0, limit);
    const losers = sorted.slice(-limit).reverse();

    res.json({ success: true, gainers, losers, cap, total: movers.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Movers fetch failed";
    res.status(500).json({ error: msg });
  }
});

router.get("/gainers-losers", async (req, res) => {
  try {
    const { datatype = "PercPriceGainers", expirytype = "NEAR" } = req.query as {
      datatype?: string;
      expirytype?: string;
    };
    const data = await angelone.getGainersLosers(datatype, expirytype);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gainers/Losers fetch failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
