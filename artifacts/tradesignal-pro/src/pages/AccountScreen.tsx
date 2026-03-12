import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, Link, Loader2, LogOut, User, ExternalLink, Wifi } from 'lucide-react';
import { angelOne } from '@/broker/angelOne';
import { useStore } from '@/store/use-store';
import { AccountDashboard } from '@/components/AccountDashboard';
import { toast } from 'sonner';
import type { Holding, Position, OrderBook } from '@/broker/angelOne';

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}`;

type Tab = 'holdings' | 'positions' | 'orders';

export function AccountScreen() {
  const {
    brokerSession, brokerProfile, brokerIsDemo, brokerApiKey,
    setBrokerSession, clearBrokerSession,
    holdings, positions, orderBook,
  } = useStore();

  const isConnected = !!brokerSession;

  // Login form state
  const [clientId, setClientId] = useState('');
  const [password, setPassword] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [totp, setTotp] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [quickLoading, setQuickLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('holdings');
  const [configStatus, setConfigStatus] = useState<{ allConfigured: boolean; hasTotpSecret: boolean } | null>(null);

  useEffect(() => {
    fetch('/api/broker-proxy/config-status')
      .then(r => r.json())
      .then(setConfigStatus)
      .catch(() => {});
  }, []);

  // Quick Connect using pre-configured Replit secrets
  const handleQuickConnect = async () => {
    setQuickLoading(true);
    setError('');
    try {
      const res = await fetch('/api/broker-proxy/auto-login', { method: 'POST' });
      const data = await res.json();
      if (data.status && data.data) {
        const d = data.data;
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
        angelOne.restoreSession(session, false, savedApiKey);
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
      } else {
        setError(data.message || 'Quick Connect failed. Check your Replit Secrets.');
      }
    } catch (err: any) {
      setError('Quick Connect error: ' + (err?.message || 'Unknown'));
    }
    setQuickLoading(false);
  };

  const handleLogin = async () => {
    if (!clientId.trim() || !password.trim() || !apiKey.trim()) {
      setError('Please fill in Client ID, Password, and API Key');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await angelOne.login({ clientId, password, apiKey, totp });
      const isDemo = angelOne.isDemoMode();
      setBrokerSession(result.session || null, result.profile || null, isDemo, apiKey);
      toast.success(isDemo ? 'Demo mode active' : 'Connected to Angel One!');
    } catch (err: any) {
      setError(err?.message || 'Login failed. Check your credentials and try again.');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await angelOne.logout();
    clearBrokerSession();
    toast.info('Logged out');
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen px-4 pt-6 pb-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <User size={18} className="text-accent" /> Account
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Connect to Angel One SmartAPI</p>
        </div>

        {/* Quick Connect Card — shown when all secrets are pre-configured */}
        {configStatus?.allConfigured && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel border border-accent/30 rounded-2xl p-4 mb-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Wifi size={14} className="text-accent" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Quick Connect (Auto)</p>
                <p className="text-[11px] text-muted-foreground">Credentials pre-configured in Replit Secrets</p>
              </div>
            </div>

            <button
              onClick={handleQuickConnect}
              disabled={quickLoading}
              className="w-full h-12 rounded-2xl bg-accent text-background font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow-lg shadow-accent/20"
            >
              {quickLoading ? (
                <><Loader2 size={16} className="animate-spin" /> Connecting...</>
              ) : (
                <><Wifi size={16} /> Quick Connect (Auto)</>
              )}
            </button>

            <p className="text-[10px] text-center text-muted-foreground mt-2">
              {configStatus.hasTotpSecret ? '✓ All credentials pre-configured · TOTP auto-generated' : '✓ All credentials configured'}
            </p>

            <div className="flex items-center gap-2 mt-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] text-muted-foreground">OR ENTER MANUALLY</span>
              <div className="flex-1 h-px bg-border" />
            </div>
          </motion.div>
        )}

        {/* Angel One Login Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: configStatus?.allConfigured ? 0.1 : 0 }}
          className="glass-panel border border-border rounded-2xl p-5 mb-4"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Link size={16} className="text-accent" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-sm">Angel One SmartAPI</h2>
              <p className="text-[11px] text-muted-foreground">Secure broker connection</p>
            </div>
          </div>

          <div className="space-y-3">
            {/* Client ID */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Client ID *</label>
              <input
                value={clientId}
                onChange={e => setClientId(e.target.value)}
                placeholder="e.g. S1234567"
                className="w-full h-11 bg-input border border-border rounded-xl px-3 text-sm text-foreground outline-none focus:border-accent transition-colors font-mono"
              />
            </div>

            {/* Password */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Password *</label>
              <div className="relative">
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  type={showPass ? 'text' : 'password'}
                  placeholder="Your login password"
                  className="w-full h-11 bg-input border border-border rounded-xl px-3 pr-10 text-sm text-foreground outline-none focus:border-accent transition-colors"
                />
                <button onClick={() => setShowPass(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPass ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* API Key */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">SmartAPI Key *</label>
              <div className="relative">
                <input
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  type={showApiKey ? 'text' : 'password'}
                  placeholder="From Angel One developer portal"
                  className="w-full h-11 bg-input border border-border rounded-xl px-3 pr-10 text-sm text-foreground outline-none focus:border-accent transition-colors font-mono"
                />
                <button onClick={() => setShowApiKey(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* TOTP */}
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">TOTP</label>
              <input
                value={totp}
                onChange={e => setTotp(e.target.value)}
                placeholder="From Angel One SmartAPI website"
                className="w-full h-11 bg-input border border-border rounded-xl px-3 text-sm text-foreground outline-none focus:border-accent transition-colors font-mono"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Copy the TOTP generated on your Angel One SmartAPI portal</p>
            </div>
          </div>

          {/* Error */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-xs text-destructive"
              >
                <p className="font-bold mb-1">⚠️ {error}</p>
                <p>• Verify your Client Code at angelone.in</p>
                <p>• Generate SmartAPI key at smartapi.angelone.in</p>
                <p>• Make sure your account has API trading enabled</p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full h-12 mt-4 rounded-2xl bg-accent text-background font-bold flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Link size={16} />}
            {loading ? 'Connecting...' : '🔌 Connect to Angel One'}
          </button>

          <a
            href="https://smartapi.angelone.in"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-3 hover:text-accent transition-colors"
          >
            Get SmartAPI key from smartapi.angelone.in <ExternalLink size={10} />
          </a>
        </motion.div>

        {/* Demo mode hint */}
        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-yellow-400 text-center">
          <p className="font-bold mb-0.5">🟡 Demo Mode Available</p>
          <p>Skip the TOTP field to enter demo mode with simulated data</p>
        </div>
      </div>
    );
  }

  // Connected view
  return (
    <div className="pb-6 pt-4">
      {/* Header */}
      <div className="px-4 flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <User size={18} className="text-accent" /> Account
        </h1>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-destructive border border-destructive/20 bg-destructive/10 px-3 py-1.5 rounded-xl"
        >
          <LogOut size={12} /> Logout
        </button>
      </div>

      {brokerIsDemo && (
        <div className="mx-4 mb-4 p-2.5 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-xs text-yellow-400 font-bold text-center">
          🟡 Running in Demo Mode — simulated data
        </div>
      )}

      {/* AccountDashboard */}
      <AccountDashboard />

      {/* Tabs */}
      <div className="mx-4 mt-2">
        <div className="flex bg-input border border-border rounded-2xl p-1 mb-3">
          {(['holdings', 'positions', 'orders'] as Tab[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 h-8 rounded-xl text-xs font-bold transition-all capitalize ${
                activeTab === tab ? 'bg-accent text-background shadow-sm' : 'text-muted-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Holdings Tab */}
        {activeTab === 'holdings' && (
          <div className="space-y-2">
            {holdings.length === 0 ? (
              <EmptyState msg="No holdings found" sub="Your portfolio holdings will appear here" />
            ) : (
              holdings.map((h: Holding, i: number) => (
                <motion.div
                  key={h.tradingSymbol}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-panel border border-border rounded-2xl p-3"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="font-bold text-sm text-foreground font-mono">{h.tradingSymbol}</p>
                      <p className="text-[10px] text-muted-foreground">{h.quantity} shares @ {fmtINR(h.averagePrice)}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-foreground">{fmtINR(h.lastTradedPrice)}</p>
                      <p className={`text-xs font-bold ${h.pnl >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {h.pnl >= 0 ? '+' : ''}{fmtINR(h.pnl)} ({h.pnlPercent?.toFixed(1) || '0.0'}%)
                      </p>
                    </div>
                  </div>
                  <div className="h-1 bg-input rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, Math.abs(h.pnlPercent || 0) * 5)}%`,
                        background: h.pnl >= 0 ? '#00FF88' : '#FF3366',
                      }}
                    />
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Positions Tab */}
        {activeTab === 'positions' && (
          <div className="space-y-2">
            {positions.length === 0 ? (
              <EmptyState msg="No open positions" sub="Your intraday positions will appear here" />
            ) : (
              positions.filter((p: Position) => p.netQuantity !== 0).map((p: Position, i: number) => (
                <motion.div
                  key={p.tradingSymbol + i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-panel border border-border rounded-2xl p-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-bold text-sm text-foreground font-mono">{p.tradingSymbol}</p>
                      <div className="flex gap-2 mt-0.5">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${p.netQuantity > 0 ? 'text-primary border-primary/20 bg-primary/10' : 'text-destructive border-destructive/20 bg-destructive/10'}`}>
                          {p.netQuantity > 0 ? 'LONG' : 'SHORT'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{Math.abs(p.netQuantity)} qty</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-foreground">{fmtINR(p.ltp)}</p>
                      <p className={`text-xs font-bold ${(p.unrealisedPnL || 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                        {(p.unrealisedPnL || 0) >= 0 ? '+' : ''}{fmtINR(p.unrealisedPnL || 0)}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Avg ₹{p.buyPrice?.toFixed(2)} | Product: {p.productType}
                  </p>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* Orders Tab */}
        {activeTab === 'orders' && (
          <div className="space-y-2">
            {orderBook.length === 0 ? (
              <EmptyState msg="No orders today" sub="Your placed orders will appear here" />
            ) : (
              orderBook.map((o: OrderBook, i: number) => (
                <motion.div
                  key={o.orderId + i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="glass-panel border border-border rounded-2xl p-3"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="font-bold text-sm text-foreground font-mono">{o.tradingSymbol}</p>
                      <div className="flex gap-1.5 mt-0.5">
                        <StatusBadge status={o.status} />
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold ${o.transactionType === 'BUY' ? 'text-primary border-primary/20 bg-primary/10' : 'text-destructive border-destructive/20 bg-destructive/10'}`}>
                          {o.transactionType}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm font-mono text-foreground">{fmtINR(o.price)}</p>
                      <p className="text-[10px] text-muted-foreground">Qty: {o.quantity}</p>
                    </div>
                  </div>
                  {o.status === 'open' || o.status === 'trigger pending' ? (
                    <button
                      onClick={async () => {
                        await angelOne.cancelOrder(o.orderId, 'NORMAL');
                        toast.success('Order cancelled');
                      }}
                      className="w-full mt-2 h-7 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-[11px] font-bold active:scale-95 transition-transform"
                    >
                      Cancel Order
                    </button>
                  ) : null}
                </motion.div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    complete: 'text-primary border-primary/20 bg-primary/10',
    open: 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10',
    cancelled: 'text-muted-foreground border-border bg-input',
    rejected: 'text-destructive border-destructive/20 bg-destructive/10',
    'trigger pending': 'text-accent border-accent/20 bg-accent/10',
  };
  return (
    <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-bold capitalize ${map[status] || map.cancelled}`}>
      {status}
    </span>
  );
}

function EmptyState({ msg, sub }: { msg: string; sub: string }) {
  return (
    <div className="text-center py-10 text-muted-foreground">
      <User size={28} className="mx-auto mb-2 opacity-20" />
      <p className="text-sm font-medium">{msg}</p>
      <p className="text-xs mt-1">{sub}</p>
    </div>
  );
}
