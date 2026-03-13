import { Router } from "express";
import {
  getPaperPortfolio,
  getPaperStats,
  getClosedTrades,
  placePaperOrder,
  cancelPaperOrder,
  closePosition,
  resetPaperAccount,
  updateLTP,
} from "../lib/paper-trading.js";
import * as angelone from "../lib/angelone.js";

const router = Router();

router.get("/portfolio", (_req, res) => {
  res.json({ success: true, data: getPaperPortfolio() });
});

router.get("/stats", (_req, res) => {
  res.json({ success: true, data: getPaperStats() });
});

router.get("/trades", (req, res) => {
  const period = (req.query.period as string) || "today";
  const valid = ["today", "yesterday", "3days", "7days", "all"];
  if (!valid.includes(period)) {
    res.status(400).json({ error: "Invalid period. Use: today|yesterday|3days|7days|all" });
    return;
  }
  const trades = getClosedTrades(period as "today" | "yesterday" | "3days" | "7days" | "all");
  res.json({ success: true, data: trades, period });
});

router.post("/order", async (req, res) => {
  try {
    const { symbol, symboltoken, transactiontype, ordertype, quantity, price } = req.body as {
      symbol: string;
      symboltoken: string;
      transactiontype: "BUY" | "SELL";
      ordertype: "MARKET" | "LIMIT" | "STOPLOSS_LIMIT" | "STOPLOSS_MARKET";
      quantity: number;
      price?: number;
    };

    if (!symbol || !symboltoken || !transactiontype || !quantity) {
      res.status(400).json({ error: "symbol, symboltoken, transactiontype, quantity are required" });
      return;
    }

    // Refresh LTP before placing market orders
    if (ordertype === "MARKET" || !price) {
      try {
        const quote = await angelone.getLiveQuote("LTP", { NSE: [symboltoken] }) as { data?: { fetched?: { ltp?: number }[] } };
        const ltp = quote?.data?.fetched?.[0]?.ltp;
        if (ltp) updateLTP(symbol, ltp);
      } catch (_e) {
        // Non-fatal — use provided price
      }
    }

    const order = placePaperOrder({
      symbol,
      symboltoken,
      transactiontype,
      ordertype: ordertype || "MARKET",
      quantity: Number(quantity),
      price: price ? Number(price) : undefined,
    });

    res.json({ success: true, order });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Paper order failed";
    res.status(500).json({ error: msg });
  }
});

router.post("/cancel/:id", (req, res) => {
  const cancelled = cancelPaperOrder(req.params.id);
  res.json({ success: cancelled, message: cancelled ? "Cancelled" : "Order not found or not cancellable" });
});

router.post("/close/:symbol", async (req, res) => {
  try {
    const { symbol } = req.params;
    const { symboltoken } = req.body as { symboltoken?: string };

    // Refresh LTP
    if (symboltoken) {
      try {
        const quote = await angelone.getLiveQuote("LTP", { NSE: [symboltoken] }) as { data?: { fetched?: { ltp?: number }[] } };
        const ltp = quote?.data?.fetched?.[0]?.ltp;
        if (ltp) updateLTP(symbol, ltp);
      } catch (_e) {}
    }

    const order = closePosition(symbol);
    if (!order) {
      res.status(404).json({ error: `No open position for ${symbol}` });
      return;
    }
    res.json({ success: true, order });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Close position failed";
    res.status(500).json({ error: msg });
  }
});

router.post("/reset", (_req, res) => {
  resetPaperAccount();
  res.json({ success: true, message: "Paper account reset to ₹10,00,000" });
});

router.post("/ltp", (req, res) => {
  const { symbol, price } = req.body as { symbol: string; price: number };
  if (!symbol || !price) {
    res.status(400).json({ error: "symbol and price required" });
    return;
  }
  updateLTP(symbol, Number(price));
  res.json({ success: true });
});

export default router;
