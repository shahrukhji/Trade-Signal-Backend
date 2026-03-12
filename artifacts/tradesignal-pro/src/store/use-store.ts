import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppState {
  // Auth & API
  brokerAuth: { status: 'CONNECTED' | 'PARTIAL' | 'FAILED' | 'NONE'; broker: string; name: string };
  geminiConfig: { status: 'ACTIVE' | 'FAILED' | 'NONE'; apiKey: string; model: string };
  
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
      brokerAuth: { status: 'NONE', broker: 'AngelOne', name: '' },
      geminiConfig: { status: 'NONE', apiKey: '', model: 'gemini-2.0-flash' },
      
      paperMode: true,
      setPaperMode: (val) => set({ paperMode: val }),
      
      tradingPrefs: {
        mode: 'Intraday', segment: 'Equity', exchange: 'NSE', product: 'MIS',
        orderType: 'LIMIT', riskLevel: 'Medium', defaultQty: 100, timeframe: '15m'
      },
      updatePrefs: (prefs) => set((state) => ({ tradingPrefs: { ...state.tradingPrefs, ...prefs } })),
      
      watchlist: ['RELIANCE-EQ', 'TCS-EQ', 'INFY-EQ', 'HDFCBANK-EQ', 'ICICIBANK-EQ'],
      addToWatchlist: (sym) => set((state) => ({ 
        watchlist: state.watchlist.includes(sym) ? state.watchlist : [...state.watchlist, sym] 
      })),
      removeFromWatchlist: (sym) => set((state) => ({
        watchlist: state.watchlist.filter(s => s !== sym)
      })),
      
      paperPortfolio: {
        balance: 1000000,
        invested: 0,
        holdings: [],
        orders: [],
        history: []
      }
    }),
    {
      name: 'tradesignal-storage',
    }
  )
);
