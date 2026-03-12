import axios, { AxiosInstance } from "axios";
import speakeasy from "speakeasy";
import Bottleneck from "bottleneck";
import { ANGELONE_BASE_URL, RATE_LIMITS } from "./constants.js";

export interface AngelOneSession {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
  expiresAt: number;
}

interface AngelOneResponse<T = unknown> {
  status: boolean;
  message: string;
  errorcode: string;
  data: T;
}

const orderLimiter = new Bottleneck({ minTime: RATE_LIMITS.orders.minTime });
const historicalLimiter = new Bottleneck({ minTime: RATE_LIMITS.historical.minTime });
const quoteLimiter = new Bottleneck({ minTime: RATE_LIMITS.quote.minTime });

let session: AngelOneSession | null = null;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function getClientIPs() {
  return {
    local: "127.0.0.1",
    public: "1.2.3.4",
  };
}

function buildHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const apiKey = process.env.ANGELONE_API_KEY!;
  const ips = getClientIPs();
  const base: Record<string, string> = {
    "Content-Type": "application/json",
    "X-UserType": "USER",
    "X-SourceID": "WEB",
    "X-ClientLocalIP": ips.local,
    "X-ClientPublicIP": ips.public,
    "X-MACAddress": "00:00:00:00:00:00",
    "X-PrivateKey": apiKey,
    Accept: "application/json",
  };
  if (session?.jwtToken) {
    base["Authorization"] = `Bearer ${session.jwtToken}`;
  }
  return { ...base, ...extra };
}

function createAxios(): AxiosInstance {
  return axios.create({ baseURL: ANGELONE_BASE_URL, timeout: 15000 });
}

export async function login(): Promise<AngelOneSession> {
  const clientcode = process.env.ANGELONE_CLIENT_CODE!;
  const password = process.env.ANGELONE_PIN!;
  const totpSecret = process.env.ANGELONE_TOTP_SECRET!;
  const totp = speakeasy.totp({ secret: totpSecret, encoding: "base32" });

  const client = createAxios();
  const res = await client.post<AngelOneResponse<AngelOneSession>>(
    "/rest/auth/angelbroking/user/v1/loginByPassword",
    { clientcode, password, totp },
    { headers: buildHeaders() }
  );

  if (!res.data.status) {
    throw new Error(`AngelOne login failed: ${res.data.message} (${res.data.errorcode})`);
  }

  const data = res.data.data;
  session = {
    jwtToken: data.jwtToken,
    refreshToken: data.refreshToken,
    feedToken: data.feedToken,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
  };

  scheduleRefresh();
  console.log("[AngelOne] Login successful");
  return session;
}

async function refreshTokens(): Promise<void> {
  if (!session?.refreshToken) return;
  try {
    const client = createAxios();
    const res = await client.post<AngelOneResponse<{ jwtToken: string; refreshToken: string; feedToken: string }>>(
      "/rest/auth/angelbroking/jwt/v1/generateTokens",
      { refreshToken: session.refreshToken },
      { headers: buildHeaders() }
    );
    if (res.data.status) {
      session = {
        ...session,
        jwtToken: res.data.data.jwtToken,
        refreshToken: res.data.data.refreshToken,
        feedToken: res.data.data.feedToken,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      };
      scheduleRefresh();
      console.log("[AngelOne] Token refreshed");
    }
  } catch (err) {
    console.error("[AngelOne] Token refresh failed, re-logging in...");
    try { await login(); } catch {}
  }
}

function scheduleRefresh(): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  const msUntilRefresh = (session!.expiresAt - Date.now()) - 30 * 60 * 1000;
  const delay = Math.max(msUntilRefresh, 5 * 60 * 1000);
  refreshTimer = setTimeout(refreshTokens, delay);
}

export async function ensureSession(): Promise<AngelOneSession> {
  if (!session) {
    return await login();
  }
  return session;
}

export function getSession(): AngelOneSession | null {
  return session;
}

async function request<T>(
  method: "get" | "post",
  path: string,
  data?: unknown,
  limiter?: Bottleneck
): Promise<T> {
  await ensureSession();
  const client = createAxios();
  const headers = buildHeaders();

  const doRequest = async (): Promise<T> => {
    try {
      const res = method === "post"
        ? await client.post<AngelOneResponse<T>>(path, data, { headers })
        : await client.get<AngelOneResponse<T>>(path, { headers });

      if (!res.data.status) {
        const code = res.data.errorcode;
        if (code === "AB1010" || code === "AB1005") {
          await login();
          return doRequest();
        }
        throw new Error(`AngelOne API error: ${res.data.message} (${code})`);
      }
      return res.data.data;
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 429) {
        await new Promise(r => setTimeout(r, 60000));
        return doRequest();
      }
      throw err;
    }
  };

  if (limiter) {
    return limiter.schedule(doRequest);
  }
  return doRequest();
}

