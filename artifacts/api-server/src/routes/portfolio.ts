import { Router } from "express";
import { getBrokerFromHeader, getAdapter } from "../lib/broker-adapter.js";
import * as angelone from "../lib/angelone.js";

const router = Router();

// ─── Type helpers ─────────────────────────────────────────────────────────────
type RawRow = Record<string, string | number | null | undefined>;

function parseNum(v: unknown): number {
  const n = parseFloat(String(v ?? 0).replace(/,/g, ""));
  return isFinite(n) ? n : 0;
}

// ─── /summary ─────────────────────────────────────────────────────────────────
/**
 * GET /api/portfolio/summary
 * Returns a single consolidated snapshot of the Angel One account:
 *   balance, holdings, positions, orders — all fetched server-side.
 * Never falls back to fake/mock values.
 */
router.get("/summary", async (_req, res) => {
  const t0 = Date.now();

  const result: {
    balance: {
      availableCash: number; usedMargin: number; totalNet: number;
      availableMargin: number; collateral: number; totalPortfolioValue: number;
      todayPnL: number; unrealizedPnL: number;
    } | null;
    balanceError: string | null;
    holdings: unknown[];
    holdingsError: string | null;
    positions: unknown[];
    positionsError: string | null;
    orders: unknown[];
    ordersError: string | null;
    latencyMs: number;
  } = {
    balance: null, balanceError: null,
    holdings: [], holdingsError: null,
    positions: [], positionsError: null,
    orders: [], ordersError: null,
    latencyMs: 0,
  };

  // Fetch all in parallel — failures are isolated
  await Promise.all([

    // ── Balance (getRMS) ────────────────────────────────────────────────────
    (async () => {
      try {
        const raw = await angelone.getFunds() as RawRow;
        if (!raw) { result.balanceError = "Empty response from Angel One"; return; }

        // getRMS returns a single object (not array) with these fields
        result.balance = {
          availableCash:      parseNum(raw.availablecash),
          usedMargin:         parseNum(raw.utiliseddebits),
          totalNet:           parseNum(raw.net),
          availableMargin:    parseNum(raw.availableintradaypayin),
          collateral:         parseNum(raw.collateral),
          totalPortfolioValue: parseNum(raw.net),
          todayPnL:           parseNum(raw.m2mrealized),
          unrealizedPnL:      parseNum(raw.m2munrealized),
        };
      } catch (err) {
        result.balanceError = err instanceof Error ? err.message : "Funds fetch failed";
        // Try profile as a secondary source of some data
        try {
          const profile = await angelone.getProfile() as RawRow;
          if (profile) {
            // Profile doesn't have balance but confirms account is live
            result.balanceError = `${result.balanceError} (account verified via profile)`;
          }
        } catch {}
      }
    })(),

    // ── Holdings ────────────────────────────────────────────────────────────
    (async () => {
      try {
        const raw = await angelone.getHoldings() as unknown;
        const arr: RawRow[] = Array.isArray(raw) ? raw : [];
        result.holdings = arr.map(h => ({
          tradingSymbol: String(h.tradingsymbol ?? h.tradingSymbol ?? ""),
          exchange: String(h.exchange ?? "NSE"),
          symbolToken: String(h.symboltoken ?? h.symbolToken ?? ""),
          isin: String(h.isin ?? ""),
          companyName: String(h.companyname ?? h.tradingsymbol ?? ""),
          quantity: parseNum(h.quantity),
          averagePrice: parseNum(h.averageprice ?? h.averagePrice),
          ltp: parseNum(h.ltp),
          currentValue: parseNum(h.ltp) * parseNum(h.quantity),
          investedValue: parseNum(h.averageprice ?? h.averagePrice) * parseNum(h.quantity),
          pnl: parseNum(h.profitandloss ?? h.pnl),
          pnlPercent: parseNum(h.pnlpercentage ?? h.pnlPercent),
          product: String(h.product ?? "DELIVERY"),
          close: parseNum(h.close),
          dayChange: parseNum(h.close) > 0
            ? parseNum(h.ltp) - parseNum(h.close)
            : 0,
        }));
      } catch (err) {
        result.holdingsError = err instanceof Error ? err.message : "Holdings fetch failed";
      }
    })(),

    // ── Positions ───────────────────────────────────────────────────────────
    (async () => {
      try {
        const raw = await angelone.getPositions() as unknown;
        const arr: RawRow[] = Array.isArray(raw) ? raw : [];
        result.positions = arr.filter(p => parseNum(p.netqty ?? p.netQuantity) !== 0).map(p => {
          const qty = parseNum(p.netqty ?? p.netQuantity);
          const avg = parseNum(p.netprice ?? p.avgnetprice ?? p.avgPrice);
          const ltp = parseNum(p.ltp);
          const side = qty > 0 ? "BUY" : "SELL";
          const unrealised = side === "BUY"
            ? (ltp - avg) * Math.abs(qty)
            : (avg - ltp) * Math.abs(qty);
          return {
            tradingSymbol: String(p.tradingsymbol ?? p.tradingSymbol ?? ""),
            symbolToken: String(p.symboltoken ?? p.symbolToken ?? ""),
            exchange: String(p.exchange ?? "NSE"),
            productType: String(p.producttype ?? p.productType ?? "INTRADAY"),
            side, netQty: qty, avgPrice: avg, ltp,
            unrealisedPnl: unrealised,
            pnlPct: avg > 0 ? (unrealised / (avg * Math.abs(qty))) * 100 : 0,
          };
        });
      } catch (err) {
        result.positionsError = err instanceof Error ? err.message : "Positions fetch failed";
      }
    })(),

    // ── Order book ──────────────────────────────────────────────────────────
    (async () => {
      try {
        const raw = await angelone.getOrderBook() as unknown;
        const arr: RawRow[] = Array.isArray(raw) ? raw : [];
        result.orders = arr.map(o => ({
          orderId: String(o.orderid ?? o.orderId ?? ""),
          tradingSymbol: String(o.tradingsymbol ?? o.tradingSymbol ?? ""),
          transactionType: String(o.transactiontype ?? o.transactionType ?? ""),
          exchange: String(o.exchange ?? "NSE"),
          orderType: String(o.ordertype ?? o.orderType ?? "LIMIT"),
          productType: String(o.producttype ?? o.productType ?? ""),
          status: String(o.orderstatus ?? o.status ?? "pending").toLowerCase(),
          quantity: parseNum(o.quantity),
          filledQuantity: parseNum(o.filledshares ?? o.filledQuantity),
          price: parseNum(o.price),
          averagePrice: parseNum(o.averageprice ?? o.averagePrice),
          orderTimestamp: String(o.ordercreationtime ?? o.orderTimestamp ?? ""),
        }));
      } catch (err) {
        result.ordersError = err instanceof Error ? err.message : "Orders fetch failed";
      }
    })(),

  ]);

  result.latencyMs = Date.now() - t0;
  res.json({ success: true, ...result });
});

