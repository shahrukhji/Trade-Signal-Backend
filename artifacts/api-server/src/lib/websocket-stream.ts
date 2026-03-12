import WebSocket from "ws";
import type { Response } from "express";
import { getSession } from "./angelone.js";
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
      console.log("[WS] Connected to AngelOne SmartStream");
      reconnectDelay = 3000;
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

    ws.on("close", () => {
      console.log(`[WS] Disconnected. Reconnecting in ${reconnectDelay}ms...`);
      isConnecting = false;
      if (pingInterval) clearInterval(pingInterval);
      setTimeout(() => {
        reconnectDelay = Math.min(reconnectDelay * 2, 60000);
        connectWebSocket();
      }, reconnectDelay);
    });

    ws.on("error", (err) => {
      console.error("[WS] Error:", err.message);
      isConnecting = false;
      ws?.terminate();
    });
  } catch (err) {
    isConnecting = false;
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
  ws?.close();
  ws = null;
}
