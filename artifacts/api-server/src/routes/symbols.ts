import { Router } from "express";
import * as angelone from "../lib/angelone.js";
import { NIFTY50 } from "../lib/constants.js";

const router = Router();

router.get("/search", async (req, res) => {
  try {
    const { q, exchange = "NSE" } = req.query as { q?: string; exchange?: string };
    if (!q) {
      res.status(400).json({ error: "q (query) parameter required" });
      return;
    }
    const data = await angelone.searchScrip(exchange, q);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Symbol search failed";
    res.status(500).json({ error: msg });
  }
});

router.get("/nifty50", (_req, res) => {
  res.json({ success: true, data: NIFTY50 });
});

export default router;
