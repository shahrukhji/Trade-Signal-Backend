import { Router } from "express";
import { getBrokerFromHeader, getAdapter } from "../lib/broker-adapter.js";
import * as angelone from "../lib/angelone.js";

const router = Router();

router.get("/holdings", async (req, res) => {
  try {
    const broker = getBrokerFromHeader(req.headers["x-broker"] as string);
    const data = await getAdapter(broker).getHoldings();
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Holdings fetch failed";
    res.status(500).json({ error: msg });
  }
});

router.get("/positions", async (req, res) => {
  try {
    const broker = getBrokerFromHeader(req.headers["x-broker"] as string);
    const data = await getAdapter(broker).getPositions();
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Positions fetch failed";
    res.status(500).json({ error: msg });
  }
});

router.get("/funds", async (req, res) => {
  try {
    const broker = getBrokerFromHeader(req.headers["x-broker"] as string);
    const data = await getAdapter(broker).getFunds();
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Funds fetch failed";
    res.status(500).json({ error: msg });
  }
});

/**
 * GET /api/portfolio/live-positions
 * Returns Angel One open positions enriched with fresh live LTP.
 * Computes live unrealised P&L client-side using LTP from getLiveQuote.
 */
router.get("/live-positions", async (_req, res) => {
  try {
    const raw = await angelone.getPositions() as {
      data?: Array<Record<string, string | number>>;
    };

    const posArray: Array<Record<string, string | number>> = Array.isArray(raw)
      ? raw
      : Array.isArray(raw?.data) ? raw.data : [];

    // Filter positions with open qty
    const open = posArray.filter(p => {
      const qty = Number(p.netqty ?? p.netQuantity ?? 0);
      return qty !== 0;
    });

    if (open.length === 0) {
      res.json({ success: true, positions: [] });
      return;
    }

    // Gather tokens for live price lookup
    const tokenMap: Record<string, string> = {};
    for (const p of open) {
      const token = String(p.symboltoken ?? p.symbolToken ?? "");
      if (token) tokenMap[token] = token;
    }
    const tokens = Object.keys(tokenMap);

    // Fetch live prices
    let ltpMap: Record<string, number> = {};
    if (tokens.length > 0) {
      try {
        const quoteRaw = await angelone.getLiveQuote("LTP", { NSE: tokens }) as {
          fetched?: Array<{ symbolToken?: string; token?: string; ltp?: number }>;
        };
        if (quoteRaw?.fetched) {
          for (const q of quoteRaw.fetched) {
            const tok = String(q.symbolToken ?? q.token ?? "");
            if (tok && q.ltp) ltpMap[tok] = Number(q.ltp);
          }
        }
      } catch { /* use position's own ltp if live quote fails */ }
    }

    const positions = open.map(p => {
      const token = String(p.symboltoken ?? p.symbolToken ?? "");
      const netqty = Number(p.netqty ?? p.netQuantity ?? 0);
      const avgPrice = Number(p.netprice ?? p.avgnetprice ?? p.avgPrice ?? 0);
      const liveLtp = ltpMap[token] ?? Number(p.ltp ?? 0);
      const side = netqty > 0 ? "BUY" : "SELL";
      // Unrealised P&L
      const unrealisedPnl = side === "BUY"
        ? (liveLtp - avgPrice) * Math.abs(netqty)
        : (avgPrice - liveLtp) * Math.abs(netqty);
      const pnlPct = avgPrice > 0 ? (unrealisedPnl / (avgPrice * Math.abs(netqty))) * 100 : 0;

      return {
        symbol: String(p.tradingsymbol ?? p.tradingSymbol ?? "").replace("-EQ", ""),
        tradingSymbol: String(p.tradingsymbol ?? p.tradingSymbol ?? ""),
        symbolToken: token,
        exchange: String(p.exchange ?? "NSE"),
        productType: String(p.producttype ?? p.productType ?? "INTRADAY"),
        side,
        netQty: netqty,
        avgPrice,
        ltp: liveLtp,
        unrealisedPnl,
        pnlPct,
        dayChange: Number(p.daychange ?? p.dayChange ?? 0),
      };
    });

    res.json({ success: true, positions });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Live positions fetch failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
