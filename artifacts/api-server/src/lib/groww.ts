import axios, { AxiosInstance } from "axios";
import { GROWW_BASE_URL } from "./constants.js";

export interface GrowwSession {
  accessToken: string;
  expiresAt: number;
}

let session: GrowwSession | null = null;

function createAxios(token: string): AxiosInstance {
  return axios.create({
    baseURL: GROWW_BASE_URL,
    timeout: 15000,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
}

export async function loginWithToken(accessToken: string): Promise<GrowwSession> {
  session = {
    accessToken,
    expiresAt: Date.now() + 8 * 60 * 60 * 1000,
  };
  return session;
}

export function getSession(): GrowwSession | null {
  return session;
}

function ensureSession(): GrowwSession {
  if (!session) throw new Error("Groww: not authenticated. Please login first.");
  return session;
}

export async function getProfile(): Promise<unknown> {
  const s = ensureSession();
  const client = createAxios(s.accessToken);
  const res = await client.get("/v1/user/profile");
  return res.data;
}

export async function getHoldings(): Promise<unknown> {
  const s = ensureSession();
  const client = createAxios(s.accessToken);
  const res = await client.get("/v1/holdings");
  return res.data;
}

export async function getPositions(): Promise<unknown> {
  const s = ensureSession();
  const client = createAxios(s.accessToken);
  const res = await client.get("/v1/positions");
  return res.data;
}

export async function getFunds(): Promise<unknown> {
  const s = ensureSession();
  const client = createAxios(s.accessToken);
  const res = await client.get("/v1/funds");
  return res.data;
}

export async function placeOrder(params: Record<string, unknown>): Promise<unknown> {
  const s = ensureSession();
  const client = createAxios(s.accessToken);
  const res = await client.post("/v1/orders/place", params);
  return res.data;
}

export async function cancelOrder(orderId: string): Promise<unknown> {
  const s = ensureSession();
  const client = createAxios(s.accessToken);
  const res = await client.delete(`/v1/orders/${orderId}`);
  return res.data;
}

export async function getOrders(): Promise<unknown> {
  const s = ensureSession();
  const client = createAxios(s.accessToken);
  const res = await client.get("/v1/orders");
  return res.data;
}

export async function getLTP(exchange: string, symbol: string): Promise<unknown> {
  const s = ensureSession();
  const client = createAxios(s.accessToken);
  const res = await client.get(`/market/quote/${exchange}/${symbol}`);
  return res.data;
}
