import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AngelOneSession, AccountProfile, WalletBalance, Holding, Position, OrderBook } from '@/broker/angelOne';

interface AppState {
  // Broker Session (persisted to localStorage)
  brokerSession: AngelOneSession | null;
  brokerProfile: AccountProfile | null;
  brokerIsDemo: boolean;
  brokerApiKey: string;
  setBrokerSession: (session: AngelOneSession | null, profile: AccountProfile | null, isDemo: boolean, apiKey: string) => void;
  clearBrokerSession: () => void;

  // Broker live data (not persisted — fetched fresh)
  walletBalance: WalletBalance | null;
  holdings: Holding[];
  positions: Position[];
  orderBook: OrderBook[];
  setWalletBalance: (bal: WalletBalance) => void;
  setHoldings: (h: Holding[]) => void;
  setPositions: (p: Position[]) => void;
  setOrderBook: (o: OrderBook[]) => void;

  // Legacy broker status (kept for backward compat with header dots)
  brokerAuth: { status: 'CONNECTED' | 'PARTIAL' | 'FAILED' | 'NONE'; broker: string; name: string };
  geminiConfig: { status: 'ACTIVE' | 'FAILED' | 'NONE'; apiKey: string; model: string };
  setGeminiConfig: (cfg: Partial<AppState['geminiConfig']>) => void;

  // Settings
  paperMode: boolean;
  setPaperMode: (val: boolean) => void;

  tradingPrefs: {
    mode: string; segment: string; exchange: string; product: string;
    orderType: string; riskLevel: string; defaultQty: number; timeframe: string;
  };
  updatePrefs: (prefs: Partial<AppState['tradingPrefs']>) => void;

  // Watchlist
  watchlist: string[];
  addToWatchlist: (symbol: string) => void;
  removeFromWatchlist: (symbol: string) => void;

  // Paper Portfolio
  paperPortfolio: {
    balance: number;
    invested: number;
    holdings: any[];
    orders: any[];
    history: any[];
  };
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      // Broker session
      brokerSession: null,
      brokerProfile: null,
      brokerIsDemo: false,
      brokerApiKey: '',
      setBrokerSession: (session, profile, isDemo, apiKey) =>
        set({
          brokerSession: session,
          brokerProfile: profile,
          brokerIsDemo: isDemo,
          brokerApiKey: apiKey,
          brokerAuth: session
            ? {
                status: 'CONNECTED',
                broker: session.broker,
                name: session.clientName,
              }
            : { status: 'NONE', broker: 'AngelOne', name: '' },
        }),
      clearBrokerSession: () =>
        set({
          brokerSession: null,
          brokerProfile: null,
          brokerIsDemo: false,
          brokerApiKey: '',
          brokerAuth: { status: 'NONE', broker: 'AngelOne', name: '' },
          walletBalance: null,
          holdings: [],
          positions: [],
          orderBook: [],
        }),

      // Broker live data
      walletBalance: null,
      holdings: [],
      positions: [],
      orderBook: [],
      setWalletBalance: (bal) => set({ walletBalance: bal }),
      setHoldings: (h) => set({ holdings: h }),
      setPositions: (p) => set({ positions: p }),
      setOrderBook: (o) => set({ orderBook: o }),

      // Legacy
      brokerAuth: { status: 'NONE', broker: 'AngelOne', name: '' },
      geminiConfig: { status: 'NONE', apiKey: '', model: 'gemini-2.0-flash' },
      setGeminiConfig: (cfg) => set((s) => ({ geminiConfig: { ...s.geminiConfig, ...cfg } })),

      paperMode: true,
      setPaperMode: (val) => set({ paperMode: val }),

      tradingPrefs: {
        mode: 'Intraday', segment: 'Equity', exchange: 'NSE', product: 'MIS',
        orderType: 'LIMIT', riskLevel: 'Medium', defaultQty: 100, timeframe: '15m',
      },
      updatePrefs: (prefs) => set((state) => ({ tradingPrefs: { ...state.tradingPrefs, ...prefs } })),

      watchlist: ['RELIANCE-EQ', 'TCS-EQ', 'INFY-EQ', 'HDFCBANK-EQ', 'ICICIBANK-EQ'],
      addToWatchlist: (sym) =>
        set((state) => ({
          watchlist: state.watchlist.includes(sym) ? state.watchlist : [...state.watchlist, sym],
        })),
      removeFromWatchlist: (sym) =>
        set((state) => ({ watchlist: state.watchlist.filter((s) => s !== sym) })),

      paperPortfolio: {
        balance: 1000000,
        invested: 0,
        holdings: [],
        orders: [],
        history: [],
      },
    }),
    {
      name: 'tradesignal-storage',
      partialize: (state) => ({
        brokerSession: state.brokerSession,
        brokerProfile: state.brokerProfile,
        brokerIsDemo: state.brokerIsDemo,
        brokerApiKey: state.brokerApiKey,
        brokerAuth: state.brokerAuth,
        geminiConfig: state.geminiConfig,
        paperMode: state.paperMode,
        tradingPrefs: state.tradingPrefs,
        watchlist: state.watchlist,
        paperPortfolio: state.paperPortfolio,
      }),
    }
  )
);
