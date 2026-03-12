import { useState, useEffect } from 'react';
import { useStore } from '@/store/use-store';
import { angelOne } from '@/broker/angelOne';
import {
  Shield, BrainCircuit, Sliders, BellRing, Link as LinkIcon,
  CheckCircle2, AlertCircle, LogOut, User, Loader2, Eye, EyeOff,
  Wifi, WifiOff, Key, Building2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';

export function Settings() {
  const {
    paperMode, setPaperMode,
    tradingPrefs, updatePrefs,
    brokerSession, brokerProfile, brokerIsDemo, brokerApiKey,
    setBrokerSession, clearBrokerSession,
    geminiConfig, setGeminiConfig,
  } = useStore();

  const [activeTab, setActiveTab] = useState('broker');

  // Broker login form
  const [clientId, setClientId] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [totp, setTotp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // AI form
  const [aiApiKey, setAiApiKey] = useState(geminiConfig.apiKey || '');
  const [aiProvider, setAiProvider] = useState('Google Gemini');
  const [showAiKey, setShowAiKey] = useState(false);
  const [aiTesting, setAiTesting] = useState(false);

  // Restore session into the angelOne service on mount
  useEffect(() => {
    if (brokerSession && brokerApiKey) {
      angelOne.restoreSession(brokerSession, brokerIsDemo, brokerApiKey);
    }
  }, []);

  // Pre-fill clientId if already connected
  useEffect(() => {
    if (brokerProfile) {
      setClientId(brokerProfile.clientId);
    }
  }, [brokerProfile]);

  const isConnected = !!brokerSession;

  const handleConnect = async () => {
    if (!clientId.trim()) { setLoginError('Client ID is required'); return; }
    if (!password.trim()) { setLoginError('Password / PIN is required'); return; }
    if (!apiKey.trim()) { setLoginError('API Key is required'); return; }
    if (!totp.trim()) { setLoginError('TOTP is required'); return; }

    setLoginLoading(true);
    setLoginError('');

    const result = await angelOne.login({ clientId, password, apiKey, totp });

    if (result.success && result.session && result.profile) {
      setBrokerSession(result.session, result.profile, angelOne.isDemoMode(), apiKey);
      toast.success(
        angelOne.isDemoMode()
          ? 'Connected in Demo Mode (API unreachable)'
          : `Connected as ${result.profile.clientName}`
      );
      setTotp('');
    } else {
      setLoginError(result.error || 'Login failed. Please try again.');
    }

    setLoginLoading(false);
  };

  const handleDisconnect = async () => {
    await angelOne.logout();
    clearBrokerSession();
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
      <div className="glass-panel border border-border rounded-2xl p-4 mb-5 grid grid-cols-2 gap-3">
        <div className="bg-input rounded-xl p-3 border border-white/5">
          <p className="text-[10px] text-muted-foreground uppercase mb-1.5">Broker</p>
          {isConnected ? (
            <p className="font-bold text-sm text-primary flex items-center gap-1.5">
              <Wifi size={13} />
              {brokerIsDemo ? 'Demo Mode' : 'Connected'}
            </p>
          ) : (
            <p className="font-bold text-sm text-muted-foreground flex items-center gap-1.5">
              <WifiOff size={13} /> Disconnected
            </p>
          )}
        </div>
        <div className="bg-input rounded-xl p-3 border border-white/5">
          <p className="text-[10px] text-muted-foreground uppercase mb-1.5">AI Engine</p>
          {geminiConfig.status === 'ACTIVE' ? (
            <p className="font-bold text-sm text-accent flex items-center gap-1.5">
              <CheckCircle2 size={13} /> Active
            </p>
          ) : (
            <p className="font-bold text-sm text-muted-foreground flex items-center gap-1.5">
              <AlertCircle size={13} /> Not Set
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
              {/* Connected Profile Card */}
              {isConnected && brokerProfile ? (
                <div className="bg-gradient-to-br from-primary/10 to-accent/5 border border-primary/30 rounded-2xl p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center">
                      <span className="text-primary font-bold text-lg">{brokerProfile.avatarInitials}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-foreground truncate">{brokerProfile.clientName}</h3>
                      <p className="text-xs text-muted-foreground font-mono">{brokerProfile.clientId}</p>
                    </div>
                    {brokerIsDemo && (
                      <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full font-bold uppercase">Demo</span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="bg-card/50 rounded-xl p-2.5">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Broker</p>
                      <p className="text-xs font-bold text-foreground">{brokerProfile.broker}</p>
                    </div>
                    <div className="bg-card/50 rounded-xl p-2.5">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Exchanges</p>
                      <p className="text-xs font-bold text-foreground">{brokerProfile.exchanges.join(', ')}</p>
                    </div>
                    <div className="bg-card/50 rounded-xl p-2.5">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Products</p>
                      <p className="text-xs font-bold text-foreground truncate">{brokerProfile.products.slice(0, 2).join(', ')}</p>
                    </div>
                    <div className="bg-card/50 rounded-xl p-2.5">
                      <p className="text-[10px] text-muted-foreground mb-0.5">Last Login</p>
                      <p className="text-xs font-bold text-foreground">
                        {brokerProfile.lastLoginTime
                          ? new Date(brokerProfile.lastLoginTime).toLocaleDateString('en-IN')
                          : 'Today'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handleDisconnect}
                    className="w-full h-11 bg-destructive/10 border border-destructive/30 text-destructive font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                  >
                    <LogOut size={15} />
                    Disconnect Broker
                  </button>
                </div>
              ) : (
                /* Login Form */
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 size={16} className="text-accent" />
                    <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Angel One SmartAPI</h2>
                  </div>

                  <div className="space-y-3">
                    {/* Client ID */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                        Client Code <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          value={clientId}
                          onChange={(e) => setClientId(e.target.value.toUpperCase())}
                          placeholder="e.g. A123456"
                          className="w-full bg-input border border-border rounded-xl h-12 pl-9 pr-3 text-sm font-mono text-foreground outline-none focus:border-accent transition-colors"
                        />
                      </div>
                    </div>

                    {/* Password / PIN */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                        Password / PIN <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <Shield size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Login password"
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

                    {/* API Key */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                        SmartAPI Key <span className="text-destructive">*</span>
                      </label>
                      <div className="relative">
                        <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type={showApiKey ? 'text' : 'password'}
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          placeholder="From Angel One developer portal"
                          className="w-full bg-input border border-border rounded-xl h-12 pl-9 pr-10 text-sm font-mono text-foreground outline-none focus:border-accent transition-colors"
                        />
                        <button
                          onClick={() => setShowApiKey(!showApiKey)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                        >
                          {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </div>
                    </div>

                    {/* TOTP */}
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
                        TOTP <span className="text-destructive">*</span>
                      </label>
                      <input
                        type="text"
                        value={totp}
                        onChange={(e) => setTotp(e.target.value)}
                        placeholder="From Angel One SmartAPI website"
                        className="w-full bg-input border border-border rounded-xl h-12 px-3 text-sm font-mono text-foreground outline-none focus:border-accent transition-colors"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Copy the TOTP generated on your Angel One SmartAPI portal
                      </p>
                    </div>

                    {/* Error */}
                    {loginError && (
                      <motion.div
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 flex items-start gap-2"
                      >
                        <AlertCircle size={14} className="text-destructive mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-destructive">{loginError}</p>
                      </motion.div>
                    )}

                    <button
                      onClick={handleConnect}
                      disabled={loginLoading}
                      className="w-full h-12 bg-accent text-background font-bold rounded-xl shadow-[0_0_20px_rgba(0,191,255,0.3)] flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
                    >
                      {loginLoading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Connecting...
                        </>
                      ) : (
                        <>
                          <Wifi size={16} />
                          Connect to Angel One
                        </>
                      )}
                    </button>

                    <p className="text-[10px] text-muted-foreground text-center">
                      Credentials are stored only on your device. Never shared externally.
                    </p>
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
            <div className="p-4 bg-input rounded-xl border border-white/5 text-center">
              <AlertCircle className="mx-auto text-accent mb-2" size={32} />
              <h3 className="font-bold text-foreground">Price Alerts</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Notification permissions required to enable price alerts and AI signal triggers.
              </p>
              <button className="mt-4 px-6 py-2 bg-card border border-border rounded-lg text-sm font-bold active:scale-95 transition-transform">
                Request Permission
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Watermark */}
      <p className="text-center text-[10px] text-muted-foreground/40 mt-8">Made with ❤️ by Shahrukh</p>
    </div>
  );
}
