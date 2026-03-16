import WebSocket from "ws";
import type { Response } from "express";
import { getSession, login } from "./angelone.js";
import { updateLTP } from "./paper-trading.js";

interface TickData {
  token: string;
  ltp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  percentChange?: number;
  timestamp?: number;
}

const sseClients: Set<Response> = new Set();
let ws: WebSocket | null = null;
let reconnectDelay = 3000;
let pingInterval: ReturnType<typeof setInterval> | null = null;
let retryResetTimer: ReturnType<typeof setTimeout> | null = null;
let isConnecting = false;
let retryCount = 0;
const MAX_RETRIES = 5;
const RETRY_RESET_MS = 5 * 60 * 1000; // Reset retry counter after 5 minutes
const subscribedTokens: Map<string, { exchangeType: number; tokens: string[] }[]> = new Map();

export function addSSEClient(res: Response): void {
  sseClients.add(res);
  res.on("close", () => sseClients.delete(res));
}

function broadcastTick(tick: TickData): void {
  const data = `data: ${JSON.stringify(tick)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
  if (tick.ltp && tick.token) {
    updateLTP(tick.token, tick.ltp);
  }
}

/**
 * Angel One SmartStream binary packet format (per official docs):
 *   Byte 0      : Subscription mode (1=LTP, 2=QUOTE, 3=SNAP_QUOTE)
 *   Byte 1      : Exchange type (1=NSE_CM, 2=NSE_FO, 3=BSE_CM, ...)
 *   Bytes 2–26  : Token (25 bytes ASCII, right-padded with spaces)
 *   Bytes 27–34 : Sequence number (Int64 LE)
 *   Bytes 35–42 : Exchange timestamp (Int64 LE, Unix ms)
 *   Bytes 43–50 : Last Traded Price (Int64 LE, in paisa → divide by 100)
 *   Bytes 51–58 : Last Traded Quantity (Int64 LE)  [mode 2+]
 *   Bytes 59–66 : Avg Trade Price (Int64 LE, paisa) [mode 2+]
 *   Bytes 67–74 : Volume (Int64 LE)                 [mode 2+]
 *   Bytes 75–82 : Total Buy Qty (Int64 LE)          [mode 3+]
 *   Bytes 83–90 : Total Sell Qty (Int64 LE)         [mode 3+]
 *   Bytes 91–98 : Open (Int64 LE, paisa)            [mode 2+]
 *   Bytes 99–106: High (Int64 LE, paisa)            [mode 2+]
 *   Bytes 107–114: Low (Int64 LE, paisa)            [mode 2+]
 *   Bytes 115–122: Close (Int64 LE, paisa)          [mode 2+]
 */
function parseBinaryTick(buf: Buffer): TickData | null {
  try {
    if (buf.length < 51) return null;

    const mode = buf.readUInt8(0);
    const token = buf.slice(2, 27).toString("ascii").trim();
    const ts = Number(buf.readBigInt64LE(35));
    const ltp = Number(buf.readBigInt64LE(43)) / 100;

    if (!token || ltp <= 0) return null;

    const tick: TickData = { token, ltp, timestamp: ts };

    if (mode >= 2 && buf.length >= 123) {
      tick.open  = Number(buf.readBigInt64LE(91))  / 100;
      tick.high  = Number(buf.readBigInt64LE(99))  / 100;
      tick.low   = Number(buf.readBigInt64LE(107)) / 100;
      tick.close = Number(buf.readBigInt64LE(115)) / 100;
      tick.volume = Number(buf.readBigInt64LE(67));
      if (tick.close && tick.close > 0) {
        tick.percentChange = ((ltp - tick.close) / tick.close) * 100;
      }
    }

    return tick;
  } catch {
    return null;
  }
}

function scheduleRetryReset(): void {
  if (retryResetTimer) clearTimeout(retryResetTimer);
  retryResetTimer = setTimeout(() => {
    if (retryCount >= MAX_RETRIES) {
      console.log("[WS] Resetting retry counter — attempting SmartStream reconnect.");
      retryCount = 0;
      reconnectDelay = 3000;
      connectWebSocket();
    }
  }, RETRY_RESET_MS);
}

export function connectWebSocket(): void {
  if (retryCount >= MAX_RETRIES) {
    console.log("[WS] Max retries reached — SmartStream unavailable. Using REST polling for market data.");
    scheduleRetryReset();
    return;
  }

  const session = getSession();
  if (!session?.feedToken || isConnecting) return;

  isConnecting = true;
  const url = "wss://smartapisocket.angelone.in/smart-stream";

  try {
    ws = new WebSocket(url, {
      headers: {
        Authorization: session.jwtToken,   // NO "Bearer" prefix — Angel One SmartStream spec
        "x-auth-token": session.feedToken,
        "api-key": process.env.ANGELONE_API_KEY!,
      },
    });

    ws.on("open", () => {
      console.log("[WS] Connected to AngelOne SmartStream ✓");
      reconnectDelay = 3000;
      retryCount = 0;
      isConnecting = false;
      if (retryResetTimer) clearTimeout(retryResetTimer);

      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ action: 0, params: {} })); // heartbeat
        }
      }, 30000);

      // Re-subscribe any queued tokens
      for (const tokenList of subscribedTokens.values()) {
        subscribeTokens(tokenList);
      }
    });

    ws.on("message", (data: Buffer | string) => {
      if (Buffer.isBuffer(data)) {
        const tick = parseBinaryTick(data);
        if (tick) broadcastTick(tick);
      } else {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.pong || msg.heartbeat) return;
          if (msg.token) broadcastTick(msg as TickData);
        } catch {}
      }
    });

    ws.on("close", (code) => {
      isConnecting = false;
      if (pingInterval) clearInterval(pingInterval);

      if (code === 1000) {
        console.log("[WS] Disconnected cleanly.");
        return;
      }

      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        console.log("[WS] SmartStream unavailable after max retries. Market data via REST only.");
        scheduleRetryReset();
        return;
      }

      console.log(`[WS] Disconnected (code=${code}). Retry ${retryCount}/${MAX_RETRIES} in ${reconnectDelay / 1000}s...`);
      setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 60000);
        connectWebSocket();
      }, reconnectDelay);
    });

    ws.on("error", async (err) => {
      isConnecting = false;
      ws?.terminate();

      if (err.message.includes("401") || err.message.includes("Unexpected server response")) {
        console.log("[WS] Auth rejected (401) — refreshing session and retrying...");
        try { await login(); } catch {}
        setTimeout(() => connectWebSocket(), 5000);
      } else {
        retryCount++;
        console.log(`[WS] Error: ${err.message}. Retry ${retryCount}/${MAX_RETRIES}.`);
        if (retryCount >= MAX_RETRIES) {
          console.log("[WS] SmartStream unavailable after max retries. Market data via REST only.");
          scheduleRetryReset();
        }
      }
    });
  } catch (err) {
    isConnecting = false;
    retryCount++;
    console.error("[WS] Failed to connect:", err);
  }
}

export function subscribeTokens(tokenList: { exchangeType: number; tokens: string[] }[]): void {
  const key = tokenList.map(t => `${t.exchangeType}:${t.tokens.join(",")}`).join("|");
  subscribedTokens.set(key, tokenList);

  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: 1,
      params: { mode: 3, tokenList },
    }));
  }
}

export function unsubscribeTokens(tokenList: { exchangeType: number; tokens: string[] }[]): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      action: 0,
      params: { mode: 3, tokenList },
    }));
  }
}

export function disconnectWebSocket(): void {
  if (pingInterval) clearInterval(pingInterval);
  if (retryResetTimer) clearTimeout(retryResetTimer);
  ws?.close(1000);
  ws = null;
  retryCount = 0;
}

export function resetRetryCount(): void {
  retryCount = 0;
  reconnectDelay = 3000;
}
