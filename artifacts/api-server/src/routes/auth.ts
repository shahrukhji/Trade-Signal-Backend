import { Router } from "express";
import * as angelone from "../lib/angelone.js";
import * as groww from "../lib/groww.js";
import { getBrokerFromHeader } from "../lib/broker-adapter.js";

const router = Router();

router.post("/login", async (req, res) => {
  try {
    const broker = getBrokerFromHeader(req.headers["x-broker"] as string);

    if (broker === "ANGELONE") {
      const session = await angelone.login();
      res.json({
        success: true,
        broker: "ANGELONE",
        connected: true,
        expiresAt: session.expiresAt,
        feedToken: session.feedToken,
      });
    } else {
      const { accessToken } = req.body;
      if (!accessToken) {
        res.status(400).json({ success: false, error: "accessToken required for Groww" });
        return;
      }
      await groww.loginWithToken(accessToken);
      res.json({ success: true, broker: "GROWW", connected: true });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Login failed";
    res.status(500).json({ success: false, error: msg });
  }
});

router.get("/status", async (req, res) => {
  try {
    const broker = getBrokerFromHeader(req.headers["x-broker"] as string);

    if (broker === "ANGELONE") {
      const session = angelone.getSession();
      if (!session) {
        res.json({ connected: false, broker: "ANGELONE" });
        return;
      }
      let profile = null;
      try { profile = await angelone.getProfile(); } catch {}
      res.json({
        connected: true,
        broker: "ANGELONE",
        expiry: new Date(session.expiresAt).toISOString(),
        profile,
      });
    } else {
      const session = groww.getSession();
      if (!session) {
        res.json({ connected: false, broker: "GROWW" });
        return;
      }
      let profile = null;
      try { profile = await groww.getProfile(); } catch {}
      res.json({ connected: true, broker: "GROWW", profile });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Status check failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
