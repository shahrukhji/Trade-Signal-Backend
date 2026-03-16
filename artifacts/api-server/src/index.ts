import app from "./app.js";
import { login } from "./lib/angelone.js";
import { connectWebSocket, resetRetryCount } from "./lib/websocket-stream.js";
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

function isMarketHours(): boolean {
  // IST = UTC + 5:30
  const now = new Date();
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  const day = ist.getUTCDay(); // 0=Sun, 6=Sat
  const mins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return day >= 1 && day <= 5 && mins >= 555 && mins <= 930; // 9:15–15:30
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

    // Only connect SmartStream WebSocket during market hours.
    // SmartStream requires "WebSocket" permission enabled at smartapi.angelone.in → My API → Edit.
    // Without that permission, WS returns 401. REST polling handles live data as fallback.
    if (isMarketHours()) {
      console.log("[WS] Market is open — attempting SmartStream connection...");
      connectWebSocket();
    } else {
      console.log("[WS] Market closed — SmartStream skipped. REST polling active for candles/quotes.");
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[AngelOne] Connection failed: ${msg}`);
    console.warn("[AngelOne] Server will start anyway. Login via POST /api/auth/login");
  }

  // Market-hour log every minute (9–15 IST, weekdays)
  cron.schedule("* 9-15 * * 1-5", () => {
    const status = getMarketStatus();
    console.log(`[Market] Status: ${status.session} — ${status.nextEvent}`);
  });

  // At market open (9:14 IST), reset WS and try SmartStream
  cron.schedule("14 9 * * 1-5", async () => {
    console.log("[WS] Market opening — refreshing session and connecting SmartStream...");
    try {
      await login();
      resetRetryCount();
      connectWebSocket();
    } catch (err) {
      console.error("[WS] Pre-market session refresh failed:", err instanceof Error ? err.message : err);
    }
  });

  // At market close (15:31 IST), log summary
  cron.schedule("31 15 * * 1-5", () => {
    console.log("[Market] Market closed at 15:30 IST. REST data still available for after-hours queries.");
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
