const FALLBACK_DOMAIN = '15007c63-7d1f-4e05-adee-a542a17f6879-00-36poe8uxor3xw.worf.replit.dev';
const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN || FALLBACK_DOMAIN}`;

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export interface ConfigStatus {
  hasClientCode: boolean;
  hasPin: boolean;
  hasApiKey: boolean;
  hasTotpSecret: boolean;
  allConfigured: boolean;
}

export interface BrokerSession {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
  clientId: string;
  clientName: string;
  email: string;
  exchanges: string[];
  products: string[];
}

export interface Holding {
  tradingsymbol: string;
  exchange: string;
  isin: string;
  t1quantity: number;
  realisedquantity: number;
  quantity: number;
  authorisedquantity: number;
  product: string;
  collateralquantity: number | null;
  collateraltype: string | null;
  haircut: number;
  averageprice: number;
  ltp: number;
  symboltoken: string;
  close: number;
  profitandloss: number;
  pnlpercentage: number;
}

export interface Position {
  exchange: string;
  symboltoken: string;
  producttype: string;
  tradingsymbol: string;
  symbolname: string;
  instrumenttype: string;
  priceden: string;
  pricenum: string;
  genden: string;
  gennum: string;
  precision: string;
  multiplier: string;
  boardlotsize: string;
  buyqty: string;
  sellqty: string;
  buyamount: string;
  sellamount: string;
  symbolgroup: string;
  strikeprice: string;
  optiontype: string;
  expirydate: string;
  lotsize: string;
  cfbuyqty: string;
  cfsellqty: string;
  cfbuyamount: string;
  cfsellamount: string;
  buyavgprice: string;
  sellavgprice: string;
  avgnetprice: string;
  netvalue: string;
  netqty: string;
  totalbuyvalue: string;
  totalsellvalue: string;
  cfbuyavgprice: string;
  cfsellavgprice: string;
  totalbuyavgprice: string;
  totalsellimgprice: string;
  netprice: string;
  unrealisedpnl: string;
  realisedpnl: string;
  ltp: string;
  pnl: string;
  carryforward: string;
  multipliervalue: string;
  close: string;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Signal {
  symbol: string;
  symboltoken: string;
  exchange: string;
  ltp?: number;
  signal: 'STRONG_BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG_SELL';
  score: number;
  indicators: string[];
  rsi?: number;
  change?: number;
  changePercent?: number;
  target1?: number;
  stopLoss?: number;
  riskReward?: number;
}

export interface FundsData {
  availablecash: string;
  availableintradaypayin: string;
  availablelimitmargin: string;
  net: string;
  utiliseddebits: string;
  utilisedspan: string;
  utilisedoptionpremium: string;
  utilisedturnoverbeginfees: string;
  utilisedexposure: string;
  utilisedpayout: string;
  utilisedholdingnative: string;
  utilisedintradaypayin: string;
}

export const api = {
  configStatus: () => req<ConfigStatus>('/api/broker-proxy/config-status'),

  autoLogin: () => req<{ status: boolean; message: string; data: Record<string, unknown> }>(
    '/api/broker-proxy/auto-login', { method: 'POST' }
  ),

  getHoldings: (jwtToken: string) =>
    req<{ status: boolean; data: Holding[] }>('/api/broker-proxy/rest/secure/angelbroking/portfolio/v1/getAllHolding', {
      headers: { Authorization: `Bearer ${jwtToken}` },
    }),

  getPositions: (jwtToken: string) =>
    req<{ status: boolean; data: Position[] }>('/api/broker-proxy/rest/secure/angelbroking/order/v1/getPosition', {
      headers: { Authorization: `Bearer ${jwtToken}` },
    }),

  getFunds: (jwtToken: string) =>
    req<{ status: boolean; data: FundsData }>('/api/broker-proxy/rest/secure/angelbroking/user/v1/getRMS', {
      headers: { Authorization: `Bearer ${jwtToken}` },
    }),

  getCandles: (jwtToken: string, body: {
    exchange: string; symboltoken: string; interval: string; fromdate: string; todate: string;
  }) => req<{ status: boolean; data: [string, number, number, number, number, number][] }>(
    '/api/broker-proxy/rest/secure/angelbroking/historical/v1/getCandleData', {
      method: 'POST',
      headers: { Authorization: `Bearer ${jwtToken}` },
      body: JSON.stringify(body),
    }
  ),

  getSignals: () => req<{ success: boolean; data: Signal[] }>('/api/signals'),

  getQuote: (jwtToken: string, mode: string, exchangeTokens: Record<string, string[]>) =>
    req<{ status: boolean; data: { fetched: { tradingsymbol: string; ltp: number; change: number; percentchange: number }[] } }>(
      '/api/broker-proxy/rest/secure/angelbroking/market/v1/quote/', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtToken}` },
        body: JSON.stringify({ mode, exchangeTokens }),
      }
    ),

  searchSymbol: (jwtToken: string, query: string) =>
    req<{ status: boolean; data: { tradingsymbol: string; symboltoken: string; exchange: string; name: string }[] }>(
      '/api/broker-proxy/rest/secure/angelbroking/order/v1/searchScrip', {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwtToken}` },
        body: JSON.stringify({ exchange: 'NSE', searchscrip: query }),
      }
    ),
};
