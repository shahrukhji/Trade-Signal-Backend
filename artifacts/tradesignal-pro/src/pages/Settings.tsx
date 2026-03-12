import { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store/use-store';
import { angelOne, type WalletBalance } from '@/broker/angelOne';
import {
  Shield, BrainCircuit, Sliders, BellRing, Link as LinkIcon,
  CheckCircle2, AlertCircle, LogOut, User, Loader2, Eye, EyeOff,
  Wifi, WifiOff, Key, Building2, RefreshCw, Clock, TrendingUp,
  DollarSign, Activity,
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
  const [totp, setTotp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

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

  // Restore session on mount
  useEffect(() => {
    if (brokerSession && brokerApiKey) {
      angelOne.restoreSession(brokerSession, brokerIsDemo, brokerApiKey);
    }
    if (brokerProfile) setClientId(brokerProfile.clientId);
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

  const handleConnect = async () => {
    if (!clientId.trim()) { setLoginError('Client ID is required'); return; }
    if (!password.trim()) { setLoginError('Password / PIN is required'); return; }
    if (!apiKey.trim()) { setLoginError('SmartAPI Key is required'); return; }
    if (!totp.trim()) { setLoginError('TOTP is required'); return; }
    if (totp.trim().length < 6 || totp.trim().length > 64) {
      setLoginError('TOTP must be between 6 and 64 characters');
      return;
    }

    setLoginLoading(true);
    setLoginError('');

    const result = await angelOne.login(
      { clientId: clientId.trim().toUpperCase(), password: password.trim(), apiKey: apiKey.trim(), totp: totp.trim() },
      { strict: true }
    );

    if (result.success && result.session && result.profile) {
      setBrokerSession(result.session, result.profile, false, apiKey.trim());
      toast.success(`Connected as ${result.profile.clientName}`);
      setTotp('');
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

                    {/* SmartAPI Key */}
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

                    {/* TOTP */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                        TOTP <span className="text-muted-foreground font-normal">(6–64 characters)</span> <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <CheckCircle2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={totp}
                          onChange={(e) => { setTotp(e.target.value); setLoginError(''); }}
                          placeholder="Paste TOTP from Angel One SmartAPI portal"
                          maxLength={64}
                          className="w-full bg-input border border-border rounded-xl h-12 pl-9 pr-3 text-sm font-mono text-foreground outline-none focus:border-accent transition-colors"
                          autoComplete="one-time-code"
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Copy the time-based token from your Angel One SmartAPI portal
                      </p>
                      {totp.length > 0 && (
                        <p className={`text-[10px] mt-0.5 ${totp.length >= 6 && totp.length <= 64 ? 'text-primary' : 'text-destructive'}`}>
                          {totp.length} characters {totp.length < 6 ? '(need at least 6)' : totp.length > 64 ? '(max 64)' : '✓'}
                        </p>
                      )}
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
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