export async function getProfile(): Promise<unknown> {
  return request("get", "/rest/secure/angelbroking/user/v1/getProfile");
}

export async function getFunds(): Promise<unknown> {
  return request("get", "/rest/secure/angelbroking/user/v1/getRMS");
}

export async function placeOrder(params: Record<string, unknown>): Promise<unknown> {
  return orderLimiter.schedule(() =>
    request("post", "/rest/secure/angelbroking/order/v1/placeOrder", params)
  );
}

export async function modifyOrder(params: Record<string, unknown>): Promise<unknown> {
  return orderLimiter.schedule(() =>
    request("post", "/rest/secure/angelbroking/order/v1/modifyOrder", params)
  );
}

export async function cancelOrder(variety: string, orderid: string): Promise<unknown> {
  return orderLimiter.schedule(() =>
    request("post", "/rest/secure/angelbroking/order/v1/cancelOrder", { variety, orderid })
  );
}

export async function getOrderBook(): Promise<unknown> {
  return request("get", "/rest/secure/angelbroking/order/v1/getOrderBook");
}

export async function getTradeBook(): Promise<unknown> {
  return request("get", "/rest/secure/angelbroking/order/v1/getTradeBook");
}

export async function getOrderStatus(uniqueorderid: string): Promise<unknown> {
  return request("get", `/rest/secure/angelbroking/order/v1/details/${uniqueorderid}`);
}

export async function convertPosition(params: Record<string, unknown>): Promise<unknown> {
  return request("post", "/rest/secure/angelbroking/order/v1/convertPosition", params);
}

export async function getHoldings(): Promise<unknown> {
  return request("get", "/rest/secure/angelbroking/portfolio/v1/getHolding");
}

export async function getPositions(): Promise<unknown> {
  return request("get", "/rest/secure/angelbroking/order/v1/getPosition");
}

export async function getLiveQuote(mode: string, exchangeTokens: Record<string, string[]>): Promise<unknown> {
  return quoteLimiter.schedule(() =>
    request("post", "/rest/secure/angelbroking/market/v1/quote/", { mode, exchangeTokens })
  );
}

export async function getCandleData(params: {
  exchange: string;
  symboltoken: string;
  interval: string;
  fromdate: string;
  todate: string;
}): Promise<Array<[string, number, number, number, number, number]>> {
  return historicalLimiter.schedule(() =>
    request("post", "/rest/secure/angelbroking/historical/v1/getCandleData", params)
  );
}

export async function searchScrip(exchange: string, searchscrip: string): Promise<unknown> {
  return request("post", "/rest/secure/angelbroking/order/v1/searchScrip", { exchange, searchscrip });
}

export async function getGainersLosers(datatype: string, expirytype: string): Promise<unknown> {
  await ensureSession();
  const client = createAxios();
  const res = await client.get(
    `/rest/secure/angelbroking/marketData/v1/gainersLosers?datatype=${datatype}&expirytype=${expirytype}`,
    { headers: buildHeaders() }
  );
  return res.data.data;
}

export async function createGTT(params: Record<string, unknown>): Promise<unknown> {
  return request("post", "/rest/secure/angelbroking/gtt/v1/createRule", params);
}

export async function modifyGTT(params: Record<string, unknown>): Promise<unknown> {
  return request("post", "/rest/secure/angelbroking/gtt/v1/modifyRule", params);
}

export async function cancelGTT(params: { id: string; symboltoken: string; exchange: string }): Promise<unknown> {
  return request("post", "/rest/secure/angelbroking/gtt/v1/cancelRule", params);
}

export async function listGTT(params: { status: string[]; page: number; count: number }): Promise<unknown> {
  return request("post", "/rest/secure/angelbroking/gtt/v1/ruleList", params);
}

export async function getGTTDetails(id: string): Promise<unknown> {
  return request("get", `/rest/secure/angelbroking/gtt/v1/ruleDetails/${id}`);
}

export async function logout(): Promise<void> {
  if (!session) return;
  try {
    const client = createAxios();
    await client.post(
      "/rest/secure/angelbroking/user/v1/logout",
      { clientcode: process.env.ANGELONE_CLIENT_CODE },
      { headers: buildHeaders() }
    );
  } finally {
    session = null;
    if (refreshTimer) clearTimeout(refreshTimer);
  }
}
