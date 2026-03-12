import { Router } from "express";
import { addSSEClient, subscribeTokens } from "../lib/websocket-stream.js";

const router = Router();

router.get("/stream", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  addSSEClient(res);

  res.write(`data: ${JSON.stringify({ type: "connected", message: "SSE stream active" })}\n\n`);
});

router.post("/subscribe", (req, res) => {
  try {
    const { tokens, exchangeType = 1 } = req.body as {
      tokens: string[];
      exchangeType?: number;
    };

    if (!tokens || !Array.isArray(tokens)) {
      res.status(400).json({ error: "tokens array required" });
      return;
    }

    subscribeTokens([{ exchangeType, tokens }]);
    res.json({ success: true, subscribed: tokens.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Subscribe failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
