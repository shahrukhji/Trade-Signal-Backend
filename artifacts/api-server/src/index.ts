import app from "./app.js";
import { login } from "./lib/angelone.js";
import { connectWebSocket } from "./lib/websocket-stream.js";
import { getMarketStatus } from "./lib/market-hours.js";
import cron from "node-cron";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startup() {
  console.log("[TradeSignal Pro] Starting up...");

  const required = ["ANGELONE_API_KEY", "ANGELONE_CLIENT_CODE", "ANGELONE_PIN", "ANGELONE_TOTP_SECRET", "SESSION_SECRET"];
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`[Startup] Missing required environment variables: ${missing.join(", ")}`);
    process.exit(1);
  }

  try {
    await login();
    console.log("[AngelOne] Connected successfully");
    connectWebSocket();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AngelOne] Connection failed: ${msg}`);
    console.warn("[AngelOne] Server will start anyway. Login via POST /api/auth/login");
  }

  cron.schedule("* 9-15 * * 1-5", () => {
    const status = getMarketStatus();
    console.log(`[Market] Status: ${status.session} — ${status.nextEvent}`);
  });

  app.listen(port, () => {
    console.log(`[TradeSignal Pro] Server listening on port ${port}`);
    console.log(`[TradeSignal Pro] Routes: /api/auth, /api/market, /api/orders, /api/portfolio, /api/signals, /api/scanner, /api/gtt, /api/symbols, /api/live, /api/ai, /api/paper`);
  });
}

startup().catch(err => {
  console.error("[Startup] Fatal error:", err);
  process.exit(1);
});
