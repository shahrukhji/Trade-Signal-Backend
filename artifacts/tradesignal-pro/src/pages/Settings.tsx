import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/use-store';
import { angelOne, type WalletBalance } from '@/broker/angelOne';
import {
  Shield, BrainCircuit, Sliders, BellRing, Link as LinkIcon,
  CheckCircle2, AlertCircle, LogOut, User, Loader2, Eye, EyeOff,
  Wifi, WifiOff, Key, Building2, RefreshCw, Clock, TrendingUp,
  DollarSign, Activity, BookOpen, ChevronDown, ChevronRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

// ─── Market Status Helper ────────────────────────────────────────────────────
function getMarketStatus(): { open: boolean; label: string; next: string } {
  const now = new Date();
  // Convert to IST (UTC+5:30)
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
  const day = ist.getUTCDay(); // 0=Sun, 6=Sat
  const h = ist.getUTCHours();
  const m = ist.getUTCMinutes();
  const mins = h * 60 + m;

  const open = 9 * 60 + 15;   // 9:15 AM
  const close = 15 * 60 + 30; // 3:30 PM

  const isWeekday = day >= 1 && day <= 5;
  const isOpen = isWeekday && mins >= open && mins < close;

  let next = '';
  if (!isOpen) {
    if (!isWeekday || mins >= close) {
      next = 'Opens Mon 9:15 AM IST';
      if (isWeekday && mins < open) next = 'Opens at 9:15 AM IST';
      if (isWeekday && mins >= close) next = 'Opens tomorrow 9:15 AM IST';
    }
  }

  return {
    open: isOpen,
    label: isOpen ? 'MARKET OPEN' : 'MARKET CLOSED',
    next,
  };
}

const API_ENDPOINT = 'https://apiconnect.angelone.in';

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}`;

// ─── Component ───────────────────────────────────────────────────────────────
export function Settings() {
  const {
    paperMode, setPaperMode,
    tradingPrefs, updatePrefs,
    brokerSession, brokerProfile, brokerIsDemo, brokerApiKey,
    setBrokerSession, clearBrokerSession,
    geminiConfig, setGeminiConfig,
  } = useStore();

  const [activeTab, setActiveTab] = useState('broker');

  // Broker form
  const [clientId, setClientId] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [quickConnectLoading, setQuickConnectLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [configStatus, setConfigStatus] = useState<{
    allConfigured: boolean; hasTotpSecret: boolean;
    hasClientCode: boolean; hasApiKey: boolean;
  } | null>(null);

  // Post-login data
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());

  // AI form
  const [aiApiKey, setAiApiKey] = useState(geminiConfig.apiKey || '');
  const [aiProvider, setAiProvider] = useState('Google Gemini');
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);

  const isConnected = !!brokerSession && !brokerIsDemo;

  // Restore session on mount + check pre-configured secrets
  useEffect(() => {
    if (brokerSession && brokerApiKey) {
      angelOne.restoreSession(brokerSession, brokerIsDemo, brokerApiKey);
    }
    if (brokerProfile) setClientId(brokerProfile.clientId);
    // Check which secrets are already configured on the server
    fetch('/api/broker-proxy/config-status')
      .then((r) => r.json())
      .then(setConfigStatus)
      .catch(() => {});
  }, []);

  // Refresh market status every 30s
  useEffect(() => {
    const t = setInterval(() => setMarketStatus(getMarketStatus()), 30000);
    return () => clearInterval(t);
  }, []);

  // Fetch wallet when connected
  const fetchWallet = useCallback(async () => {
    if (!isConnected) return;
    setWalletLoading(true);
    try {
      const bal = await angelOne.getWalletBalance();
      setWallet(bal);
    } catch (_) {}
    setWalletLoading(false);
  }, [isConnected]);

  useEffect(() => {
    if (isConnected) fetchWallet();
  }, [isConnected]);

  // Quick Connect — uses env-configured credentials (TOTP auto-generated server-side)
  const handleQuickConnect = async () => {
    setQuickConnectLoading(true);
    setLoginError('');
    try {
      const res = await fetch('/api/broker-proxy/auto-login', { method: 'POST' });
      const data = await res.json();
      if (data.status && data.data) {
        const d = data.data;
        // Profile data comes from _name/_email/_exchanges (fetched server-side after login)
        const clientName = d._name || 'Trader';
        const session = {
          jwtToken: d.jwtToken,
          refreshToken: d.refreshToken,
          feedToken: d.feedToken,
          clientId: d._clientCode || '',
          clientName,
          email: d._email || '',
          phone: d._phone || '',
          exchanges: d._exchanges || ['NSE', 'BSE'],
          products: d._products || ['DELIVERY', 'INTRADAY'],
          lastLoginTime: new Date().toISOString(),
          broker: 'Angel One',
        };
        const savedApiKey = d._apiKey || '';
        await angelOne.restoreSession(session, false, savedApiKey);
        const initials = clientName.split(' ').filter(Boolean).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) || 'T';
        const profile = {
          clientId: session.clientId,
          clientName,
          email: session.email,
          phone: session.phone,
          pan: 'XXXXX0000X',
          dematId: '',
          broker: 'Angel One',
          exchanges: session.exchanges,
          products: session.products,
          lastLoginTime: session.lastLoginTime,
          avatarInitials: initials,
        };
        setBrokerSession(session, profile, false, savedApiKey);
        toast.success(`Connected as ${clientName}`);
        setTimeout(async () => { const bal = await angelOne.getWalletBalance(); setWallet(bal); }, 800);
      } else {
        setLoginError(data.message || 'Quick Connect failed. Check your Replit secrets.');
      }
    } catch (err: any) {
      setLoginError('Quick Connect error: ' + (err?.message || 'Unknown'));
    }
    setQuickConnectLoading(false);
  };

  const handleConnect = async () => {
    if (!clientId.trim()) { setLoginError('Client ID is required'); return; }
    if (!password.trim()) { setLoginError('Password / PIN is required'); return; }
    // API key required only if not already configured via env var
    if (!configStatus?.hasApiKey && !apiKey.trim()) {
      setLoginError('SmartAPI Key is required'); return;
    }

    setLoginLoading(true);
    setLoginError('');

    // TOTP is auto-injected server-side; pass empty so proxy generates it from env var.
    // API key from form (or proxy uses env var if empty).
    const result = await angelOne.login(
      { clientId: clientId.trim().toUpperCase(), password: password.trim(), apiKey: apiKey.trim(), totp: '' },
      { strict: true }
    );

    if (result.success && result.session && result.profile) {
      setBrokerSession(result.session, result.profile, false, apiKey.trim());
      toast.success(`Connected as ${result.profile.clientName}`);
      // Fetch wallet after connecting
      setTimeout(async () => {
        const bal = await angelOne.getWalletBalance();
        setWallet(bal);
      }, 800);
    } else {
      setLoginError(result.error || 'Login failed. Verify your credentials and try again.');
    }

    setLoginLoading(false);
  };

  const handleDisconnect = async () => {
    await angelOne.logout();
    clearBrokerSession();
    setWallet(null);
    toast.info('Disconnected from Angel One');
  };

  const handleTestAI = async () => {
    if (!aiApiKey.trim()) { toast.error('Enter an API key first'); return; }
    setAiTesting(true);
    await new Promise((r) => setTimeout(r, 1500));
    setGeminiConfig({ apiKey: aiApiKey, status: 'ACTIVE' });
    toast.success('AI connection verified!');
    setAiTesting(false);
  };

  const TABS = [
    { id: 'broker', icon: LinkIcon, label: 'Broker' },
    { id: 'ai', icon: BrainCircuit, label: 'AI Engine' },
    { id: 'prefs', icon: Sliders, label: 'Trading' },
    { id: 'alerts', icon: BellRing, label: 'Alerts' },
    { id: 'guide', icon: BookOpen, label: 'Guide' },
  ];

  return (
    <div className="p-4 pt-10 min-h-screen pb-28">
      <h1 className="text-2xl font-bold text-foreground mb-5">Settings</h1>

      {/* Status Bar */}
      <div className="glass-panel border border-border rounded-2xl p-3 mb-5 flex gap-2">
        {/* Broker status */}
        <div className={`flex-1 rounded-xl p-3 border flex flex-col gap-1 ${isConnected ? 'bg-primary/5 border-primary/20' : 'bg-input border-white/5'}`}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Broker</p>
          {isConnected ? (
            <p className="font-bold text-xs text-primary flex items-center gap-1">
              <Wifi size={11} /> Connected
            </p>
          ) : (
            <p className="font-bold text-xs text-muted-foreground flex items-center gap-1">
              <WifiOff size={11} /> Disconnected
            </p>
          )}
        </div>
        {/* Market status */}
        <div className={`flex-1 rounded-xl p-3 border flex flex-col gap-1 ${marketStatus.open ? 'bg-primary/5 border-primary/20' : 'bg-input border-white/5'}`}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Market</p>
          <p className={`font-bold text-xs flex items-center gap-1 ${marketStatus.open ? 'text-primary' : 'text-yellow-400'}`}>
            <Activity size={11} /> {marketStatus.open ? 'OPEN' : 'CLOSED'}
          </p>
        </div>
        {/* AI status */}
        <div className={`flex-1 rounded-xl p-3 border flex flex-col gap-1 ${geminiConfig.status === 'ACTIVE' ? 'bg-accent/5 border-accent/20' : 'bg-input border-white/5'}`}>
          <p className="text-[9px] text-muted-foreground uppercase tracking-wider">AI</p>
          {geminiConfig.status === 'ACTIVE' ? (
            <p className="font-bold text-xs text-accent flex items-center gap-1">
              <CheckCircle2 size={11} /> Active
            </p>
          ) : (
            <p className="font-bold text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle size={11} /> Not Set
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-input p-1 rounded-xl mb-5 overflow-x-auto no-scrollbar">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 min-w-[72px] py-2 text-[11px] font-bold rounded-lg transition-all flex flex-col items-center gap-1 ${
                activeTab === t.id ? 'bg-card text-foreground shadow border border-white/5' : 'text-muted-foreground'
              }`}
            >
              <Icon size={15} />
              {t.label}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          className="space-y-4"
        >

          {/* ═══════════════ BROKER TAB ═══════════════ */}
          {activeTab === 'broker' && (
            <>
              {/* API Endpoint Info */}
              <div className="bg-input border border-white/5 rounded-xl px-4 py-2.5 flex items-center gap-2">
                <Building2 size={13} className="text-accent flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide">API Endpoint</p>
                  <p className="text-[11px] font-mono text-foreground truncate">{API_ENDPOINT}</p>
                </div>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isConnected ? 'bg-primary animate-pulse' : 'bg-muted-foreground/40'}`} />
              </div>

              {/* ── CONNECTED STATE ── */}
              {isConnected && brokerProfile ? (
                <div className="space-y-3">
                  {/* Profile Card */}
                  <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/30 rounded-2xl p-4">
                    <div className="flex items-center gap-3 mb-1">
                      <div className="w-14 h-14 rounded-2xl bg-primary/20 border-2 border-primary/40 flex items-center justify-center flex-shrink-0">
                        <span className="text-primary font-black text-xl">{brokerProfile.avatarInitials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[9px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wide flex items-center gap-1">
                            <CheckCircle2 size={9} /> Live Connected
                          </span>
                        </div>
                        <h3 className="font-black text-lg text-foreground leading-tight truncate">
                          {brokerProfile.clientName}
                        </h3>
                        <p className="text-xs text-muted-foreground font-mono">{brokerProfile.clientId}</p>
                      </div>
                    </div>
                  </div>

                  {/* Market Status Card */}
                  <div className={`rounded-2xl p-3.5 border flex items-center justify-between ${marketStatus.open ? 'bg-primary/10 border-primary/30' : 'bg-yellow-500/10 border-yellow-500/30'}`}>
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${marketStatus.open ? 'bg-primary animate-pulse' : 'bg-yellow-400'}`} />
                      <div>
                        <p className={`font-black text-sm ${marketStatus.open ? 'text-primary' : 'text-yellow-400'}`}>
                          {marketStatus.label}
                        </p>
                        {!marketStatus.open && marketStatus.next && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock size={9} /> {marketStatus.next}
                          </p>
                        )}
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">NSE / BSE</p>
                  </div>

                  {/* Wallet Balance */}
                  <div className="glass-panel border border-border rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <DollarSign size={14} className="text-accent" />
                        <h3 className="text-sm font-bold text-foreground">Wallet Balance</h3>
                      </div>
                      <button
                        onClick={fetchWallet}
                        disabled={walletLoading}
                        className="p-1.5 rounded-lg bg-input border border-white/5 active:scale-90 transition-transform"
                      >
                        <RefreshCw size={12} className={`text-muted-foreground ${walletLoading ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    {wallet ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                          <p className="text-[9px] text-muted-foreground uppercase mb-1">Available Cash</p>
                          <p className="font-black text-base text-primary">{fmtINR(wallet.availableCash)}</p>
                        </div>
                        <div className="bg-input border border-white/5 rounded-xl p-3">
                          <p className="text-[9px] text-muted-foreground uppercase mb-1">Used Margin</p>
                          <p className="font-black text-base text-foreground">{fmtINR(wallet.usedMargin)}</p>
                        </div>
                        <div className="bg-input border border-white/5 rounded-xl p-3">
                          <p className="text-[9px] text-muted-foreground uppercase mb-1">Total Margin</p>
                          <p className="font-bold text-sm text-foreground">{fmtINR(wallet.totalMargin)}</p>
                        </div>
                        <div className={`rounded-xl p-3 border ${wallet.todayPnL >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5 border-destructive/20'}`}>
                          <p className="text-[9px] text-muted-foreground uppercase mb-1">Today P&L</p>
                          <p className={`font-black text-base ${wallet.todayPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
                            {wallet.todayPnL >= 0 ? '+' : ''}{fmtINR(wallet.todayPnL)}
                          </p>
                        </div>
                        {wallet.collateral > 0 && (
                          <div className="bg-input border border-white/5 rounded-xl p-3 col-span-2">
                            <p className="text-[9px] text-muted-foreground uppercase mb-1">Collateral</p>
                            <p className="font-bold text-sm text-foreground">{fmtINR(wallet.collateral)}</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <Loader2 size={20} className="animate-spin text-accent mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">Loading balance...</p>
                      </div>
                    )}
                  </div>

                  {/* Account Info Grid */}
                  <div className="glass-panel border border-border rounded-2xl p-4">
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                      <User size={12} /> Account Details
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-input rounded-xl p-2.5 border border-white/5">
                        <p className="text-[9px] text-muted-foreground mb-0.5">Broker</p>
                        <p className="text-xs font-bold text-foreground">{brokerProfile.broker}</p>
                      </div>
                      <div className="bg-input rounded-xl p-2.5 border border-white/5">
                        <p className="text-[9px] text-muted-foreground mb-0.5">Email</p>
                        <p className="text-xs font-bold text-foreground truncate">{brokerProfile.email || '—'}</p>
                      </div>
                      <div className="bg-input rounded-xl p-2.5 border border-white/5">
                        <p className="text-[9px] text-muted-foreground mb-0.5">Exchanges</p>
                        <p className="text-xs font-bold text-foreground">{brokerProfile.exchanges.join(' · ')}</p>
                      </div>
                      <div className="bg-input rounded-xl p-2.5 border border-white/5">
                        <p className="text-[9px] text-muted-foreground mb-0.5">Products</p>
                        <p className="text-xs font-bold text-foreground truncate">{brokerProfile.products.join(', ')}</p>
                      </div>
                      <div className="bg-input rounded-xl p-2.5 border border-white/5 col-span-2">
                        <p className="text-[9px] text-muted-foreground mb-0.5">Last Login</p>
                        <p className="text-xs font-bold text-foreground">
                          {brokerProfile.lastLoginTime
                            ? new Date(brokerProfile.lastLoginTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })
                            : 'Today'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Disconnect */}
                  <button
                    onClick={handleDisconnect}
                    className="w-full h-12 bg-destructive/10 border border-destructive/30 text-destructive font-bold rounded-2xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <LogOut size={15} />
                    Disconnect from Angel One
                  </button>
                </div>
              ) : (

                /* ── LOGIN FORM ── */
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={16} className="text-accent" />
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Connect Angel One SmartAPI</h2>
                  </div>

                  {/* Quick Connect — only show if all secrets are pre-configured */}
                  {configStatus?.allConfigured && (
                    <div className="mb-3">
                      <button
                        onClick={handleQuickConnect}
                        disabled={quickConnectLoading}
                        className="w-full h-13 py-3.5 bg-gradient-to-r from-primary to-accent text-background font-black rounded-xl shadow-[0_0_28px_rgba(0,191,255,0.5)] flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
                      >
                        {quickConnectLoading ? (
                          <><Loader2 size={16} className="animate-spin" /> Connecting...</>
                        ) : (
                          <><Wifi size={16} /> Quick Connect (Auto)</>
                        )}
                      </button>
                      <p className="text-[10px] text-center text-primary/70 mt-1.5 flex items-center justify-center gap-1">
                        <CheckCircle2 size={9} /> All credentials pre-configured · TOTP auto-generated
                      </p>
                      <div className="flex items-center gap-2 my-3">
                        <div className="flex-1 h-px bg-border" />
                        <span className="text-[10px] text-muted-foreground uppercase">or enter manually</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {/* Client ID */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                        Client ID <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={clientId}
                          onChange={(e) => { setClientId(e.target.value.toUpperCase()); setLoginError(''); }}
                          placeholder="e.g. A1234567"
                          className="w-full bg-input border border-border rounded-xl h-12 pl-9 pr-3 text-sm font-mono text-foreground outline-none focus:border-accent transition-colors"
                          autoComplete="off"
                          autoCapitalize="characters"
                        />
                      </div>
                    </div>

                    {/* PIN / Password */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                        PIN / Password <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <Shield size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => { setPassword(e.target.value); setLoginError(''); }}
                          placeholder="Your Angel One login PIN"
                          className="w-full bg-input border border-border rounded-xl h-12 pl-9 pr-10 text-sm font-mono text-foreground outline-none focus:border-accent transition-colors"
                        />
                        <button
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* SmartAPI Key — hidden when already configured via env var */}
                    {configStatus?.hasApiKey ? (
                      <div className="flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-xl px-3 py-2.5">
                        <Key size={13} className="text-primary" />
                        <div>
                          <p className="text-[11px] font-semibold text-foreground">SmartAPI Key Configured ✓</p>
                          <p className="text-[9px] text-muted-foreground">ANGELONE_API_KEY is set in Replit Secrets</p>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                          SmartAPI Key <span className="text-destructive">*</span>
                        </label>
                        <div className="relative">
                          <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={apiKey}
                            onChange={(e) => { setApiKey(e.target.value); setLoginError(''); }}
                            placeholder="From smartapi.angelone.in"
                            className="w-full bg-input border border-border rounded-xl h-12 pl-9 pr-10 text-sm font-mono text-foreground outline-none focus:border-accent transition-colors"
                            autoComplete="off"
                          />
                          <button
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                          >
                            {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Create your API key at <span className="text-accent">smartapi.angelone.in</span>
                        </p>
                      </div>
                    )}

                    {/* TOTP info — auto-generated server-side */}
                    <div className="flex items-center gap-2 bg-primary/5 border border-primary/15 rounded-xl px-3 py-2.5">
                      <CheckCircle2 size={13} className={configStatus?.hasTotpSecret ? 'text-primary' : 'text-muted-foreground'} />
                      <div>
                        <p className="text-[11px] font-semibold text-foreground">
                          TOTP {configStatus?.hasTotpSecret ? 'Auto-Generated ✓' : 'Required'}
                        </p>
                        <p className="text-[9px] text-muted-foreground leading-tight">
                          {configStatus?.hasTotpSecret
                            ? 'ANGELONE_TOTP_SECRET is configured — code generated automatically'
                            : 'Set ANGELONE_TOTP_SECRET in Replit Secrets for auto-generation'}
                        </p>
                      </div>
                    </div>

                    {/* Error */}
                    <AnimatePresence>
                      {loginError && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-start gap-2"
                        >
                          <AlertCircle size={14} className="text-destructive mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-destructive">{loginError}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Connect Button */}
                    <button
                      onClick={handleConnect}
                      disabled={loginLoading}
                      className="w-full h-12 bg-accent text-background font-black rounded-xl shadow-[0_0_24px_rgba(0,191,255,0.4)] flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
                    >
                      {loginLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Connecting to Angel One...
                        </>
                      ) : (
                        <>
                          <Wifi size={16} />
                          Connect to Angel One
                        </>
                      )}
                    </button>

                    {/* Notice */}
                    <div className="bg-input border border-white/5 rounded-xl p-3">
                      <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                        🔒 Genuine credentials required — no demo mode.<br />
                        Credentials are stored locally on your device only.
                      </p>
                    </div>

                    {/* Market Status (pre-login too) */}
                    <div className={`rounded-xl p-3 border flex items-center justify-between ${marketStatus.open ? 'bg-primary/5 border-primary/20' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${marketStatus.open ? 'bg-primary animate-pulse' : 'bg-yellow-400'}`} />
                        <p className={`text-xs font-bold ${marketStatus.open ? 'text-primary' : 'text-yellow-400'}`}>
                          {marketStatus.label}
                        </p>
                      </div>
                      {!marketStatus.open && marketStatus.next && (
                        <p className="text-[10px] text-muted-foreground">{marketStatus.next}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ═══════════════ AI TAB ═══════════════ */}
          {activeTab === 'ai' && (
            <>
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">AI Configuration</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Provider</label>
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    className="w-full bg-input border border-border rounded-xl h-12 px-3 text-sm text-foreground outline-none focus:border-accent"
                  >
                    <option>Google Gemini</option>
                    <option>OpenAI ChatGPT</option>
                    <option>Anthropic Claude</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">API Key</label>
                  <div className="relative">
                    <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type={showAiKey ? 'text' : 'password'}
                      value={aiApiKey}
                      onChange={(e) => setAiApiKey(e.target.value)}
                      placeholder="Paste your API key here"
                      className="w-full bg-input border border-border rounded-xl h-12 pl-9 pr-10 text-sm font-mono text-foreground outline-none focus:border-accent transition-colors"
                    />
                    <button
                      onClick={() => setShowAiKey(!showAiKey)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    >
                      {showAiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>
                <button
                  onClick={handleTestAI}
                  disabled={aiTesting}
                  className="w-full h-12 bg-[#FFD700] text-background font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
                >
                  {aiTesting ? (
                    <><Loader2 size={16} className="animate-spin" /> Testing...</>
                  ) : (
                    <><BrainCircuit size={16} /> Test AI Connection</>
                  )}
                </button>
                {geminiConfig.status === 'ACTIVE' && (
                  <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 rounded-xl p-3">
                    <CheckCircle2 size={14} className="text-primary flex-shrink-0" />
                    <p className="text-xs text-primary font-medium">AI engine is active and ready for analysis</p>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ═══════════════ PREFS TAB ═══════════════ */}
          {activeTab === 'prefs' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 glass-panel border border-destructive/30 rounded-xl">
                <div>
                  <h3 className="font-bold text-destructive flex items-center gap-2"><Shield size={16} /> Paper Trading</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Use virtual ₹10L — no real money.</p>
                </div>
                <button
                  onClick={() => setPaperMode(!paperMode)}
                  className={`w-12 h-6 rounded-full transition-colors relative flex-shrink-0 ${paperMode ? 'bg-destructive' : 'bg-input border border-border'}`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${paperMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Trading Mode</label>
                  <select
                    value={tradingPrefs.mode}
                    onChange={(e) => updatePrefs({ mode: e.target.value })}
                    className="w-full bg-input border border-border rounded-xl h-12 px-3 text-sm text-foreground outline-none focus:border-accent"
                  >
                    <option>Intraday</option>
                    <option>Swing</option>
                    <option>Scalping</option>
                    <option>Options</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Product Type</label>
                  <select
                    value={tradingPrefs.product}
                    onChange={(e) => updatePrefs({ product: e.target.value })}
                    className="w-full bg-input border border-border rounded-xl h-12 px-3 text-sm text-foreground outline-none focus:border-accent"
                  >
                    <option value="MIS">MIS (Intraday)</option>
                    <option value="DELIVERY">CNC (Delivery)</option>
                    <option value="MARGIN">MARGIN</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Default Quantity</label>
                  <input
                    type="number"
                    value={tradingPrefs.defaultQty}
                    onChange={(e) => updatePrefs({ defaultQty: Number(e.target.value) })}
                    min={1}
                    className="w-full bg-input border border-border rounded-xl h-12 px-3 text-sm font-mono text-foreground outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Risk Level</label>
                  <select
                    value={tradingPrefs.riskLevel}
                    onChange={(e) => updatePrefs({ riskLevel: e.target.value })}
                    className="w-full bg-input border border-border rounded-xl h-12 px-3 text-sm text-foreground outline-none focus:border-accent"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Aggressive</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════ ALERTS TAB ═══════════════ */}
          {activeTab === 'alerts' && (
            <div className="p-6 bg-input rounded-xl border border-white/5 text-center">
              <BellRing className="mx-auto text-accent mb-3" size={36} />
              <h3 className="font-bold text-foreground text-base">Price Alerts</h3>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Enable notifications to receive real-time AI signal triggers and price movement alerts.
              </p>
              <button className="mt-4 px-8 py-2.5 bg-card border border-border rounded-xl text-sm font-bold active:scale-95 transition-transform">
                Enable Notifications
              </button>
            </div>
          )}

          {/* ═══════════════ GUIDE TAB ═══════════════ */}
          {activeTab === 'guide' && <GuideTab />}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Guide Tab Component ─────────────────────────────────────────────────────

function AccordionSection({ title, icon, children, defaultOpen = false }: {
  title: string; icon: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-card border border-white/5 rounded-2xl overflow-hidden mb-3">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3.5 active:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{icon}</span>
          <span className="font-bold text-sm text-foreground">{title}</span>
        </div>
        {open ? <ChevronDown size={16} className="text-muted-foreground" /> : <ChevronRight size={16} className="text-muted-foreground" />}
      </button>
      {open && <div className="px-4 pb-4 border-t border-white/5 pt-3">{children}</div>}
    </div>
  );
}

function GuideTag({ label, color }: { label: string; color: 'green' | 'red' | 'blue' | 'yellow' | 'gray' }) {
  const colors = {
    green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
    red: 'bg-red-500/15 text-red-400 border-red-500/20',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
    yellow: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20',
    gray: 'bg-white/5 text-muted-foreground border-white/10',
  };
  return (
    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border ${colors[color]}`}>{label}</span>
  );
}

function GuideRow({ label, value, badge }: { label: string; value: string; badge?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 py-2 border-b border-white/5 last:border-0">
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground">{label}</span>
          {badge}
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{value}</p>
      </div>
    </div>
  );
}

function GuideTab() {
  return (
    <div className="space-y-1">

      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-accent/15 to-primary/10 border border-accent/20 rounded-2xl p-4 mb-4 text-center">
        <div className="text-3xl mb-2">📖</div>
        <h2 className="font-bold text-base text-foreground">TradeSignal Pro Guide</h2>
        <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
          Complete reference for all features, strategies, and indicators. Built for Indian equity markets (NSE/BSE).
        </p>
      </div>

      {/* ── QUICK START ── */}
      <AccordionSection title="Quick Start — Get Going in 5 Minutes" icon="🚀" defaultOpen={true}>
        <div className="space-y-3">
          {[
            { step: '1', title: 'Connect Angel One', desc: 'Go to Broker tab → tap Quick Connect (Auto). Your credentials are pre-configured. Takes ~3 seconds to log in.' },
            { step: '2', title: 'Open the Charts tab', desc: 'Search for any NSE/BSE stock using the search bar. Select a timeframe (1m, 5m, 15m, 1D, 1W). Candles load automatically from Angel One.' },
            { step: '3', title: 'Run the Smart Scanner', desc: 'Go to Scanner tab → tap Scan All. The app scans Nifty 50 stocks for signals using all indicators. Results appear sorted by strength.' },
            { step: '4', title: 'Pick a Strategy', desc: 'Go to Strategy Lab tab. The AI recommends the best strategy for current market conditions. Tap any strategy card to see entry/exit rules.' },
            { step: '5', title: 'Paper Trade First', desc: 'Paper Trading is ON by default (Broker tab toggle). Practice with virtual ₹10 Lakh before using real money. Watch how signals play out.' },
          ].map(s => (
            <div key={s.step} className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0 text-xs font-black text-accent">{s.step}</div>
              <div>
                <p className="text-xs font-bold text-foreground">{s.title}</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* ── APP NAVIGATION ── */}
      <AccordionSection title="App Navigation — 8 Tabs Explained" icon="📱">
        <div className="space-y-0">
          {[
            { tab: '🏠 Home', desc: 'Market overview dashboard. Shows Nifty 50 / Sensex live status, top movers, current market session (Pre-Open / Normal / Post-Close), and quick market stats.' },
            { tab: '📈 Charts', desc: 'Full-screen candlestick chart using TradingView Lightweight Charts v5. Search any stock, switch timeframes, overlay indicators (EMA, Bollinger, VWAP), see pattern alerts directly on the chart.' },
            { tab: '⚡ Signals', desc: 'Real-time trading signals for Nifty 50 stocks. Each signal shows BUY/SELL/NEUTRAL with a confluence score (0–100), the indicator combination that triggered it, entry price, stop-loss, and target.' },
            { tab: '🎯 Strategy Lab', desc: 'All 10 trading strategies with AI-based market condition detection. The app analyses current trend, volatility, and ADX to recommend the best strategy. Tap any strategy to backtest it on a selected stock.' },
            { tab: '🔍 Scanner', desc: 'Multi-filter stock screener across Nifty 50. Filters: Breakout, Oversold RSI, Strong Momentum, VWAP Bounce, High Volume. Results show signal, score, and price action summary.' },
            { tab: '💼 Portfolio', desc: 'Live portfolio from Angel One — holdings, positions, P&L (realized + unrealized), day change, and order book. Refresh pulls latest data from broker API.' },
            { tab: '👤 Account', desc: 'Broker account profile, funds available, margins, and order management. Cancel pending orders directly from here. Shows real client name, exchanges, and product types.' },
            { tab: '⚙️ Settings', desc: 'Broker connection, AI Engine config, trading preferences, alerts, and this guide. All configuration in one place.' },
          ].map(t => (
            <div key={t.tab} className="py-2.5 border-b border-white/5 last:border-0">
              <p className="text-xs font-bold text-foreground">{t.tab}</p>
              <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5">{t.desc}</p>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* ── ANGEL ONE CONNECTION ── */}
      <AccordionSection title="Angel One Connection Guide" icon="🔗">
        <div className="space-y-3">
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-3">
            <p className="text-[11px] font-bold text-accent mb-1">Recommended: Quick Connect (Auto)</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">All your credentials (Client Code, PIN, API Key, TOTP Secret) are pre-configured in Replit Secrets. Just tap Quick Connect — the app logs in automatically and generates TOTP internally.</p>
          </div>
          <div className="bg-white/3 border border-white/8 rounded-xl p-3">
            <p className="text-[11px] font-bold text-foreground mb-1">Manual Connection</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">Enter Client ID + Trading PIN. The TOTP is still auto-generated server-side (no authenticator app needed). SmartAPI key is shown as configured if already set.</p>
          </div>
          {[
            { q: 'SmartAPI Key', a: 'Your unique API key from smartapi.angelone.in. Required for all API calls. Set once in Replit Secrets as ANGELONE_API_KEY.' },
            { q: 'TOTP Auto-Generation', a: 'The server uses your TOTP secret (ANGELONE_TOTP_SECRET) to generate a 6-digit TOTP code automatically via RFC 6238 algorithm — same as Google Authenticator. No manual entry needed.' },
            { q: 'Paper Trading Toggle', a: 'Controls whether orders go to Angel One (real) or are simulated locally. Default is ON (safe). When OFF, real orders are placed. Switch with caution.' },
            { q: 'Session Expiry', a: 'Angel One JWT tokens are valid for 24 hours. The app automatically refreshes them. If you see "Session expired", tap Quick Connect again.' },
          ].map(item => (
            <GuideRow key={item.q} label={item.q} value={item.a} />
          ))}
        </div>
      </AccordionSection>

      {/* ── STRATEGIES ── */}
      <AccordionSection title="10 Trading Strategies — Full Details" icon="🎯">
        <div className="space-y-4">
          {[
            {
              name: '📈 EMA Crossover Momentum', id: 'ema_crossover', style: 'Trend Following',
              desc: 'Trades the crossover of fast EMA9 over slow EMA21, confirmed by price above EMA50 and above-average volume.',
              entry: 'EMA9 crosses ABOVE EMA21 + price is above EMA50 + volume > 20-day average', exit: 'EMA9 crosses BELOW EMA21 OR price closes below EMA50',
              sl: '2% below entry candle low', best: 'Trending markets, Nifty 50 large-caps', timeframe: '15m / 1H / 1D',
            },
            {
              name: '🎯 RSI Oversold Bounce', id: 'rsi_bounce', style: 'Mean Reversion',
              desc: 'Buys when RSI dips below 30 (oversold) and starts turning up near a support level.',
              entry: 'RSI drops below 30 AND RSI starts rising (RSI[now] > RSI[prev]) AND price near support', exit: 'RSI crosses above 70 (overbought) OR hits target price',
              sl: 'Below the swing low at entry', best: 'Sideways / mildly trending markets', timeframe: '5m / 15m / 1H',
            },
            {
              name: '🔄 MACD Divergence Reversal', id: 'macd_divergence', style: 'Momentum Reversal',
              desc: 'Detects bullish/bearish MACD crossover (MACD line crossing signal line), trades the momentum shift.',
              entry: 'MACD line crosses ABOVE signal line (bullish) OR BELOW (bearish). Histogram turns positive.', exit: 'MACD crosses back OR histogram turns negative',
              sl: '1.5 ATR below entry', best: 'Post-consolidation breakouts', timeframe: '15m / 1H / 1D',
            },
            {
              name: '🚀 Supertrend Trend Rider', id: 'supertrend', style: 'Trend Following',
              desc: 'Rides the trend using Supertrend indicator (ATR multiplier 3, period 10). Enters on green flip, exits on red flip.',
              entry: 'Supertrend flips from RED to GREEN (price crosses above)', exit: 'Supertrend flips from GREEN to RED',
              sl: 'Supertrend line itself acts as trailing stop-loss', best: 'Strong trending markets', timeframe: '15m / 1H / 1D',
            },
            {
              name: '🌊 Bollinger Mean Reversion', id: 'bb_mean_reversion', style: 'Mean Reversion',
              desc: 'Buys at lower Bollinger Band with RSI < 40, targets the middle band then upper band.',
              entry: 'Price touches or crosses below lower BB AND RSI < 40 (not in freefall)', exit: 'Price reaches middle BB (50% target) OR upper BB (full target)',
              sl: '1% below lower Bollinger Band', best: 'Range-bound / choppy markets', timeframe: '5m / 15m',
            },
            {
              name: '💥 Bollinger Squeeze Breakout', id: 'bb_squeeze', style: 'Volatility Breakout',
              desc: 'Waits for BB squeeze (bandwidth < 5% of price, low volatility), then trades the explosive breakout.',
              entry: 'BB bandwidth compresses to minimum → Price breaks out above/below with volume surge (>1.5x avg)', exit: 'Price reaches 2x the squeeze width from breakout point',
              sl: 'Opposite band of breakout direction', best: 'After prolonged consolidation', timeframe: '15m / 1H',
            },
            {
              name: '📊 VWAP Bounce Intraday', id: 'vwap_bounce', style: 'Intraday',
              desc: 'Intraday strategy — buys price pullbacks to VWAP (the institutional average price benchmark).',
              entry: 'Price dips to within 0.3% of VWAP + bullish candle forms at VWAP + volume uptick', exit: 'Price diverges 1%+ above VWAP OR end of session (3:20 PM)',
              sl: '0.5% below VWAP level', best: 'Trending intraday days (not choppy)', timeframe: '1m / 5m / 15m',
            },
            {
              name: '⬇️⬆️ Trend Pullback Entry', id: 'trend_pullback', style: 'Trend Following',
              desc: 'In a confirmed uptrend (EMA20 > EMA50 > EMA200), buys dips to the EMA20/50 zone.',
              entry: 'EMA20 > EMA50 > EMA200 (uptrend confirmed) AND price pulls back to EMA20 or EMA50 zone', exit: 'Price reaches previous high OR a new swing high forms',
              sl: 'Below EMA50 (invalidation of pullback)', best: 'Strong sustained uptrends', timeframe: '1H / 1D',
            },
            {
              name: '🔥 Support/Resistance Breakout', id: 'sr_breakout', style: 'Breakout',
              desc: 'Trades breakouts above resistance or breakdowns below support with 1.5x volume confirmation.',
              entry: 'Price closes ABOVE resistance (last 20-bar high) with volume > 1.5x average (breakout). OR BELOW support (last 20-bar low) with volume confirmation (breakdown).', exit: 'Resistance becomes support (for long) OR measured move = height of base',
              sl: 'Back below the breakout level (false breakout protection)', best: 'Stocks near all-time highs or long bases', timeframe: '1H / 1D',
            },
            {
              name: '↔️ Range Bound Trader', id: 'range_bound', style: 'Mean Reversion',
              desc: 'When ADX < 25 (market ranging), buys at support and sells at resistance.',
              entry: 'ADX < 25 (no strong trend) AND price near support (lower range) with RSI < 45', exit: 'Price reaches upper range / resistance AND RSI > 55',
              sl: '1% below support level (range break invalidation)', best: 'Sideways consolidating stocks', timeframe: '15m / 1H',
            },
          ].map(s => (
            <div key={s.id} className="bg-input border border-white/5 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-bold text-foreground leading-snug">{s.name}</p>
                <GuideTag label={s.style} color={s.style === 'Trend Following' ? 'blue' : s.style === 'Mean Reversion' ? 'yellow' : s.style === 'Breakout' ? 'green' : s.style === 'Intraday' ? 'blue' : 'gray'} />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{s.desc}</p>
              <div className="grid grid-cols-1 gap-1 mt-1">
                <div className="bg-emerald-500/8 border border-emerald-500/15 rounded-lg p-2">
                  <p className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider mb-0.5">Entry Signal</p>
                  <p className="text-[10px] text-foreground/80 leading-relaxed">{s.entry}</p>
                </div>
                <div className="bg-blue-500/8 border border-blue-500/15 rounded-lg p-2">
                  <p className="text-[9px] font-bold text-blue-400 uppercase tracking-wider mb-0.5">Exit Signal</p>
                  <p className="text-[10px] text-foreground/80 leading-relaxed">{s.exit}</p>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <div className="bg-red-500/8 border border-red-500/15 rounded-lg p-1.5">
                    <p className="text-[9px] font-bold text-red-400 mb-0.5">Stop Loss</p>
                    <p className="text-[10px] text-foreground/80">{s.sl}</p>
                  </div>
                  <div className="bg-white/3 border border-white/8 rounded-lg p-1.5">
                    <p className="text-[9px] font-bold text-muted-foreground mb-0.5">Best For</p>
                    <p className="text-[10px] text-foreground/80">{s.best}</p>
                  </div>
                  <div className="bg-white/3 border border-white/8 rounded-lg p-1.5">
                    <p className="text-[9px] font-bold text-muted-foreground mb-0.5">Timeframe</p>
                    <p className="text-[10px] text-foreground/80">{s.timeframe}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* ── INDICATORS ── */}
      <AccordionSection title="18 Technical Indicators" icon="📊">
        <div className="space-y-0">
          {[
            { name: 'SMA — Simple Moving Average', desc: 'Average of closing prices over N periods. Smooths price data. Crossovers signal trend changes. Less reactive than EMA.', params: 'Period: 20, 50, 200', use: 'Trend direction, support/resistance' },
            { name: 'EMA — Exponential Moving Average', desc: 'Like SMA but gives more weight to recent prices. Reacts faster to price changes. Used in EMA Crossover strategy (9/21/50).', params: 'Period: 9, 21, 50, 200', use: 'Trend following, crossover signals' },
            { name: 'RSI — Relative Strength Index', desc: 'Momentum oscillator 0–100. Below 30 = oversold (potential buy). Above 70 = overbought (potential sell). Divergence signals reversals.', params: 'Period: 14 (default)', use: 'Overbought/oversold, divergence' },
            { name: 'MACD — Moving Average Convergence Divergence', desc: 'Difference between EMA12 and EMA26, smoothed by EMA9 signal line. Histogram shows momentum strength. Crossovers = signals.', params: '12 / 26 / 9', use: 'Momentum, trend changes' },
            { name: 'Bollinger Bands', desc: 'Middle band (SMA20) ± 2 standard deviations. Bands widen in high volatility, narrow (squeeze) in low volatility. Price touching bands = signal.', params: 'Period: 20, Std Dev: 2', use: 'Volatility, mean reversion' },
            { name: 'Stochastic Oscillator', desc: 'Compares current price to high-low range over N periods. %K and %D lines. Below 20 = oversold, above 80 = overbought. Confirms RSI signals.', params: '%K=14, %D=3, Smooth=3', use: 'Momentum confirmation' },
            { name: 'ATR — Average True Range', desc: 'Measures market volatility as the average of true ranges over N periods. Used to set stop-losses (1.5x or 2x ATR). Higher ATR = more volatile.', params: 'Period: 14', use: 'Stop-loss sizing, volatility' },
            { name: 'Supertrend', desc: 'ATR-based trend indicator. Shows GREEN when price is above it (uptrend), RED when below (downtrend). Excellent trailing stop-loss tool.', params: 'Period: 10, Multiplier: 3', use: 'Trend direction, trailing SL' },
            { name: 'ADX — Average Directional Index', desc: 'Measures trend strength (not direction). ADX < 25 = weak/ranging market. ADX 25–50 = developing trend. ADX > 50 = strong trend. Use with +DI/-DI for direction.', params: 'Period: 14', use: 'Trend strength, strategy selection' },
            { name: 'VWAP — Volume Weighted Average Price', desc: 'Average price weighted by volume for the day. Institutional benchmark — price above VWAP = bullish intraday bias. Resets each trading session.', params: 'Intraday only', use: 'Intraday support/resistance, institutional level' },
            { name: 'OBV — On Balance Volume', desc: 'Cumulative volume indicator. Rising OBV = accumulation (bullish). Falling OBV = distribution (bearish). OBV divergence from price = warning signal.', params: 'None (uses close + volume)', use: 'Volume trend, divergence' },
            { name: 'CCI — Commodity Channel Index', desc: 'Measures how far price is from its statistical mean. Above +100 = overbought. Below -100 = oversold. Works well in cyclical stocks.', params: 'Period: 20', use: 'Cyclical turning points' },
            { name: 'Williams %R', desc: 'Momentum oscillator -100 to 0. Near 0 = overbought. Near -100 = oversold. Similar to Stochastic but inverted. Good for short-term reversals.', params: 'Period: 14', use: 'Short-term reversal timing' },
            { name: 'MFI — Money Flow Index', desc: 'Volume-weighted RSI. Combines price and volume. MFI > 80 = overbought with high volume. MFI < 20 = oversold. Stronger signal than RSI alone.', params: 'Period: 14', use: 'Volume-confirmed signals' },
            { name: 'Parabolic SAR', desc: 'Trailing stop indicator. Dots below price = uptrend (buy side). Dots above price = downtrend (sell side). Used for trailing stop-losses.', params: 'Step: 0.02, Max: 0.2', use: 'Trailing stop-loss placement' },
            { name: 'Pivot Points', desc: 'Key S/R levels calculated from previous day\'s High, Low, Close. PP = (H+L+C)/3. Gives R1,R2,R3 (resistance) and S1,S2,S3 (support) for the day.', params: 'Previous day OHLC', use: 'Intraday S/R levels, targets' },
            { name: 'RSI Divergence', desc: 'Bullish: Price makes lower low but RSI makes higher low → reversal up likely. Bearish: Price makes higher high but RSI makes lower high → reversal down likely.', params: 'RSI Period: 14, Lookback: 20', use: 'High-probability reversal signals' },
            { name: 'Volume Analysis', desc: 'Compares current volume to 20-day average. Volume surge (>1.5x) on breakout = confirmation. Low volume on move = weak signal. Volume precedes price.', params: 'Period: 20', use: 'Signal confirmation, breakout validity' },
          ].map(ind => (
            <div key={ind.name} className="py-2.5 border-b border-white/5 last:border-0">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-bold text-foreground">{ind.name}</p>
                <GuideTag label={ind.params} color="gray" />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{ind.desc}</p>
              <p className="text-[10px] text-accent mt-0.5">Use: {ind.use}</p>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* ── CANDLESTICK PATTERNS ── */}
      <AccordionSection title="22 Candlestick Patterns" icon="🕯️">
        <div className="mb-3 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <p className="text-[10px] text-yellow-400 leading-relaxed"><span className="font-bold">How to read reliability:</span> High = strong signal, confirm with 1 more indicator. Medium = use with volume or S/R confirmation. Low = treat as alert only.</p>
        </div>
        <div className="space-y-0">
          <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-2">Single Candle Patterns</p>
          {[
            { name: 'Doji', type: 'neutral', rel: 'low', desc: 'Open ≈ Close. Market indecision. Meaningful at key levels — watch next candle for direction.' },
            { name: 'Dragonfly Doji', type: 'bullish', rel: 'medium', desc: 'Long lower shadow, no upper shadow. Sellers pushed price down but buyers recovered fully. Bullish reversal at support.' },
            { name: 'Gravestone Doji', type: 'bearish', rel: 'medium', desc: 'Long upper shadow, no lower shadow. Buyers pushed price up but sellers rejected it fully. Bearish reversal at resistance.' },
            { name: 'Hammer', type: 'bullish', rel: 'high', desc: 'Small body at top, long lower shadow (2x body). Sellers dominated but buyers took control. Strong bullish reversal at support.' },
            { name: 'Shooting Star', type: 'bearish', rel: 'high', desc: 'Small body at bottom, long upper shadow. Buyers failed to sustain high. Strong bearish reversal at resistance.' },
            { name: 'Hanging Man', type: 'bearish', rel: 'medium', desc: 'Like Hammer but appears in uptrend. Warning sign — potential reversal. Needs confirmation next candle.' },
            { name: 'Inverted Hammer', type: 'bullish', rel: 'medium', desc: 'Long upper shadow in a downtrend. Buyers attempted recovery. Bullish if next candle confirms with a gap up.' },
            { name: 'Marubozu (Bullish)', type: 'bullish', rel: 'high', desc: 'Full bullish body, no shadows. Pure buyer control. Very strong continuation signal in uptrend.' },
            { name: 'Marubozu (Bearish)', type: 'bearish', rel: 'high', desc: 'Full bearish body, no shadows. Complete seller control. Very strong continuation signal in downtrend.' },
            { name: 'Spinning Top', type: 'neutral', rel: 'low', desc: 'Small body, shadows both sides. Indecision. Neither buyers nor sellers in control. Wait for breakout.' },
          ].map(p => (
            <div key={p.name} className="py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-foreground">{p.name}</span>
                <GuideTag label={p.type === 'bullish' ? '▲ BULLISH' : p.type === 'bearish' ? '▼ BEARISH' : '→ NEUTRAL'} color={p.type === 'bullish' ? 'green' : p.type === 'bearish' ? 'red' : 'gray'} />
                <GuideTag label={p.rel.toUpperCase()} color={p.rel === 'high' ? 'green' : p.rel === 'medium' ? 'yellow' : 'gray'} />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{p.desc}</p>
            </div>
          ))}
          <p className="text-[10px] font-bold text-accent uppercase tracking-wider mt-3 mb-2">Two-Candle Patterns</p>
          {[
            { name: 'Bullish Engulfing', type: 'bullish', rel: 'high', desc: 'Large bullish candle completely covers previous bearish candle. Strong reversal signal at support.' },
            { name: 'Bearish Engulfing', type: 'bearish', rel: 'high', desc: 'Large bearish candle completely covers previous bullish candle. Strong reversal signal at resistance.' },
            { name: 'Bullish Harami', type: 'bullish', rel: 'medium', desc: 'Small bullish candle inside previous large bearish candle. Selling momentum slowing — potential reversal.' },
            { name: 'Bearish Harami', type: 'bearish', rel: 'medium', desc: 'Small bearish candle inside previous large bullish candle. Buying momentum slowing — potential reversal.' },
            { name: 'Piercing Line', type: 'bullish', rel: 'medium', desc: 'Bearish candle followed by bullish candle opening below but closing above midpoint of bearish candle. Buyers taking control.' },
            { name: 'Dark Cloud Cover', type: 'bearish', rel: 'medium', desc: 'Bullish candle followed by bearish candle opening above but closing below midpoint of bullish candle. Sellers taking control.' },
            { name: 'Tweezer Bottom', type: 'bullish', rel: 'medium', desc: 'Two candles with same low. Price rejected at same level twice. Strong support confirmation.' },
            { name: 'Tweezer Top', type: 'bearish', rel: 'medium', desc: 'Two candles with same high. Price rejected at same level twice. Strong resistance confirmation.' },
          ].map(p => (
            <div key={p.name} className="py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-foreground">{p.name}</span>
                <GuideTag label={p.type === 'bullish' ? '▲ BULLISH' : '▼ BEARISH'} color={p.type === 'bullish' ? 'green' : 'red'} />
                <GuideTag label={p.rel.toUpperCase()} color={p.rel === 'high' ? 'green' : 'yellow'} />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{p.desc}</p>
            </div>
          ))}
          <p className="text-[10px] font-bold text-accent uppercase tracking-wider mt-3 mb-2">Three-Candle Patterns</p>
          {[
            { name: 'Morning Star', type: 'bullish', rel: 'high', desc: 'Bearish candle → small indecision candle (gap down) → large bullish candle. Classic reversal at bottom. One of the most reliable.' },
            { name: 'Evening Star', type: 'bearish', rel: 'high', desc: 'Bullish candle → small indecision candle (gap up) → large bearish candle. Classic reversal at top. Very reliable.' },
            { name: 'Three White Soldiers', type: 'bullish', rel: 'high', desc: 'Three consecutive rising bullish candles with strong bodies. Powerful trend reversal from bearish to bullish.' },
            { name: 'Three Black Crows', type: 'bearish', rel: 'high', desc: 'Three consecutive falling bearish candles with strong bodies. Powerful trend reversal from bullish to bearish.' },
          ].map(p => (
            <div key={p.name} className="py-2 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-foreground">{p.name}</span>
                <GuideTag label={p.type === 'bullish' ? '▲ BULLISH' : '▼ BEARISH'} color={p.type === 'bullish' ? 'green' : 'red'} />
                <GuideTag label="HIGH" color="green" />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{p.desc}</p>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* ── CHART PATTERNS ── */}
      <AccordionSection title="8 Chart Patterns" icon="📐">
        <div className="space-y-0">
          {[
            { name: 'Double Bottom', type: 'bullish', rel: 'high', desc: 'Price forms two equal lows separated by a peak. Looks like "W". Signals reversal from downtrend. Entry: breakout above the middle peak.' },
            { name: 'Double Top', type: 'bearish', rel: 'high', desc: 'Price forms two equal highs separated by a trough. Looks like "M". Signals reversal from uptrend. Entry: breakdown below the middle trough.' },
            { name: 'Ascending Triangle', type: 'bullish', rel: 'high', desc: 'Flat upper resistance + rising lower lows. Buyers getting stronger. Entry: close above flat resistance with volume surge.' },
            { name: 'Descending Triangle', type: 'bearish', rel: 'high', desc: 'Flat lower support + falling upper highs. Sellers getting stronger. Entry: close below flat support with volume surge.' },
            { name: 'Falling Wedge', type: 'bullish', rel: 'medium', desc: 'Both trendlines falling but narrowing. Bearish-looking but ~68% break upward. Bullish reversal/continuation pattern. Wait for breakout.' },
            { name: 'Rising Wedge', type: 'bearish', rel: 'medium', desc: 'Both trendlines rising but narrowing. Bullish-looking but ~65% break downward. Bearish reversal/continuation. Wait for breakdown.' },
            { name: 'Bull Flag', type: 'bullish', rel: 'high', desc: 'Strong rally (flagpole) followed by brief rectangular downward consolidation (flag). Entry: break above flag upper trendline. Target = flagpole height.' },
            { name: 'Bear Flag', type: 'bearish', rel: 'high', desc: 'Sharp drop (flagpole) followed by brief rectangular upward consolidation. Entry: break below flag lower trendline. Target = flagpole height.' },
          ].map(p => (
            <div key={p.name} className="py-2.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-foreground">{p.name}</span>
                <GuideTag label={p.type === 'bullish' ? '▲ BULLISH' : '▼ BEARISH'} color={p.type === 'bullish' ? 'green' : 'red'} />
                <GuideTag label={p.rel.toUpperCase()} color={p.rel === 'high' ? 'green' : 'yellow'} />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{p.desc}</p>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* ── SCANNER ── */}
      <AccordionSection title="Smart Scanner — How to Use" icon="🔍">
        <div className="space-y-2.5">
          <p className="text-[11px] text-muted-foreground leading-relaxed">The scanner analyses all Nifty 50 stocks simultaneously using multiple indicators and returns actionable signals ranked by confluence score.</p>
          <div className="space-y-0">
            {[
              { filter: 'All Signals', desc: 'Shows every stock with BUY, SELL, or NEUTRAL signal. Sorted by confidence score.' },
              { filter: 'Breakout', desc: 'Stocks trading near or above resistance with high volume confirmation (>1.5x average). Best for momentum trades.' },
              { filter: 'Oversold RSI', desc: 'Stocks with RSI below 35 — potential bounce candidates. Combine with support level check before buying.' },
              { filter: 'Strong Momentum', desc: 'Stocks with MACD positive + EMA in bullish alignment + volume above average. Trending strongly.' },
              { filter: 'VWAP Bounce', desc: 'Intraday filter — stocks currently trading near VWAP with bullish candle structure. Good for intraday entries.' },
              { filter: 'High Volume', desc: 'Stocks with volume >2x the 20-day average today. Smart money activity — watch closely for breakout or reversal.' },
            ].map(f => <GuideRow key={f.filter} label={f.filter} value={f.desc} />)}
          </div>
          <div className="bg-accent/10 border border-accent/20 rounded-xl p-3 mt-2">
            <p className="text-[10px] font-bold text-accent mb-1">Pro Tip — Confluence Score</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">Score 80–100 = Very strong signal (3+ indicators agree). Score 60–79 = Good signal (2 indicators agree). Score below 60 = Weak signal — skip or wait for confirmation.</p>
          </div>
        </div>
      </AccordionSection>

      {/* ── SIGNALS ── */}
      <AccordionSection title="Signals Tab — Understanding Alerts" icon="⚡">
        <div className="space-y-2.5">
          <p className="text-[11px] text-muted-foreground leading-relaxed">The Signals tab generates live trading signals for Nifty 50 stocks. Each signal is a computed recommendation based on multiple indicator confluence.</p>
          {[
            { label: 'STRONG BUY', desc: '3+ bullish indicators aligned. EMA bullish, RSI rising from oversold, MACD positive histogram, volume surge. High-confidence long entry.', color: 'green' as const },
            { label: 'BUY', desc: '2 bullish indicators aligned. Good entry with confirmation. Check S/R level and use proper stop-loss.', color: 'green' as const },
            { label: 'NEUTRAL', desc: 'Mixed signals — indicators contradict each other. Wait for clearer direction. Good time to be in cash.', color: 'gray' as const },
            { label: 'SELL', desc: '2 bearish indicators aligned. Good short/exit signal for longs. Set stop-loss above resistance.', color: 'red' as const },
            { label: 'STRONG SELL', desc: '3+ bearish indicators aligned. EMA bearish, RSI overbought turning down, MACD negative, volume surge. High-confidence exit / short signal.', color: 'red' as const },
          ].map(s => <GuideRow key={s.label} label={s.label} value={s.desc} badge={<GuideTag label={s.label} color={s.color} />} />)}
        </div>
      </AccordionSection>

      {/* ── RISK MANAGEMENT ── */}
      <AccordionSection title="Risk Management Rules" icon="🛡️">
        <div className="space-y-3">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
            <p className="text-[11px] font-bold text-red-400 mb-2">Golden Rules — Never Break These</p>
            <div className="space-y-1.5">
              {[
                'Never risk more than 2% of your capital on a single trade.',
                'Always set a stop-loss BEFORE entering a trade.',
                'Never average down on a losing trade.',
                'Book partial profits at the first target — let the rest ride with a trailing SL.',
                'Limit to max 5 open positions at any time.',
                'Never trade in the first 15 minutes after market open (9:15–9:30 AM) — volatility is extreme.',
                'If you lose 5% in a single day, STOP trading for the day.',
              ].map((r, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="text-red-400 text-[11px] mt-0.5">⚠</span>
                  <p className="text-[10px] text-foreground/80 leading-relaxed">{r}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-0">
            {[
              { label: 'Position Sizing Formula', value: 'Risk Amount = Capital × 2% ÷ Stop Loss (₹). Example: ₹1,00,000 capital, ₹10 SL → max buy = ₹1,00,000 × 2% ÷ ₹10 = 200 shares.' },
              { label: 'Stop-Loss Placement', value: 'For intraday: use 1x ATR below entry. For swing: use below swing low. For breakout: below breakout candle low. Never use fixed % only.' },
              { label: 'Reward:Risk Minimum', value: 'Only take trades with minimum 2:1 reward-to-risk. If SL is ₹10 below entry, target must be at least ₹20 above. Better setups: 3:1 or 4:1.' },
              { label: 'Intraday Exit Rule', value: 'All intraday positions MUST be squared off by 3:15 PM IST. Never carry MIS positions overnight — broker will auto-square at 3:20 PM.' },
              { label: 'Diversification', value: 'Never put more than 25% of capital in one sector. Spread across NIFTY 50 stocks across different sectors (IT, Bank, FMCG, Auto).' },
            ].map(r => <GuideRow key={r.label} label={r.label} value={r.value} />)}
          </div>
        </div>
      </AccordionSection>

      {/* ── PAPER TRADING ── */}
      <AccordionSection title="Paper Trading vs Real Trading" icon="📝">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
              <p className="text-[11px] font-bold text-blue-400 mb-1.5">📝 Paper Trading (Safe)</p>
              <div className="space-y-1">
                {['Virtual ₹10 Lakh capital', 'No real money at risk', 'Orders simulated locally', 'Learn without losing', 'Test strategies safely', 'Default mode (ON)'].map(i => (
                  <p key={i} className="text-[10px] text-muted-foreground flex gap-1"><span className="text-emerald-400">✓</span>{i}</p>
                ))}
              </div>
            </div>
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
              <p className="text-[11px] font-bold text-red-400 mb-1.5">💰 Real Trading (Live)</p>
              <div className="space-y-1">
                {['Real Angel One account', 'Actual P&L', 'Orders sent to exchange', 'Real capital at risk', 'Requires careful setup', 'Toggle OFF to enable'].map(i => (
                  <p key={i} className="text-[10px] text-muted-foreground flex gap-1"><span className="text-yellow-400">!</span>{i}</p>
                ))}
              </div>
            </div>
          </div>
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3">
            <p className="text-[10px] font-bold text-yellow-400 mb-1">Before switching to Real Trading:</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">Practice for at least 2 weeks in paper mode. Track your win rate — aim for 55%+ before going live. Start with small position sizes (₹5,000–10,000 per trade). Only trade liquid Nifty 50 stocks initially.</p>
          </div>
        </div>
      </AccordionSection>

      {/* ── MARKET TIMINGS ── */}
      <AccordionSection title="Market Timings & Sessions" icon="🕐">
        <div className="space-y-0">
          {[
            { time: '9:00 AM – 9:15 AM', session: 'Pre-Open Session', desc: 'Price discovery through order matching. Do NOT place MIS orders. Prices are not final.' },
            { time: '9:15 AM – 3:30 PM', session: 'Normal Trading Session', desc: 'Main trading hours. All order types allowed. Best trading window: 9:30–11:30 AM and 1:30–3:00 PM.' },
            { time: '3:30 PM – 4:00 PM', session: 'Post-Close / Closing Price', desc: 'Closing price calculation. CNC orders can be placed at closing price.' },
            { time: '3:15 PM', session: 'Intraday Square-Off Deadline', desc: 'Exit ALL MIS/intraday positions before this time. Broker auto-squares at 3:20 PM.' },
            { time: 'Mon – Fri only', session: 'Trading Days', desc: 'NSE/BSE closed on weekends. Also closed on NSE market holidays (Diwali, Republic Day, etc.).' },
          ].map(m => (
            <div key={m.time} className="py-2.5 border-b border-white/5 last:border-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-foreground">{m.session}</span>
                <GuideTag label={m.time} color="gray" />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">{m.desc}</p>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* ── PRODUCT TYPES ── */}
      <AccordionSection title="Order Types & Product Types" icon="📋">
        <div className="space-y-2">
          <p className="text-[10px] font-bold text-accent uppercase tracking-wider mb-1">Product Types</p>
          {[
            { name: 'CNC (Cash and Carry)', desc: 'For delivery trading — buy today, hold for days/weeks/months. No auto-square off. No leverage. Full capital required.' },
            { name: 'MIS (Margin Intraday Square-off)', desc: 'For intraday trading — auto-squared off at 3:20 PM. Leverage available (typically 3–5x). Higher risk.' },
            { name: 'NRML (Normal — F&O)', desc: 'For Futures & Options positions. Carry overnight. Requires margin as per exchange norms.' },
          ].map(p => <GuideRow key={p.name} label={p.name} value={p.desc} />)}
          <p className="text-[10px] font-bold text-accent uppercase tracking-wider mt-3 mb-1">Order Types</p>
          {[
            { name: 'MARKET Order', desc: 'Executes immediately at current market price. Faster but may have slippage. Use for liquid stocks only.' },
            { name: 'LIMIT Order', desc: 'Executes only at your specified price or better. No slippage. May not fill if price doesn\'t reach your level.' },
            { name: 'SL (Stop-Loss)', desc: 'Triggers a market order when price hits your stop-loss level. Use to limit losses automatically.' },
            { name: 'SL-M (Stop-Loss Market)', desc: 'Like SL but executes as market order after trigger. Guaranteed fill but may have slippage at fast markets.' },
          ].map(p => <GuideRow key={p.name} label={p.name} value={p.desc} />)}
        </div>
      </AccordionSection>

      {/* ── FAQ ── */}
      <AccordionSection title="Frequently Asked Questions" icon="❓">
        <div className="space-y-0">
          {[
            { q: 'Why are prices not updating in real-time?', a: 'Angel One\'s SmartStream WebSocket is optimized for production server IPs. In the development environment, prices update when you manually refresh (REST-based). On a deployed production server, live ticks will stream continuously.' },
            { q: 'Is my money safe when paper trading?', a: 'Yes, absolutely. Paper trading is ON by default and orders are simulated locally — nothing is sent to Angel One. Your real account remains untouched.' },
            { q: 'Can this app place trades automatically?', a: 'Currently no. TradeSignal Pro is a signal generation and analysis tool. You manually decide whether to act on signals. Automated execution (algo trading) is planned for a future version.' },
            { q: 'How accurate are the signals?', a: 'Signals are based on technical analysis — no signal is 100% accurate. Confluence scores above 75 have historically performed better. Always use stop-losses regardless of signal strength.' },
            { q: 'What data does Angel One provide?', a: 'Historical OHLCV candle data (1m to 1Y), real-time quotes, live portfolio/holdings, order book, trade book, and live P&L. All fetched directly from Angel One SmartAPI.' },
            { q: 'Can I trade F&O (Futures & Options)?', a: 'The infrastructure supports F&O orders (NRML product type). However, the current UI is focused on equity (stocks). F&O-specific screens are planned.' },
            { q: 'What is the Confluence Score?', a: 'A 0–100 score representing how many indicators agree on the same direction. Score of 85 means ~85% of computed indicator signals agree on BUY or SELL.' },
            { q: 'How do I add more stocks beyond Nifty 50?', a: 'Currently the scanner and signals cover Nifty 50 stocks. Custom stock search is available in the Charts tab using the search bar — you can view any NSE/BSE-listed stock there.' },
          ].map(faq => (
            <div key={faq.q} className="py-3 border-b border-white/5 last:border-0">
              <p className="text-[11px] font-bold text-foreground">{faq.q}</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">{faq.a}</p>
            </div>
          ))}
        </div>
      </AccordionSection>

      {/* Footer */}
      <div className="text-center py-4 px-3">
        <p className="text-[10px] text-muted-foreground">TradeSignal Pro v1.0 · Indian Markets Edition</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">NSE / BSE · Nifty 50 · Angel One SmartAPI</p>
        <p className="text-[10px] text-muted-foreground/50 mt-2">For educational purposes only. Not financial advice. Always do your own research.</p>
      </div>

    </div>
  );
}
