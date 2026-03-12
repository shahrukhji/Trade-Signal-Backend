// ═══════════════════════════════════════════════════════════
// TradeSignal Pro — Angel One SmartAPI Integration
// Full broker connectivity: Auth, Portfolio, Orders, Live Data
// Made with ❤️ by Shahrukh
// ═══════════════════════════════════════════════════════════

export interface AngelOneCredentials {
  clientId: string;
  password: string;
  apiKey: string;
  totp: string;
}

export interface AngelOneSession {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
  clientId: string;
  clientName: string;
  email: string;
  phone: string;
  exchanges: string[];
  products: string[];
  lastLoginTime: string;
  broker: string;
}

export interface AccountProfile {
  clientId: string;
  clientName: string;
  email: string;
  phone: string;
  pan: string;
  dematId: string;
  broker: string;
  exchanges: string[];
  products: string[];
  lastLoginTime: string;
  avatarInitials: string;
}

export interface WalletBalance {
  availableCash: number;
  usedMargin: number;
  totalMargin: number;
  availableMargin: number;
  collateral: number;
  totalPortfolioValue: number;
  todayPnL: number;
  unrealizedPnL: number;
  utilizedAmount: number;
  withdrawableBalance: number;
}

export interface Holding {
  tradingSymbol: string;
  exchange: string;
  symbolToken: string;
  isin: string;
  companyName: string;
  quantity: number;
  averagePrice: number;
  lastTradedPrice: number;
  currentValue: number;
  investedValue: number;
  pnl: number;
  pnlPercent: number;
  dayChange: number;
  dayChangePercent: number;
  product: string;
  close: number;
}

export interface Position {
  tradingSymbol: string;
  exchange: string;
  symbolToken: string;
  productType: string;
  netQuantity: number;
  buyQuantity: number;
  sellQuantity: number;
  buyPrice: number;
  sellPrice: number;
  netValue: number;
  pnl: number;
  unrealisedPnL: number;
  realisedPnL: number;
  ltp: number;
}

export interface OrderParams {
  variety: 'NORMAL' | 'STOPLOSS' | 'AMO' | 'ROBO';
  tradingSymbol: string;
  symbolToken: string;
  transactionType: 'BUY' | 'SELL';
  exchange: 'NSE' | 'BSE' | 'MCX';
  orderType: 'MARKET' | 'LIMIT' | 'STOPLOSS_LIMIT' | 'STOPLOSS_MARKET';
  productType: 'DELIVERY' | 'INTRADAY' | 'MARGIN' | 'BO' | 'CO';
  duration: 'DAY' | 'IOC';
  price: number;
  triggerPrice?: number;
  quantity: number;
  squareOff?: number;
  stopLoss?: number;
  trailingStopLoss?: number;
}

export interface OrderResponse {
  success: boolean;
  orderId?: string;
  uniqueOrderId?: string;
  message: string;
  errorCode?: string;
  script?: string;
}

export interface OrderBook {
  orderId: string;
  uniqueOrderId: string;
  tradingSymbol: string;
  exchange: string;
  transactionType: 'BUY' | 'SELL';
  orderType: string;
  productType: string;
  quantity: number;
  price: number;
  triggerPrice: number;
  status: 'open' | 'complete' | 'cancelled' | 'rejected' | 'pending' | 'trigger pending';
  filledQuantity: number;
  averagePrice: number;
  orderTimestamp: string;
  updateTimestamp: string;
  text: string;
}

export interface MarketQuote {
  tradingSymbol: string;
  symbolToken: string;
  exchange: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  change: number;
  changePercent: number;
  volume: number;
  totalBuyQty: number;
  totalSellQty: number;
  upperCircuit: number;
  lowerCircuit: number;
  weekHigh52: number;
  weekLow52: number;
  timestamp: string;
}