// ─── /live-positions ──────────────────────────────────────────────────────────
router.get("/live-positions", async (_req, res) => {
  try {
    const raw = await angelone.getPositions() as { data?: RawRow[] };
    const posArray: RawRow[] = Array.isArray(raw) ? raw
      : Array.isArray(raw?.data) ? raw.data : [];

    const open = posArray.filter(p => parseNum(p.netqty ?? p.netQuantity) !== 0);

    if (open.length === 0) { res.json({ success: true, positions: [] }); return; }

    const tokenMap: Record<string, string> = {};
    for (const p of open) {
      const token = String(p.symboltoken ?? p.symbolToken ?? "");
      if (token) tokenMap[token] = token;
    }
    const tokens = Object.keys(tokenMap);

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
      } catch {}
    }

    const positions = open.map(p => {
      const token = String(p.symboltoken ?? p.symbolToken ?? "");
      const netqty = parseNum(p.netqty ?? p.netQuantity);
      const avgPrice = parseNum(p.netprice ?? p.avgnetprice ?? p.avgPrice);
      const ltp = ltpMap[token] ?? parseNum(p.ltp);
      const side = netqty > 0 ? "BUY" : "SELL";
      const unrealisedPnl = side === "BUY"
        ? (ltp - avgPrice) * Math.abs(netqty)
        : (avgPrice - ltp) * Math.abs(netqty);
      return {
        symbol: String(p.tradingsymbol ?? p.tradingSymbol ?? "").replace("-EQ", ""),
        tradingSymbol: String(p.tradingsymbol ?? p.tradingSymbol ?? ""),
        symbolToken: token,
        exchange: String(p.exchange ?? "NSE"),
        productType: String(p.producttype ?? p.productType ?? "INTRADAY"),
        side, netQty: netqty, avgPrice, ltp, unrealisedPnl,
        pnlPct: avgPrice > 0 ? (unrealisedPnl / (avgPrice * Math.abs(netqty))) * 100 : 0,
        dayChange: parseNum(p.daychange ?? p.dayChange),
      };
    });

    res.json({ success: true, positions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Live positions fetch failed";
    res.status(500).json({ error: msg });
  }
});

// ─── Legacy adapter-based routes (kept for compatibility) ─────────────────────
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

export default router;
