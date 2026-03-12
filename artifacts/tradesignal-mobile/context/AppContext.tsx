import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, type BrokerSession, type ConfigStatus } from '@/lib/api';

interface AppState {
  session: BrokerSession | null;
  configStatus: ConfigStatus | null;
  paperMode: boolean;
  isConnecting: boolean;
  connectError: string;
  connectBroker: () => Promise<void>;
  disconnect: () => void;
  setPaperMode: (v: boolean) => void;
  refreshConfig: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<BrokerSession | null>(null);
  const [configStatus, setConfigStatus] = useState<ConfigStatus | null>(null);
  const [paperMode, setPaperModeState] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  const refreshConfig = useCallback(async () => {
    try {
      const cfg = await api.configStatus();
      setConfigStatus(cfg);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    refreshConfig();
    AsyncStorage.getItem('paperMode').then(v => {
      if (v !== null) setPaperModeState(v === 'true');
    });
    AsyncStorage.getItem('session').then(s => {
      if (s) {
        try { setSession(JSON.parse(s)); } catch { /* ignore */ }
      }
    });
  }, [refreshConfig]);

  const connectBroker = useCallback(async () => {
    setIsConnecting(true);
    setConnectError('');
    try {
      const res = await api.autoLogin();
      if (res.status && res.data) {
        const d = res.data as Record<string, unknown>;
        const s: BrokerSession = {
          jwtToken: d._jwtToken as string || d.jwtToken as string || '',
          refreshToken: d._refreshToken as string || d.refreshToken as string || '',
          feedToken: d._feedToken as string || d.feedToken as string || '',
          clientId: d._clientCode as string || '',
          clientName: d._name as string || 'Trader',
          email: d._email as string || '',
          exchanges: (d._exchanges as string[]) || ['NSE', 'BSE'],
          products: (d._products as string[]) || ['DELIVERY', 'INTRADAY'],
        };
        setSession(s);
        await AsyncStorage.setItem('session', JSON.stringify(s));
      } else {
        setConnectError('Login failed. Check your credentials.');
      }
    } catch (e: unknown) {
      setConnectError(e instanceof Error ? e.message : 'Connection failed');
    } finally {
      setIsConnecting(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setSession(null);
    await AsyncStorage.removeItem('session');
  }, []);

  const setPaperMode = useCallback((v: boolean) => {
    setPaperModeState(v);
    AsyncStorage.setItem('paperMode', String(v));
  }, []);

  return (
    <Ctx.Provider value={{
      session, configStatus, paperMode, isConnecting, connectError,
      connectBroker, disconnect, setPaperMode, refreshConfig,
    }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