export interface CandleData {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface SearchResult {
  tradingSymbol: string;
  symbolToken: string;
  exchange: string;
  instrumentType: string;
  lotSize: number;
  tickSize: number;
  companyName: string;
  sector?: string;
  industry?: string;
}

// ═══════════════════════════════════════
// STOCK MASTER LIST (Top 50 NSE Stocks)
// ═══════════════════════════════════════

export const STOCK_MASTER_LIST: SearchResult[] = [
  { tradingSymbol: 'RELIANCE', symbolToken: '2885', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Reliance Industries Ltd', sector: 'Oil & Gas', industry: 'Refineries' },
  { tradingSymbol: 'TCS', symbolToken: '11536', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Tata Consultancy Services Ltd', sector: 'IT', industry: 'IT Services' },
  { tradingSymbol: 'INFY', symbolToken: '1594', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Infosys Ltd', sector: 'IT', industry: 'IT Services' },
  { tradingSymbol: 'HDFCBANK', symbolToken: '1333', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'HDFC Bank Ltd', sector: 'Banking', industry: 'Private Bank' },
  { tradingSymbol: 'ICICIBANK', symbolToken: '4963', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'ICICI Bank Ltd', sector: 'Banking', industry: 'Private Bank' },
  { tradingSymbol: 'WIPRO', symbolToken: '3787', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Wipro Ltd', sector: 'IT', industry: 'IT Services' },
  { tradingSymbol: 'BAJFINANCE', symbolToken: '317', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Bajaj Finance Ltd', sector: 'Finance', industry: 'NBFC' },
  { tradingSymbol: 'SBIN', symbolToken: '11984', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'State Bank of India', sector: 'Banking', industry: 'Public Bank' },
  { tradingSymbol: 'ITC', symbolToken: '1660', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'ITC Ltd', sector: 'FMCG', industry: 'Tobacco & FMCG' },
  { tradingSymbol: 'TATAMOTORS', symbolToken: '3456', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Tata Motors Ltd', sector: 'Auto', industry: 'Automobile' },
  { tradingSymbol: 'MARUTI', symbolToken: '10999', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Maruti Suzuki India Ltd', sector: 'Auto', industry: 'Automobile' },
  { tradingSymbol: 'SUNPHARMA', symbolToken: '3351', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Sun Pharmaceutical Industries', sector: 'Pharma', industry: 'Pharmaceutical' },
  { tradingSymbol: 'AXISBANK', symbolToken: '5900', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Axis Bank Ltd', sector: 'Banking', industry: 'Private Bank' },
  { tradingSymbol: 'KOTAKBANK', symbolToken: '1922', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Kotak Mahindra Bank Ltd', sector: 'Banking', industry: 'Private Bank' },
  { tradingSymbol: 'LT', symbolToken: '11483', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Larsen & Toubro Ltd', sector: 'Infrastructure', industry: 'Construction' },
  { tradingSymbol: 'BHARTIARTL', symbolToken: '10604', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Bharti Airtel Ltd', sector: 'Telecom', industry: 'Telecom Services' },
  { tradingSymbol: 'HINDUNILVR', symbolToken: '1394', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Hindustan Unilever Ltd', sector: 'FMCG', industry: 'FMCG' },
  { tradingSymbol: 'ASIANPAINT', symbolToken: '236', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Asian Paints Ltd', sector: 'Consumer', industry: 'Paints' },
  { tradingSymbol: 'TITAN', symbolToken: '3506', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Titan Company Ltd', sector: 'Consumer', industry: 'Jewellery' },
  { tradingSymbol: 'TATASTEEL', symbolToken: '3499', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Tata Steel Ltd', sector: 'Metal', industry: 'Steel' },
  { tradingSymbol: 'ULTRACEMCO', symbolToken: '11532', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'UltraTech Cement Ltd', sector: 'Cement', industry: 'Cement' },
  { tradingSymbol: 'NESTLEIND', symbolToken: '17963', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Nestle India Ltd', sector: 'FMCG', industry: 'Food Products' },
  { tradingSymbol: 'POWERGRID', symbolToken: '14977', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Power Grid Corporation', sector: 'Power', industry: 'Power Transmission' },
  { tradingSymbol: 'NTPC', symbolToken: '11630', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'NTPC Ltd', sector: 'Power', industry: 'Power Generation' },
  { tradingSymbol: 'TECHM', symbolToken: '13538', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Tech Mahindra Ltd', sector: 'IT', industry: 'IT Services' },
  { tradingSymbol: 'BAJAJFINSV', symbolToken: '16675', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Bajaj Finserv Ltd', sector: 'Finance', industry: 'Financial Services' },
  { tradingSymbol: 'HCLTECH', symbolToken: '7229', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'HCL Technologies Ltd', sector: 'IT', industry: 'IT Services' },
  { tradingSymbol: 'ADANIENT', symbolToken: '25', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Adani Enterprises Ltd', sector: 'Diversified', industry: 'Trading' },
  { tradingSymbol: 'ADANIPORTS', symbolToken: '15083', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Adani Ports and SEZ', sector: 'Infrastructure', industry: 'Ports' },
  { tradingSymbol: 'COALINDIA', symbolToken: '20374', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Coal India Ltd', sector: 'Mining', industry: 'Coal Mining' },
  { tradingSymbol: 'ONGC', symbolToken: '2475', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Oil and Natural Gas Corp', sector: 'Oil & Gas', industry: 'Exploration' },
  { tradingSymbol: 'JSWSTEEL', symbolToken: '11723', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'JSW Steel Ltd', sector: 'Metal', industry: 'Steel' },
  { tradingSymbol: 'DRREDDY', symbolToken: '881', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Dr. Reddys Laboratories', sector: 'Pharma', industry: 'Pharmaceutical' },
  { tradingSymbol: 'CIPLA', symbolToken: '694', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Cipla Ltd', sector: 'Pharma', industry: 'Pharmaceutical' },
  { tradingSymbol: 'EICHERMOT', symbolToken: '910', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Eicher Motors Ltd', sector: 'Auto', industry: 'Two Wheelers' },
  { tradingSymbol: 'DIVISLAB', symbolToken: '10940', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Divis Laboratories', sector: 'Pharma', industry: 'Pharmaceutical' },
  { tradingSymbol: 'GRASIM', symbolToken: '1232', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Grasim Industries', sector: 'Diversified', industry: 'Cement & Textiles' },
  { tradingSymbol: 'HEROMOTOCO', symbolToken: '1348', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Hero MotoCorp Ltd', sector: 'Auto', industry: 'Two Wheelers' },
  { tradingSymbol: 'INDUSINDBK', symbolToken: '5258', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'IndusInd Bank Ltd', sector: 'Banking', industry: 'Private Bank' },
  { tradingSymbol: 'APOLLOHOSP', symbolToken: '157', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Apollo Hospitals Enterprise', sector: 'Healthcare', industry: 'Hospitals' },
  { tradingSymbol: 'M&M', symbolToken: '2031', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Mahindra & Mahindra Ltd', sector: 'Auto', industry: 'Automobile' },
  { tradingSymbol: 'TATACONSUM', symbolToken: '3432', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Tata Consumer Products', sector: 'FMCG', industry: 'Food Products' },
  { tradingSymbol: 'BPCL', symbolToken: '526', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Bharat Petroleum Corp', sector: 'Oil & Gas', industry: 'Refineries' },
  { tradingSymbol: 'BRITANNIA', symbolToken: '547', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Britannia Industries', sector: 'FMCG', industry: 'Food Products' },
  { tradingSymbol: 'HINDALCO', symbolToken: '1363', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Hindalco Industries', sector: 'Metal', industry: 'Aluminium' },
  { tradingSymbol: 'SBILIFE', symbolToken: '21808', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'SBI Life Insurance Company', sector: 'Insurance', industry: 'Life Insurance' },
  { tradingSymbol: 'HDFCLIFE', symbolToken: '467', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'HDFC Life Insurance', sector: 'Insurance', industry: 'Life Insurance' },
  { tradingSymbol: 'DABUR', symbolToken: '772', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Dabur India Ltd', sector: 'FMCG', industry: 'Personal Care' },
  { tradingSymbol: 'PIDILITIND', symbolToken: '2664', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Pidilite Industries', sector: 'Chemicals', industry: 'Adhesives' },
  { tradingSymbol: 'HAVELLS', symbolToken: '9819', exchange: 'NSE', instrumentType: 'EQ', lotSize: 1, tickSize: 0.05, companyName: 'Havells India Ltd', sector: 'Electricals', industry: 'Consumer Electricals' },
];

// ═══════════════════════════════════════
// ANGEL ONE API SERVICE CLASS
// ═══════════════════════════════════════

class AngelOneService {
  private baseUrl = 'https://apiconnect.angelone.in';
  private session: AngelOneSession | null = null;
  private apiKey: string = '';
  private isDemo: boolean = false;

  // ═══════════════════════════════════════
  // AUTHENTICATION
  // ═══════════════════════════════════════

  async login(
    credentials: AngelOneCredentials,
    options: { strict?: boolean } = {}
  ): Promise<{
    success: boolean;
    session?: AngelOneSession;
    profile?: AccountProfile;
    error?: string;
  }> {
    this.apiKey = credentials.apiKey;

    try {
      const response = await fetch(`${this.baseUrl}/rest/auth/angelbroking/user/v1/loginByPassword`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientLocalIP': '127.0.0.1',
          'X-ClientPublicIP': '127.0.0.1',
          'X-MACAddress': '00:00:00:00:00:00',
          'X-PrivateKey': credentials.apiKey,
        },
        body: JSON.stringify({
          clientcode: credentials.clientId,
          password: credentials.password,
          totp: credentials.totp,
        }),
        signal: AbortSignal.timeout(12000),
      });

      if (response.ok) {
        const data = await response.json();

        if (data.status && data.data) {
          this.isDemo = false;
          this.session = {
            jwtToken: data.data.jwtToken,
            refreshToken: data.data.refreshToken,
            feedToken: data.data.feedToken,
            clientId: credentials.clientId,
            clientName: data.data.name || 'Trader',
            email: data.data.email || '',
            phone: data.data.mobileno || '',
            exchanges: data.data.exchanges || ['NSE', 'BSE'],
            products: data.data.products || ['DELIVERY', 'INTRADAY'],
            lastLoginTime: data.data.lastlogintime || new Date().toISOString(),
            broker: 'Angel One',
          };

          const profile: AccountProfile = {
            clientId: credentials.clientId,
            clientName: this.session.clientName,
            email: this.session.email,
            phone: this.session.phone,
            pan: data.data.pan || 'XXXXX0000X',
            dematId: data.data.dematId || '',
            broker: 'Angel One',
            exchanges: this.session.exchanges,
            products: this.session.products,
            lastLoginTime: this.session.lastLoginTime,
            avatarInitials: this.getInitials(this.session.clientName),
          };

          return { success: true, session: this.session, profile };
        } else {
          return { success: false, error: data.message || 'Login failed' };
        }
      } else {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401) {
          return { success: false, error: 'Invalid credentials. Check Client ID, Password, and TOTP.' };
        }
        if (response.status === 400) {
          return { success: false, error: errorData.message || 'Invalid request. Check TOTP — it may have expired.' };
        }
        if (response.status === 429) {
          return { success: false, error: 'Too many login attempts. Wait 5 minutes and try again.' };
        }

        return { success: false, error: `Login failed: ${errorData.message || response.status}` };
      }
    } catch (networkError: any) {
      // Strict mode: no demo fallback — report the actual network error
      if (options.strict) {
        const msg = networkError?.name === 'TimeoutError' || networkError?.name === 'AbortError'
          ? 'Connection timed out. Check your internet connection and API key.'
          : 'Unable to reach Angel One servers. Check your internet and try again.';
        return { success: false, error: msg };
      }

      // Network unreachable → fall back to demo mode
      console.warn('Angel One API unreachable, switching to demo mode');
      this.isDemo = true;

      this.session = {
        jwtToken: 'demo_jwt_' + Date.now(),
        refreshToken: 'demo_refresh',
        feedToken: 'demo_feed',
        clientId: credentials.clientId || 'DEMO001',
        clientName: credentials.clientId ? `Trader (${credentials.clientId})` : 'Demo Trader',
        email: 'demo@tradesignal.pro',
        phone: '9876543210',
        exchanges: ['NSE', 'BSE', 'MCX'],
        products: ['DELIVERY', 'INTRADAY', 'MARGIN'],
        lastLoginTime: new Date().toISOString(),
        broker: 'Angel One (Demo)',
      };

      return {
        success: true,
        session: this.session,
        profile: {
          clientId: this.session.clientId,
          clientName: this.session.clientName,
          email: this.session.email,
          phone: this.session.phone,
          pan: 'DEMO0000X',
          dematId: 'DEMO-1234567890',
          broker: 'Angel One (Demo Mode)',
          exchanges: this.session.exchanges,
          products: this.session.products,
          lastLoginTime: this.session.lastLoginTime,
          avatarInitials: this.getInitials(this.session.clientName),
        },
      };
    }
  }

  async logout(): Promise<void> {
    if (this.session && !this.isDemo) {
      try {
        await fetch(`${this.baseUrl}/rest/secure/angelbroking/user/v1/logout`, {
          method: 'POST',
          headers: this.getHeaders(),
          body: JSON.stringify({ clientcode: this.session.clientId }),
          signal: AbortSignal.timeout(8000),
        });
      } catch (_) {}
    }
    this.session = null;
    this.isDemo = false;
  }

  async refreshSession(): Promise<boolean> {
    if (!this.session || this.isDemo) return true;

    try {
      const response = await fetch(`${this.baseUrl}/rest/auth/angelbroking/jwt/v1/generateTokens`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({ refreshToken: this.session.refreshToken }),
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data) {
          this.session.jwtToken = data.data.jwtToken;
          this.session.refreshToken = data.data.refreshToken;
          this.session.feedToken = data.data.feedToken;
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  isConnected(): boolean {
    return this.session !== null;
  }

  isDemoMode(): boolean {
    return this.isDemo;
  }

  getSession(): AngelOneSession | null {
    return this.session;
  }

  getProfile(): AccountProfile | null {
    if (!this.session) return null;
    return {
      clientId: this.session.clientId,
      clientName: this.session.clientName,
      email: this.session.email,
      phone: this.session.phone,
      pan: '',
      dematId: '',
      broker: this.session.broker,
      exchanges: this.session.exchanges,
      products: this.session.products,
      lastLoginTime: this.session.lastLoginTime,
      avatarInitials: this.getInitials(this.session.clientName),
    };
  }

  // Restore a persisted session (called on app start from localStorage)
  restoreSession(session: AngelOneSession, isDemo: boolean, apiKey: string): void {
    this.session = session;
    this.isDemo = isDemo;
    this.apiKey = apiKey;
  }

  // ═══════════════════════════════════════
  // WALLET / FUND BALANCE
  // ═══════════════════════════════════════

  async getWalletBalance(): Promise<WalletBalance> {
    if (!this.session || this.isDemo) return this.getMockWalletBalance();

    try {
      const response = await this.apiCall('GET', '/rest/secure/angelbroking/user/v1/getRMS');

      if (response) {
        return {
          availableCash: parseFloat(response.availablecash) || 0,
          usedMargin: parseFloat(response.utiliseddebits) || 0,
          totalMargin: parseFloat(response.net) || 0,
          availableMargin: parseFloat(response.availableintradaypayin) || 0,
          collateral: parseFloat(response.collateral) || 0,
          totalPortfolioValue: parseFloat(response.net) || 0,
          todayPnL: parseFloat(response.m2mrealized) || 0,
          unrealizedPnL: parseFloat(response.m2munrealized) || 0,
          utilizedAmount: parseFloat(response.utiliseddebits) || 0,
          withdrawableBalance: parseFloat(response.availablecash) || 0,
        };
      }
    } catch (_) {}

    return this.getMockWalletBalance();
  }

  // ═══════════════════════════════════════
  // HOLDINGS
  // ═══════════════════════════════════════

  async getHoldings(): Promise<Holding[]> {
    if (!this.session || this.isDemo) return this.getMockHoldings();

    try {
      const response = await this.apiCall('GET', '/rest/secure/angelbroking/portfolio/v1/getHolding');

      if (response && Array.isArray(response)) {
        return response.map((h: any) => ({
          tradingSymbol: h.tradingsymbol,
          exchange: h.exchange,
          symbolToken: h.symboltoken,
          isin: h.isin || '',
          companyName: h.companyname || h.tradingsymbol,
          quantity: parseInt(h.quantity) || 0,
          averagePrice: parseFloat(h.averageprice) || 0,
          lastTradedPrice: parseFloat(h.ltp) || 0,
          currentValue: (parseFloat(h.ltp) || 0) * (parseInt(h.quantity) || 0),
          investedValue: (parseFloat(h.averageprice) || 0) * (parseInt(h.quantity) || 0),
          pnl: parseFloat(h.profitandloss) || 0,
          pnlPercent: parseFloat(h.pnlpercentage) || 0,
          dayChange: parseFloat(h.close) ? parseFloat(h.ltp) - parseFloat(h.close) : 0,
          dayChangePercent: parseFloat(h.close) ? ((parseFloat(h.ltp) - parseFloat(h.close)) / parseFloat(h.close)) * 100 : 0,
          product: h.product || 'DELIVERY',
          close: parseFloat(h.close) || 0,
        }));
      }
    } catch (_) {}

    return this.getMockHoldings();
  }

  // ═══════════════════════════════════════
  // POSITIONS
  // ═══════════════════════════════════════

  async getPositions(): Promise<Position[]> {
    if (!this.session || this.isDemo) return this.getMockPositions();

    try {
      const response = await this.apiCall('GET', '/rest/secure/angelbroking/order/v1/getPosition');

      if (response && Array.isArray(response)) {
        return response.map((p: any) => ({
          tradingSymbol: p.tradingsymbol,
          exchange: p.exchange,
          symbolToken: p.symboltoken,
          productType: p.producttype,
          netQuantity: parseInt(p.netqty) || 0,
          buyQuantity: parseInt(p.buyqty) || 0,
          sellQuantity: parseInt(p.sellqty) || 0,
          buyPrice: parseFloat(p.buyavgprice) || 0,
          sellPrice: parseFloat(p.sellavgprice) || 0,
          netValue: parseFloat(p.netvalue) || 0,
          pnl: parseFloat(p.pnl) || 0,
          unrealisedPnL: parseFloat(p.unrealised) || 0,
          realisedPnL: parseFloat(p.realised) || 0,
          ltp: parseFloat(p.ltp) || 0,
        }));
      }
    } catch (_) {}

    return this.getMockPositions();
  }

  // ═══════════════════════════════════════
  // ORDERS
  // ═══════════════════════════════════════

  async placeOrder(params: OrderParams): Promise<OrderResponse> {
    if (this.isDemo) {
      return {
        success: true,
        orderId: 'DEMO-' + Date.now(),
        uniqueOrderId: 'DEMO-U-' + Date.now(),
        message: 'Order placed successfully (Demo Mode)',
      };
    }

    try {
      const response = await this.apiCall('POST', '/rest/secure/angelbroking/order/v1/placeOrder', {
        variety: params.variety,
        tradingsymbol: params.tradingSymbol,
        symboltoken: params.symbolToken,
        transactiontype: params.transactionType,
        exchange: params.exchange,
        ordertype: params.orderType,
        producttype: params.productType,
        duration: params.duration,
        price: params.price.toString(),
        triggerprice: params.triggerPrice?.toString() || '0',
        quantity: params.quantity.toString(),
        squareoff: params.squareOff?.toString() || '0',
        stoploss: params.stopLoss?.toString() || '0',
        trailingStopLoss: params.trailingStopLoss?.toString() || '0',
      });

      if (response) {
        return {
          success: true,
          orderId: response.orderid,
          uniqueOrderId: response.uniqueorderid,
          message: 'Order placed successfully',
        };
      }
      return { success: false, message: 'Order placement failed' };
    } catch (error: any) {
      return { success: false, message: error.message, errorCode: 'API_ERROR' };
    }
  }

  async modifyOrder(orderId: string, params: Partial<OrderParams>): Promise<OrderResponse> {
    if (this.isDemo) {
      return { success: true, orderId, message: 'Order modified (Demo)' };
    }

    try {
      const response = await this.apiCall('POST', '/rest/secure/angelbroking/order/v1/modifyOrder', {
        orderid: orderId,
        variety: params.variety || 'NORMAL',
        ordertype: params.orderType,
        producttype: params.productType,
        duration: params.duration || 'DAY',
        price: params.price?.toString(),
        quantity: params.quantity?.toString(),
        triggerprice: params.triggerPrice?.toString(),
      });
      return { success: !!response, orderId, message: response ? 'Modified' : 'Failed' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async cancelOrder(orderId: string, variety: string = 'NORMAL'): Promise<OrderResponse> {
    if (this.isDemo) {
      return { success: true, orderId, message: 'Order cancelled (Demo)' };
    }

    try {
      const response = await this.apiCall('POST', '/rest/secure/angelbroking/order/v1/cancelOrder', {
        orderid: orderId,
        variety,
      });
      return { success: !!response, orderId, message: response ? 'Cancelled' : 'Failed' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  async getOrderBook(): Promise<OrderBook[]> {
    if (!this.session || this.isDemo) return this.getMockOrderBook();

    try {
      const response = await this.apiCall('GET', '/rest/secure/angelbroking/order/v1/getOrderBook');
      if (response && Array.isArray(response)) {
        return response.map((o: any) => ({
          orderId: o.orderid,
          uniqueOrderId: o.uniqueorderid,
          tradingSymbol: o.tradingsymbol,
          exchange: o.exchange,
          transactionType: o.transactiontype,
          orderType: o.ordertype,
          productType: o.producttype,
          quantity: parseInt(o.quantity) || 0,
          price: parseFloat(o.price) || 0,
          triggerPrice: parseFloat(o.triggerprice) || 0,
          status: o.orderstatus?.toLowerCase() || 'pending',
          filledQuantity: parseInt(o.filledshares) || 0,
          averagePrice: parseFloat(o.averageprice) || 0,
          orderTimestamp: o.ordervalidity || '',
          updateTimestamp: o.updatetime || '',
          text: o.text || '',
        }));
      }
    } catch (_) {}
    return this.getMockOrderBook();
  }

  // ═══════════════════════════════════════
  // MARKET DATA
  // ═══════════════════════════════════════

  async getQuote(exchange: string, symbolToken: string, tradingSymbol: string): Promise<MarketQuote> {
    if (!this.session || this.isDemo) return this.getMockQuote(tradingSymbol);

    try {
      const response = await this.apiCall('POST', '/rest/secure/angelbroking/market/v1/quote/', {
        mode: 'FULL',
        exchangeTokens: { [exchange]: [symbolToken] },
      });

      if (response && response.fetched && response.fetched.length > 0) {
        const q = response.fetched[0];
        return {
          tradingSymbol,
          symbolToken,
          exchange,
          ltp: parseFloat(q.ltp) || 0,
          open: parseFloat(q.open) || 0,
          high: parseFloat(q.high) || 0,
          low: parseFloat(q.low) || 0,
          close: parseFloat(q.close) || 0,
          change: parseFloat(q.ltp) - parseFloat(q.close),
          changePercent: parseFloat(q.close) ? ((parseFloat(q.ltp) - parseFloat(q.close)) / parseFloat(q.close)) * 100 : 0,
          volume: parseInt(q.tradeVolume) || 0,
          totalBuyQty: parseInt(q.totBuyQuan) || 0,
          totalSellQty: parseInt(q.totSellQuan) || 0,
          upperCircuit: parseFloat(q.upperCircuit) || 0,
          lowerCircuit: parseFloat(q.lowerCircuit) || 0,
          weekHigh52: parseFloat(q['52WeekHigh']) || 0,
          weekLow52: parseFloat(q['52WeekLow']) || 0,
          timestamp: q.exchFeedTime || new Date().toISOString(),
        };
      }
    } catch (_) {}
    return this.getMockQuote(tradingSymbol);
  }

  async getCandleData(
    exchange: string,
    symbolToken: string,
    interval: string,
    fromDate: string,
    toDate: string
  ): Promise<CandleData[]> {
    if (!this.session || this.isDemo) return this.generateMockCandles(symbolToken, 200);

    try {
      const response = await this.apiCall('POST', '/rest/secure/angelbroking/historical/v1/getCandleData', {
        exchange,
        symboltoken: symbolToken,
        interval,
        fromdate: fromDate,
        todate: toDate,
      });

      if (response && Array.isArray(response)) {
        return response.map((c: any[]) => ({
          time: Math.floor(new Date(c[0]).getTime() / 1000),
          open: parseFloat(c[1]),
          high: parseFloat(c[2]),
          low: parseFloat(c[3]),
          close: parseFloat(c[4]),
          volume: parseInt(c[5]),
        }));
      }
    } catch (_) {}
    return this.generateMockCandles(symbolToken, 200);
  }

  // ═══════════════════════════════════════
  // STOCK SEARCH
  // ═══════════════════════════════════════

  async searchStock(query: string): Promise<SearchResult[]> {
    const searchLower = query.toLowerCase().trim();
    if (searchLower.length < 1) return [];

    return STOCK_MASTER_LIST.filter(
      (stock) =>
        stock.tradingSymbol.toLowerCase().includes(searchLower) ||
        stock.companyName.toLowerCase().includes(searchLower) ||
        (stock.sector && stock.sector.toLowerCase().includes(searchLower)) ||
        (stock.industry && stock.industry.toLowerCase().includes(searchLower))
    ).slice(0, 20);
  }

  async searchStockBySymbol(symbol: string): Promise<SearchResult | null> {
    return STOCK_MASTER_LIST.find((s) => s.tradingSymbol.toUpperCase() === symbol.toUpperCase()) || null;
  }

  getStockByToken(token: string): SearchResult | null {
    return STOCK_MASTER_LIST.find((s) => s.symbolToken === token) || null;
  }

  // ═══════════════════════════════════════
  // BRACKET ORDER (Advanced)
  // ═══════════════════════════════════════

  async placeBracketOrder(
    tradingSymbol: string,
    symbolToken: string,
    exchange: string,
    transactionType: 'BUY' | 'SELL',
    quantity: number,
    price: number,
    targetPrice: number,
    stopLossPrice: number,
    trailingStopLoss?: number
  ): Promise<OrderResponse> {
    const squareOff = Math.abs(targetPrice - price);
    const stopLoss = Math.abs(price - stopLossPrice);

    return this.placeOrder({
      variety: 'ROBO',
      tradingSymbol,
      symbolToken,
      transactionType,
      exchange: exchange as any,
      orderType: 'LIMIT',
      productType: 'BO',
      duration: 'DAY',
      price,
      quantity,
      squareOff,
      stopLoss,
      trailingStopLoss,
    });
  }

  // ═══════════════════════════════════════
  // GTT ORDER (Good Till Triggered)
  // ═══════════════════════════════════════

  async placeGTTOrder(
    tradingSymbol: string,
    symbolToken: string,
    exchange: string,
    transactionType: 'BUY' | 'SELL',
    quantity: number,
    triggerPrice: number,
    limitPrice: number
  ): Promise<OrderResponse> {
    if (this.isDemo) {
      return { success: true, orderId: 'GTT-DEMO-' + Date.now(), message: 'GTT Order placed (Demo)' };
    }

    try {
      const response = await this.apiCall('POST', '/rest/secure/angelbroking/gtt/v1/createRule', {
        tradingsymbol: tradingSymbol,
        symboltoken: symbolToken,
        exchange,
        transactiontype: transactionType,
        producttype: 'DELIVERY',
        price: limitPrice.toString(),
        qty: quantity.toString(),
        triggerprice: triggerPrice.toString(),
        timeperiod: 365,
      });

      return { success: !!response, orderId: response?.id, message: response ? 'GTT Created' : 'Failed' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  // ═══════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════

  private getHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': '127.0.0.1',
      'X-ClientPublicIP': '127.0.0.1',
      'X-MACAddress': '00:00:00:00:00:00',
      'X-PrivateKey': this.apiKey,
      'Authorization': `Bearer ${this.session?.jwtToken || ''}`,
    };
  }

  private async apiCall(method: string, endpoint: string, body?: any): Promise<any> {
    if (this.isDemo) return null;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 401) {
      const refreshed = await this.refreshSession();
      if (!refreshed) throw new Error('Session expired. Please re-login.');

      const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000),
      });
      const retryData = await retryResponse.json();
      return retryData.data;
    }

    const data = await response.json();
    if (!data.status) throw new Error(data.message || 'API Error');
    return data.data;
  }

  private getInitials(name: string): string {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  // ═══════════════════════════════════════
  // MOCK DATA
  // ═══════════════════════════════════════

  private getMockWalletBalance(): WalletBalance {
    return {
      availableCash: 247850.5,
      usedMargin: 152340.0,
      totalMargin: 400190.5,
      availableMargin: 247850.5,
      collateral: 85000.0,
      totalPortfolioValue: 652840.75,
      todayPnL: 3420.5,
      unrealizedPnL: 12580.75,
      utilizedAmount: 405000.0,
      withdrawableBalance: 147850.5,
    };
  }

  private getMockHoldings(): Holding[] {
    return [
      { tradingSymbol: 'RELIANCE', exchange: 'NSE', symbolToken: '2885', isin: 'INE002A01018', companyName: 'Reliance Industries Ltd', quantity: 50, averagePrice: 2380.5, lastTradedPrice: 2456.75, currentValue: 122837.5, investedValue: 119025.0, pnl: 3812.5, pnlPercent: 3.2, dayChange: 32.5, dayChangePercent: 1.34, product: 'DELIVERY', close: 2424.25 },
      { tradingSymbol: 'TCS', exchange: 'NSE', symbolToken: '11536', isin: 'INE467B01029', companyName: 'Tata Consultancy Services', quantity: 25, averagePrice: 3750.0, lastTradedPrice: 3892.5, currentValue: 97312.5, investedValue: 93750.0, pnl: 3562.5, pnlPercent: 3.8, dayChange: -15.3, dayChangePercent: -0.39, product: 'DELIVERY', close: 3907.8 },
      { tradingSymbol: 'INFY', exchange: 'NSE', symbolToken: '1594', isin: 'INE009A01021', companyName: 'Infosys Ltd', quantity: 100, averagePrice: 1520.0, lastTradedPrice: 1587.3, currentValue: 158730.0, investedValue: 152000.0, pnl: 6730.0, pnlPercent: 4.43, dayChange: 22.1, dayChangePercent: 1.41, product: 'DELIVERY', close: 1565.2 },
      { tradingSymbol: 'HDFCBANK', exchange: 'NSE', symbolToken: '1333', isin: 'INE040A01034', companyName: 'HDFC Bank Ltd', quantity: 40, averagePrice: 1650.0, lastTradedPrice: 1723.45, currentValue: 68938.0, investedValue: 66000.0, pnl: 2938.0, pnlPercent: 4.45, dayChange: 18.75, dayChangePercent: 1.1, product: 'DELIVERY', close: 1704.7 },
      { tradingSymbol: 'ICICIBANK', exchange: 'NSE', symbolToken: '4963', isin: 'INE090A01021', companyName: 'ICICI Bank Ltd', quantity: 75, averagePrice: 1080.0, lastTradedPrice: 1145.6, currentValue: 85920.0, investedValue: 81000.0, pnl: 4920.0, pnlPercent: 6.07, dayChange: -8.4, dayChangePercent: -0.73, product: 'DELIVERY', close: 1154.0 },
      { tradingSymbol: 'WIPRO', exchange: 'NSE', symbolToken: '3787', isin: 'INE075A01022', companyName: 'Wipro Ltd', quantity: 200, averagePrice: 445.5, lastTradedPrice: 462.8, currentValue: 92560.0, investedValue: 89100.0, pnl: 3460.0, pnlPercent: 3.88, dayChange: 5.3, dayChangePercent: 1.16, product: 'DELIVERY', close: 457.5 },
    ];
  }

  private getMockPositions(): Position[] {
    return [
      { tradingSymbol: 'BAJFINANCE', exchange: 'NSE', symbolToken: '317', productType: 'INTRADAY', netQuantity: 10, buyQuantity: 10, sellQuantity: 0, buyPrice: 7200.0, sellPrice: 0, netValue: 72450.0, pnl: 450.0, unrealisedPnL: 450.0, realisedPnL: 0, ltp: 7245.0 },
    ];
  }

  private getMockOrderBook(): OrderBook[] {
    return [
      { orderId: 'ORD-001', uniqueOrderId: 'UNQ-001', tradingSymbol: 'RELIANCE', exchange: 'NSE', transactionType: 'BUY', orderType: 'LIMIT', productType: 'DELIVERY', quantity: 10, price: 2440, triggerPrice: 0, status: 'complete', filledQuantity: 10, averagePrice: 2438.5, orderTimestamp: new Date(Date.now() - 3600000).toISOString(), updateTimestamp: new Date(Date.now() - 3500000).toISOString(), text: '' },
      { orderId: 'ORD-002', uniqueOrderId: 'UNQ-002', tradingSymbol: 'TCS', exchange: 'NSE', transactionType: 'SELL', orderType: 'LIMIT', productType: 'DELIVERY', quantity: 5, price: 3900, triggerPrice: 0, status: 'open', filledQuantity: 0, averagePrice: 0, orderTimestamp: new Date(Date.now() - 1800000).toISOString(), updateTimestamp: new Date(Date.now() - 1800000).toISOString(), text: '' },
      { orderId: 'ORD-003', uniqueOrderId: 'UNQ-003', tradingSymbol: 'SBIN', exchange: 'NSE', transactionType: 'BUY', orderType: 'STOPLOSS_LIMIT', productType: 'INTRADAY', quantity: 100, price: 635, triggerPrice: 633, status: 'trigger pending', filledQuantity: 0, averagePrice: 0, orderTimestamp: new Date(Date.now() - 900000).toISOString(), updateTimestamp: new Date(Date.now() - 900000).toISOString(), text: '' },
    ];
  }

  private getMockQuote(symbol: string): MarketQuote {
    const prices: Record<string, number> = {
      RELIANCE: 2456.75, TCS: 3892.5, INFY: 1587.3, HDFCBANK: 1723.45,
      ICICIBANK: 1145.6, WIPRO: 462.8, BAJFINANCE: 7245.9, SBIN: 634.25,
      ITC: 468.9, TATAMOTORS: 789.45, MARUTI: 11456.7, SUNPHARMA: 1567.25,
      AXISBANK: 1089.35, KOTAKBANK: 1834.55, LT: 3567.8, TITAN: 3678.9,
      ASIANPAINT: 2834.15, HINDUNILVR: 2456.3, BHARTIARTL: 1678.4,
      ULTRACEMCO: 11234.5, TATASTEEL: 145.8, POWERGRID: 312.65,
      NTPC: 378.9, NESTLEIND: 2567.8, TECHM: 1678.35,
    };

    const base = prices[symbol] || 500 + Math.random() * 2000;
    const change = base * (Math.random() * 0.04 - 0.02);

    return {
      tradingSymbol: symbol,
      symbolToken: '0',
      exchange: 'NSE',
      ltp: Math.round((base + change) * 100) / 100,
      open: Math.round(base * 100) / 100,
      high: Math.round((base + Math.abs(change) * 2) * 100) / 100,
      low: Math.round((base - Math.abs(change) * 1.5) * 100) / 100,
      close: Math.round(base * 100) / 100,
      change: Math.round(change * 100) / 100,
      changePercent: Math.round((change / base) * 10000) / 100,
      volume: Math.floor(Math.random() * 8000000 + 500000),
      totalBuyQty: Math.floor(Math.random() * 500000),
      totalSellQty: Math.floor(Math.random() * 500000),
      upperCircuit: Math.round(base * 1.2 * 100) / 100,
      lowerCircuit: Math.round(base * 0.8 * 100) / 100,
      weekHigh52: Math.round(base * 1.35 * 100) / 100,
      weekLow52: Math.round(base * 0.7 * 100) / 100,
      timestamp: new Date().toISOString(),
    };
  }

  generateMockCandles(symbol: string, count: number): CandleData[] {
    const prices: Record<string, number> = {
      RELIANCE: 2400, TCS: 3800, INFY: 1550, HDFCBANK: 1700,
      '2885': 2400, '11536': 3800, '1594': 1550, '1333': 1700,
    };
    let price = prices[symbol] || 800 + Math.random() * 1500;
    const candles: CandleData[] = [];
    const now = Math.floor(Date.now() / 1000);

    for (let i = count - 1; i >= 0; i--) {
      const vol = price * 0.008;
      const change = (Math.random() - 0.48) * vol;
      const open = price;
      const close = price + change;
      const high = Math.max(open, close) + Math.random() * vol * 0.5;
      const low = Math.min(open, close) - Math.random() * vol * 0.5;
      candles.push({
        time: now - i * 900,
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(close * 100) / 100,
        volume: Math.floor(30000 + Math.random() * 600000),
      });
      price = close;
    }
    return candles;
  }
}

export const angelOne = new AngelOneService();
