import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api, type BrokerSession, type ConfigStatus } from '@/lib/api';

export interface SavedCredentials {
  clientCode: string;
  password: string;
  apiKey: string;
  totpSecret: string;
}

interface AppState {
  session: BrokerSession | null;
  configStatus: ConfigStatus | null;
  savedCredentials: SavedCredentials | null;
  paperMode: boolean;
  isConnecting: boolean;
  connectError: string;
  connectBroker: () => Promise<void>;
  connectWithSaved: () => Promise<void>;
  saveCredentials: (creds: SavedCredentials) => Promise<void>;
  clearCredentials: () => Promise<void>;
  disconnect: () => void;
  setPaperMode: (v: boolean) => void;
  refreshConfig: () => void;
}

const Ctx = createContext<AppState | null>(null);

const CREDS_KEY = 'angelone_credentials';
const SESSION_KEY = 'angelone_session';
const PAPER_KEY = 'paperMode';

function buildSession(d: Record<string, unknown>): BrokerSession {
  return {
    jwtToken: (d.jwtToken as string) || '',
    refreshToken: (d.refreshToken as string) || '',
    feedToken: (d.feedToken as string) || '',
    clientId: (d._clientCode as string) || '',
    clientName: (d._name as string) || 'Trader',
    email: (d._email as string) || '',
    exchanges: (d._exchanges as string[]) || ['NSE', 'BSE'],
    products: (d._products as string[]) || ['DELIVERY', 'INTRADAY'],
  };
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<BrokerSession | null>(null);
  const [savedCredentials, setSavedCredentials] = useState<SavedCredentials | null>(null);
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

  // Load persisted data on mount
  useEffect(() => {
    refreshConfig();
    AsyncStorage.multiGet([PAPER_KEY, SESSION_KEY, CREDS_KEY]).then(pairs => {
      const [paperPair, sessionPair, credsPair] = pairs;
      if (paperPair[1] !== null) setPaperModeState(paperPair[1] === 'true');
      if (sessionPair[1]) {
        try { setSession(JSON.parse(sessionPair[1])); } catch { /* ignore */ }
      }
      if (credsPair[1]) {
        try { setSavedCredentials(JSON.parse(credsPair[1])); } catch { /* ignore */ }
      }
    });
  }, [refreshConfig]);

  // Internal login helper
  const doLogin = useCallback(async (creds?: SavedCredentials) => {
    setIsConnecting(true);
    setConnectError('');
    try {
      const res = await api.autoLogin(creds);
      if (res.status && res.data) {
        const s = buildSession(res.data);
        setSession(s);
        await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(s));
      } else {
        setConnectError(res.message || 'Login failed. Check your credentials.');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Connection failed';
      setConnectError(msg);
    } finally {
      setIsConnecting(false);
    }
  }, []);

  // Connect using saved credentials (if any), else use server env vars
  const connectBroker = useCallback(async () => {
    const credsRaw = await AsyncStorage.getItem(CREDS_KEY);
    const creds = credsRaw ? JSON.parse(credsRaw) as SavedCredentials : undefined;
    await doLogin(creds);
  }, [doLogin]);

  // Explicit quick connect using in-memory saved credentials
  const connectWithSaved = useCallback(async () => {
    if (!savedCredentials) return;
    await doLogin(savedCredentials);
  }, [savedCredentials, doLogin]);

  // Save new credentials and immediately connect
  const saveCredentials = useCallback(async (creds: SavedCredentials) => {
    await AsyncStorage.setItem(CREDS_KEY, JSON.stringify(creds));
    setSavedCredentials(creds);
    await doLogin(creds);
  }, [doLogin]);

  // Wipe saved credentials (but keep session if active)
  const clearCredentials = useCallback(async () => {
    await AsyncStorage.removeItem(CREDS_KEY);
    setSavedCredentials(null);
  }, []);

  const disconnect = useCallback(async () => {
    setSession(null);
    await AsyncStorage.removeItem(SESSION_KEY);
  }, []);

  const setPaperMode = useCallback((v: boolean) => {
    setPaperModeState(v);
    AsyncStorage.setItem(PAPER_KEY, String(v));
  }, []);

  return (
    <Ctx.Provider value={{
      session, configStatus, savedCredentials, paperMode,
      isConnecting, connectError,
      connectBroker, connectWithSaved, saveCredentials,
      clearCredentials, disconnect, setPaperMode, refreshConfig,
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
