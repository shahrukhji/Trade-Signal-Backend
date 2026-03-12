import { Router } from "express";
import { getPaperPortfolio, placePaperOrder, cancelPaperOrder } from "../lib/paper-trading.js";

const router = Router();

router.get("/portfolio", (_req, res) => {
  const portfolio = getPaperPortfolio();
  res.json({ success: true, data: portfolio });
});

router.post("/order", (req, res) => {
  try {
    const { symbol, symboltoken, transactiontype, ordertype, quantity, price } = req.body;
    const order = placePaperOrder({
      symbol,
      symboltoken,
      transactiontype,
      ordertype,
      quantity: Number(quantity),
      price: Number(price),
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

export default router;
