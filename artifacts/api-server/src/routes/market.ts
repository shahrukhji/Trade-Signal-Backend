import { Router } from "express";
import * as angelone from "../lib/angelone.js";
import { getMarketStatus } from "../lib/market-hours.js";
import { MARKET_INDICES, NIFTY50 } from "../lib/constants.js";
import { connectWebSocket, addSSEClient } from "../lib/websocket-stream.js";

const router = Router();

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
      const stock = NIFTY50.find(s => s.symbol === sym || s.name === sym);
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
      const stock = NIFTY50.find(s => s.symbol === symbol);
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

router.get("/indices", async (_req, res) => {
  try {
    const nseTokens = MARKET_INDICES.filter(i => i.exchange === "NSE").map(i => i.token);
    const bseTokens = MARKET_INDICES.filter(i => i.exchange === "BSE").map(i => i.token);

    const results: Record<string, unknown> = {};

    if (nseTokens.length > 0) {
      try {
        const nseData = await angelone.getLiveQuote("FULL", { NSE: nseTokens });
        results.NSE = nseData;
      } catch {}
    }

    if (bseTokens.length > 0) {
      try {
        const bseData = await angelone.getLiveQuote("FULL", { BSE: bseTokens });
        results.BSE = bseData;
      } catch {}
    }

    res.json({ success: true, data: results });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Indices fetch failed";
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
