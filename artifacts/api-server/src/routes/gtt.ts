import { Router } from "express";
import * as angelone from "../lib/angelone.js";

const router = Router();

router.post("/create", async (req, res) => {
  try {
    const data = await angelone.createGTT(req.body);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "GTT create failed";
    res.status(500).json({ error: msg });
  }
});

router.post("/modify", async (req, res) => {
  try {
    const data = await angelone.modifyGTT(req.body);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "GTT modify failed";
    res.status(500).json({ error: msg });
  }
});

router.post("/cancel", async (req, res) => {
  try {
    const { id, symboltoken, exchange } = req.body;
    const data = await angelone.cancelGTT({ id, symboltoken, exchange });
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "GTT cancel failed";
    res.status(500).json({ error: msg });
  }
});

router.post("/list", async (req, res) => {
  try {
    const { status = ["NEW", "FORALL"], page = 1, count = 10 } = req.body;
    const data = await angelone.listGTT({ status, page, count });
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "GTT list failed";
    res.status(500).json({ error: msg });
  }
});

router.get("/details/:id", async (req, res) => {
  try {
    const data = await angelone.getGTTDetails(req.params.id);
    res.json({ success: true, data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "GTT details fetch failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
