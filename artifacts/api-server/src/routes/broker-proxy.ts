// ─── Angel One SmartAPI Proxy ────────────────────────────────────────────────
// Server-side proxy: avoids CORS, auto-generates TOTP, fetches profile after login.
import { Router, type Request, type Response } from "express";
import { createHmac } from "crypto";

// ─── RFC 6238 TOTP (no external deps) ────────────────────────────────────────
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

// ─── Angel One profile fetch (after login) ────────────────────────────────────
async function fetchAngelProfile(jwt: string, apiKey: string): Promise<any> {
  try {
    const r = await fetch(
      "https://apiconnect.angelone.in/rest/secure/angelbroking/user/v1/getProfile",
      {
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "X-UserType": "USER",
          "X-SourceID": "WEB",
          "X-ClientLocalIP": "127.0.0.1",
          "X-ClientPublicIP": "1.2.3.4",
          "X-MACAddress": "00:00:00:00:00:00",
          "X-PrivateKey": apiKey,
          "Authorization": `Bearer ${jwt}`,
        },
        signal: AbortSignal.timeout(10000),
      }
    );
    const p: any = await r.json();
    return p.status ? p.data : null;
  } catch {
    return null;
  }
}

const router = Router();
const ANGEL_BASE = "https://apiconnect.angelone.in";
const LOGIN_PATH = "/rest/auth/angelbroking/user/v1/loginByPassword";

// ─── Config Status ─────────────────────────────────────────────────────────────
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

// ─── Auto-Login ────────────────────────────────────────────────────────────────
// Accepts optional body credentials (from mobile app) OR falls back to env vars.
// Body params: { clientCode?, password?, apiKey?, totpSecret? }
router.post("/auto-login", async (req: Request, res: Response) => {
  const body = req.body || {};
  const clientCode = body.clientCode || process.env.ANGELONE_CLIENT_CODE;
  const pin = body.password || process.env.ANGELONE_PIN;
  const apiKey = body.apiKey || process.env.ANGELONE_API_KEY;
  const totpSecret = body.totpSecret || process.env.ANGELONE_TOTP_SECRET;

  if (!clientCode || !pin || !apiKey || !totpSecret) {
    return res.status(400).json({
      status: false,
      message:
        "Missing credentials. Provide clientCode/password/apiKey/totpSecret in request body or set them in Replit Secrets.",
    });
  }

  try {
    const totp = generateTOTP(totpSecret);
    const loginRes = await fetch(`${ANGEL_BASE}${LOGIN_PATH}`, {
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
    const data: any = await loginRes.json();

    if (data.status && data.data) {
      // Fetch the real profile to get trader name, email, phone, etc.
      const profile = await fetchAngelProfile(data.data.jwtToken, apiKey);

      data.data._clientCode = clientCode;
      data.data._apiKey = apiKey;
      // Embed profile fields so the frontend can display them without an extra call
      if (profile) {
        data.data._name = profile.name || profile.clientname || '';
        data.data._email = profile.email || '';
        data.data._phone = profile.mobileno || '';
        data.data._exchanges = profile.exchanges || ['NSE', 'BSE'];
        data.data._products = profile.products || ['DELIVERY', 'INTRADAY'];
      }
    }

    return res.status(loginRes.status).json(data);
  } catch (err: any) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    return res.status(503).json({
      status: false,
      message: isTimeout ? "Request timed out." : `Auto-login error: ${err?.message}`,
    });
  }
});

// ─── Header Builder ────────────────────────────────────────────────────────────
// Falls back to env var API key so authenticated calls work even without user-entered key.
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
  // Use request header, or fall back to configured env var
  const privateKey =
    (req.headers["x-privatekey"] as string) ||
    process.env.ANGELONE_API_KEY ||
    "";
  const authorization = req.headers["authorization"] as string;
  if (privateKey) headers["X-PrivateKey"] = privateKey;
  if (authorization) headers["Authorization"] = authorization;
  return headers;
}

// ─── Generic Passthrough Proxy ─────────────────────────────────────────────────
router.use(async (req: Request, res: Response) => {
  const targetUrl = `${ANGEL_BASE}${req.path}`;

  try {
    let body = req.body;

    // Auto-inject TOTP for login requests when TOTP_SECRET is configured
    if (req.method === "POST" && req.path === LOGIN_PATH) {
      const totpSecret = process.env.ANGELONE_TOTP_SECRET;
      if (totpSecret) {
        body = { ...body, totp: generateTOTP(totpSecret) };
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
