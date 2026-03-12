// ─── Angel One SmartAPI Proxy ────────────────────────────────────────────────
// Forwards browser requests server-side so Angel One CORS restrictions don't apply.
// All paths under /api/broker-proxy/* are forwarded to https://apiconnect.angelone.in/*
// Automatically generates TOTP from ANGELONE_TOTP_SECRET env var when available.
import { Router, type Request, type Response } from "express";
import { createHmac } from "crypto";

// ─── RFC 6238 TOTP Implementation (no external deps) ─────────────────────────
function base32Decode(encoded: string): Buffer {
  const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = 0, value = 0;
  const output: number[] = [];
  for (const ch of encoded.replace(/=+$/, "").toUpperCase()) {
    const idx = CHARS.indexOf(ch);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) { output.push((value >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return Buffer.from(output);
}

function generateTOTP(secret: string, step = 30): string {
  const key = base32Decode(secret);
  const counter = Math.floor(Date.now() / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);
  const hmac = createHmac("sha1", key).update(buf).digest();
  const offset = hmac[19] & 0xf;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

const router = Router();
const ANGEL_BASE = "https://apiconnect.angelone.in";
const LOGIN_PATH = "/rest/auth/angelbroking/user/v1/loginByPassword";

// ─── Config Status ────────────────────────────────────────────────────────────
// Tells the frontend which secrets are pre-configured so it can show Quick Connect
router.get("/config-status", (_req: Request, res: Response) => {
  res.json({
    hasClientCode: !!process.env.ANGELONE_CLIENT_CODE,
    hasPin: !!process.env.ANGELONE_PIN,
    hasApiKey: !!process.env.ANGELONE_API_KEY,
    hasTotpSecret: !!process.env.ANGELONE_TOTP_SECRET,
    allConfigured:
      !!process.env.ANGELONE_CLIENT_CODE &&
      !!process.env.ANGELONE_PIN &&
      !!process.env.ANGELONE_API_KEY &&
      !!process.env.ANGELONE_TOTP_SECRET,
  });
});

// ─── Auto-Login ───────────────────────────────────────────────────────────────
// Uses all pre-configured env var credentials to log in without any user input
router.post("/auto-login", async (_req: Request, res: Response) => {
  const clientCode = process.env.ANGELONE_CLIENT_CODE;
  const pin = process.env.ANGELONE_PIN;
  const apiKey = process.env.ANGELONE_API_KEY;
  const totpSecret = process.env.ANGELONE_TOTP_SECRET;

  if (!clientCode || !pin || !apiKey || !totpSecret) {
    return res.status(400).json({
      status: false,
      message: "Missing required env vars: ANGELONE_CLIENT_CODE, ANGELONE_PIN, ANGELONE_API_KEY, ANGELONE_TOTP_SECRET",
    });
  }

  try {
    const totp = generateTOTP(totpSecret);
    const upstream = await fetch(`${ANGEL_BASE}${LOGIN_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-UserType": "USER",
        "X-SourceID": "WEB",
        "X-ClientLocalIP": "127.0.0.1",
        "X-ClientPublicIP": "1.2.3.4",
        "X-MACAddress": "00:00:00:00:00:00",
        "X-PrivateKey": apiKey,
      },
      body: JSON.stringify({ clientcode: clientCode, password: pin, totp }),
      signal: AbortSignal.timeout(15000),
    });
    const data: any = await upstream.json();
    // Attach the pre-configured client code so the frontend can build a proper session
    if (data.status && data.data) {
      data.data._clientCode = clientCode;
      data.data._apiKey = apiKey;
    }
    return res.status(upstream.status).json(data);
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    return res.status(503).json({
      status: false,
      message: isTimeout ? "Request timed out" : `Auto-login error: ${err?.message}`,
    });
  }
});

// ─── Header Builder ───────────────────────────────────────────────────────────
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
  const privateKey = req.headers["x-privatekey"] as string;
  const authorization = req.headers["authorization"] as string;
  if (privateKey) headers["X-PrivateKey"] = privateKey;
  if (authorization) headers["Authorization"] = authorization;
  return headers;
}

// ─── Generic Passthrough Proxy ────────────────────────────────────────────────
router.use(async (req: Request, res: Response) => {
  const targetUrl = `${ANGEL_BASE}${req.path}`;

  try {
    let body = req.body;

    // Auto-inject TOTP for login requests if TOTP_SECRET is configured in env
    if (req.method === "POST" && req.path === LOGIN_PATH) {
      const totpSecret = process.env.ANGELONE_TOTP_SECRET;
      if (totpSecret) {
        const generatedTotp = generateTOTP(totpSecret);
        // Always use env-generated TOTP — more reliable than user-entered code
        body = { ...body, totp: generatedTotp };
      }
    }

    const fetchOptions: RequestInit = {
      method: req.method,
      headers: buildForwardHeaders(req),
      signal: AbortSignal.timeout(15000),
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      fetchOptions.body = JSON.stringify(body);
    }

    const upstream = await fetch(targetUrl, fetchOptions);
    const data = await upstream.json();
    res.status(upstream.status).json(data);
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    res.status(503).json({
      status: false,
      message: isTimeout
        ? "Request to Angel One timed out."
        : `Proxy error: ${err?.message || "Unknown error"}`,
    });
  }
});

export default router;
