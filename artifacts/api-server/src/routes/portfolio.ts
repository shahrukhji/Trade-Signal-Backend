import { Router } from "express";
import { getBrokerFromHeader, getAdapter } from "../lib/broker-adapter.js";

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

export default router;
