// ─── Angel One SmartAPI Proxy ────────────────────────────────────────────────
// Forwards browser requests server-side so Angel One CORS restrictions don't apply.
// All paths under /api/broker-proxy/* are forwarded to https://apiconnect.angelone.in/*
import { Router, type Request, type Response } from "express";

const router = Router();
const ANGEL_BASE = "https://apiconnect.angelone.in";

function buildForwardHeaders(req: Request): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": "127.0.0.1",
    "X-ClientPublicIP": "1.2.3.4",
    "X-MACAddress": "00:00:00:00:00:00",
  };

  // Forward auth headers from the browser request
  const privateKey = req.headers["x-privatekey"] as string;
  const authorization = req.headers["authorization"] as string;
  if (privateKey) headers["X-PrivateKey"] = privateKey;
  if (authorization) headers["Authorization"] = authorization;

  return headers;
}

// Generic catch-all proxy — forwards ANY path to Angel One
router.use(async (req: Request, res: Response) => {
  const targetUrl = `${ANGEL_BASE}${req.path}`;

  try {
    const fetchOptions: RequestInit = {
      method: req.method,
      headers: buildForwardHeaders(req),
      signal: AbortSignal.timeout(15000),
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const upstream = await fetch(targetUrl, fetchOptions);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    res.status(503).json({
      status: false,
      message: isTimeout
        ? "Request to Angel One timed out. Check your internet connection."
        : `Proxy error: ${err?.message || "Unknown error"}`,
    });
  }
});

export default router;
