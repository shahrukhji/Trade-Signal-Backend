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
let isConnecting = false;
let retryCount = 0;
const MAX_RETRIES = 5;
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

function parseBinaryTick(buf: Buffer): TickData | null {
  try {
    if (buf.length < 4) return null;
    const token = buf.readUInt32BE(0).toString();
    if (buf.length >= 8) {
      const ltp = buf.readUInt32BE(4) / 100;
      return { token, ltp };
    }
    return null;
  } catch {
    return null;
  }
}

export function connectWebSocket(): void {
  if (retryCount >= MAX_RETRIES) {
    console.log("[WS] Max retries reached — SmartStream unavailable. Using REST polling for market data.");
    return;
  }

  const session = getSession();
  if (!session?.feedToken || isConnecting) return;

  isConnecting = true;
  const url = "wss://smartapisocket.angelone.in/smart-stream";

  try {
    ws = new WebSocket(url, {
      headers: {
        Authorization: `Bearer ${session.jwtToken}`,
        "x-auth-token": session.feedToken,
        "api-key": process.env.ANGELONE_API_KEY!,
      },
    });

    ws.on("open", () => {
      console.log("[WS] Connected to AngelOne SmartStream ✓");
      reconnectDelay = 3000;
      retryCount = 0;
      isConnecting = false;

      if (pingInterval) clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ ping: "ping" }));
        }
      }, 30000);

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

      if (err.message.includes("401")) {
        console.log("[WS] Auth rejected (401) — refreshing session and retrying...");
        try { await login(); } catch {}
        setTimeout(() => connectWebSocket(), 5000);
      } else {
        retryCount++;
        if (retryCount < MAX_RETRIES) {
          console.log(`[WS] Error: ${err.message}. Retry ${retryCount}/${MAX_RETRIES}.`);
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
    const payload = {
      action: 1,
      params: {
        mode: 3,
        tokenList,
      },
    };
    ws.send(JSON.stringify(payload));
  }
}

export function unsubscribeTokens(tokenList: { exchangeType: number; tokens: string[] }[]): void {
  if (ws?.readyState === WebSocket.OPEN) {
    const payload = {
      action: 0,
      params: {
        mode: 3,
        tokenList,
      },
    };
    ws.send(JSON.stringify(payload));
  }
}

export function disconnectWebSocket(): void {
  if (pingInterval) clearInterval(pingInterval);
  ws?.close(1000);
  ws = null;
  retryCount = 0;
}

export function resetRetryCount(): void {
  retryCount = 0;
}
