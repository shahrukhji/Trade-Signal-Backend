import { Router } from "express";
import { getBrokerFromHeader, getAdapter } from "../lib/broker-adapter.js";
import * as angelone from "../lib/angelone.js";
import { placePaperOrder, cancelPaperOrder, isPaperMode } from "../lib/paper-trading.js";

const router = Router();

router.post("/place", async (req, res) => {
  try {
    const broker = getBrokerFromHeader(req.headers["x-broker"] as string);
    // forceLive=true bypasses paper mode for intentional live orders
    const forceLive = req.body.forceLive === true || req.headers["x-force-live"] === "true";

    if (isPaperMode() && !forceLive) {
      const { tradingsymbol, symboltoken, transactiontype, ordertype, quantity, price } = req.body;
      const order = placePaperOrder({
        symbol: tradingsymbol,
        symboltoken,
        transactiontype,
        ordertype,
        quantity: Number(quantity),
        price: Number(price),
      });
      res.json({ success: true, paper: true, order });
      return;
    }

    // Remove internal flag before sending to broker
    const { forceLive: _fl, ...orderBody } = req.body;
    const adapter = getAdapter(broker);
    const result = await adapter.placeOrder(orderBody);
    res.json({ success: true, live: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Order placement failed";
    res.status(500).json({ error: msg });
  }
});

/**
 * POST /api/orders/exit-position
 * Places a closing market order for an open Angel One position.
 * Always executes LIVE (bypasses paper mode) since it's closing a real position.
 */
router.post("/exit-position", async (req, res) => {
  try {
    const {
      tradingSymbol, symbolToken, exchange = "NSE",
      netQty, side, productType = "INTRADAY",
    } = req.body as {
      tradingSymbol: string; symbolToken: string; exchange?: string;
      netQty: number; side: "BUY" | "SELL"; productType?: string;
    };

    if (!tradingSymbol || !symbolToken || !netQty || !side) {
      res.status(400).json({ error: "tradingSymbol, symbolToken, netQty and side are required" });
      return;
    }

    // To exit: BUY position → SELL; SELL position → BUY
    const exitSide = side === "BUY" ? "SELL" : "BUY";
    const qty = Math.abs(netQty);

    const orderPayload = {
      variety: "NORMAL",
      tradingsymbol: tradingSymbol,
      symboltoken: symbolToken,
      transactiontype: exitSide,
      exchange,
      ordertype: "MARKET",
      producttype: productType,
      duration: "DAY",
      price: "0",
      squareoff: "0",
      stoploss: "0",
      quantity: String(qty),
    };

    const result = await angelone.placeOrder(orderPayload);
    console.log(`[EXIT] ${exitSide} ${qty} ${tradingSymbol} — response:`, JSON.stringify(result));
    res.json({ success: true, exitSide, qty, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Exit position failed";
    res.status(500).json({ error: msg });
  }
});

router.post("/modify", async (req, res) => {
  try {
    const result = await angelone.modifyOrder(req.body);
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Modify order failed";
    res.status(500).json({ error: msg });
  }
});

router.post("/cancel", async (req, res) => {
  try {
    if (isPaperMode()) {
      const { orderid } = req.body;
      const cancelled = cancelPaperOrder(orderid);
      res.json({ success: cancelled });
      return;
    }
    const { variety, orderid } = req.body;
    const result = await angelone.cancelOrder(variety, orderid);
    res.json({ success: true, data: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Cancel order failed";
    res.status(500).json({ error: msg });
  }
});

router.get("/book", async (_req, res) => {
  try {
    const data = await angelone.getOrderBook();
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Order book fetch failed";
    res.status(500).json({ error: msg });
  }
});

router.get("/tradebook", async (_req, res) => {
  try {
    const data = await angelone.getTradeBook();
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Trade book fetch failed";
    res.status(500).json({ error: msg });
  }
});

router.get("/status/:uniqueorderid", async (req, res) => {
  try {
    const data = await angelone.getOrderStatus(req.params.uniqueorderid);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Order status fetch failed";
    res.status(500).json({ error: msg });
  }
});

router.post("/convert-position", async (req, res) => {
  try {
    const data = await angelone.convertPosition(req.body);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Convert position failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
