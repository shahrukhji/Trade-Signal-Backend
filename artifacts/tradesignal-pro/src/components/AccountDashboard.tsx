import { useState, useEffect } from 'react';
import { angelOne } from '@/broker/angelOne';
import { useStore } from '@/store/use-store';
import type { WalletBalance, AccountProfile } from '@/broker/angelOne';
import {
  RefreshCw, Copy, CheckCircle2, Wifi, WifiOff, AlertCircle,
  BarChart3, TrendingUp, Clock, Zap, LogOut, Activity,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(Math.abs(n))}`;

function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email || '—';
  const [local, domain] = email.split('@');
  return `${local.slice(0, 3)}***@${domain}`;
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return phone || '—';
  return `${phone.slice(0, 2)}****${phone.slice(-4)}`;
}

export function AccountDashboard() {
  const {
    brokerProfile, brokerSession, brokerIsDemo, brokerApiKey,
    holdings, positions, orderBook,
    walletBalance, setWalletBalance, setHoldings, setPositions, setOrderBook,
    clearBrokerSession,
  } = useStore();

  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [sessionCountdown, setSessionCountdown] = useState('');
  const [lastCheck, setLastCheck] = useState(Date.now());

  const profile: AccountProfile | null = brokerProfile;
  const balance: WalletBalance | null = walletBalance;

  // Restore session + fetch data
  useEffect(() => {
    if (brokerSession && brokerApiKey) {
      angelOne.restoreSession(brokerSession, brokerIsDemo, brokerApiKey);
    }
    refreshAll();
    const interval = setInterval(refreshAll, 60000);
    return () => clearInterval(interval);
  }, []);

  // Session countdown
  useEffect(() => {
    const tick = () => {
      if (brokerSession?.lastLoginTime) {
        const loginTime = new Date(brokerSession.lastLoginTime).getTime();
        const expiresAt = loginTime + 24 * 60 * 60 * 1000; // 24h
        const remaining = expiresAt - Date.now();
        if (remaining > 0) {
          const h = Math.floor(remaining / 3600000);
          const m = Math.floor((remaining % 3600000) / 60000);
          setSessionCountdown(`${h}h ${m}m`);
        } else {
          setSessionCountdown('Expired');
        }
      }
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [brokerSession]);

  const refreshAll = async (manual = false) => {
    if (manual) setRefreshing(true);
    const t0 = Date.now();
    try {
      const [bal, hold, pos, orders] = await Promise.all([
        angelOne.getWalletBalance(),
        angelOne.getHoldings(),
        angelOne.getPositions(),
        angelOne.getOrderBook(),
      ]);
      setWalletBalance(bal);
      setHoldings(hold);
      setPositions(pos);
      setOrderBook(orders);
      setLatency(Date.now() - t0);
      setLastCheck(Date.now());
    } catch (_) {}
    if (manual) { setRefreshing(false); toast.success('Data refreshed'); }
  };

  const copyClientId = () => {
    if (profile?.clientId) {
      navigator.clipboard.writeText(profile.clientId).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  const handleDisconnect = async () => {
    await angelOne.logout();
    clearBrokerSession();
    toast.info('Disconnected');
  };

  const latencyColor = latency === null ? '#888' : latency < 100 ? '#00FF88' : latency < 500 ? '#FFD700' : '#FF3366';
  const secondsAgo = Math.floor((Date.now() - lastCheck) / 1000);

  if (!profile || !brokerSession) return null;

  return (
    <div className="space-y-4 px-4 pb-6">
      {/* ── PROFILE CARD ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-card to-input border border-border rounded-2xl p-5"
      >
        <div className="flex items-start gap-4 mb-4">
          {/* Avatar */}
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 text-2xl font-bold text-background shadow-lg"
            style={{ background: 'linear-gradient(135deg, #00BFFF, #A855F7)' }}
          >
            {profile.avatarInitials}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground truncate">{profile.clientName}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm text-muted-foreground font-mono">{profile.clientId}</span>
              <button onClick={copyClientId} className="text-muted-foreground hover:text-accent transition-colors">
                {copied ? <CheckCircle2 size={13} className="text-primary" /> : <Copy size={13} />}
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <div className={`w-2 h-2 rounded-full ${angelOne.isConnected() ? 'bg-primary animate-pulse' : 'bg-muted-foreground'}`} />
              <span className="text-xs text-muted-foreground">{profile.broker}</span>
              {brokerIsDemo && <span className="text-[9px] bg-yellow-500/20 text-yellow-400 px-1.5 rounded-full font-bold">DEMO</span>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
          <div className="bg-input/60 rounded-xl px-3 py-2">
            <p className="text-[10px] text-muted-foreground mb-0.5">Email</p>
            <p className="font-mono text-xs text-foreground truncate">{maskEmail(profile.email)}</p>
          </div>
          <div className="bg-input/60 rounded-xl px-3 py-2">
            <p className="text-[10px] text-muted-foreground mb-0.5">Phone</p>
            <p className="font-mono text-xs text-foreground">{maskPhone(profile.phone)}</p>
          </div>
          <div className="bg-input/60 rounded-xl px-3 py-2">
            <p className="text-[10px] text-muted-foreground mb-0.5">Last Login</p>
            <p className="text-xs text-foreground">
              {profile.lastLoginTime ? new Date(profile.lastLoginTime).toLocaleDateString('en-IN') : 'Today'}
            </p>
          </div>
          <div className="bg-input/60 rounded-xl px-3 py-2">
            <p className="text-[10px] text-muted-foreground mb-0.5">Session</p>
            <p className="text-xs text-foreground">{sessionCountdown || '—'}</p>
          </div>
        </div>

        {/* Exchange badges */}
        <div className="flex flex-wrap gap-1.5 mb-2">
          {profile.exchanges.map(ex => (
            <span key={ex} className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
              <CheckCircle2 size={9} /> {ex}
            </span>
          ))}
        </div>
        {/* Product badges */}
        <div className="flex flex-wrap gap-1.5">
          {profile.products.map(p => (
            <span key={p} className="text-[10px] bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full font-bold">
              {p}
            </span>
          ))}
        </div>
      </motion.div>

      {/* ── WALLET BALANCE ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-2xl p-5 border"
        style={{ background: 'linear-gradient(135deg, #12121A, #1A1A2E)', borderColor: '#FFD70040' }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-bold text-yellow-400 flex items-center gap-1.5">
            💰 Available Cash
          </p>
          <button
            onClick={() => refreshAll(true)}
            disabled={refreshing}
            className="p-1.5 rounded-lg bg-input border border-border text-muted-foreground"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>

        <p className="text-4xl font-mono font-bold text-primary mb-4">
          {balance ? fmtINR(balance.availableCash) : '₹—'}
        </p>

        {balance && (
          <div className="space-y-2">
            {[
              ['Total Portfolio Value', balance.totalPortfolioValue, false],
              ['Total Invested', balance.utilizedAmount, false],
              ['Available Margin', balance.availableMargin, false],
              ['Used Margin', balance.usedMargin, false],
              ['Collateral', balance.collateral, false],
              ['Withdrawable', balance.withdrawableBalance, false],
            ].map(([label, val, _]) => (
              <div key={label as string} className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">{label as string}</span>
                <span className="text-sm font-bold font-mono text-foreground">{fmtINR(val as number)}</span>
              </div>
            ))}
            <div className="flex justify-between items-center pt-1 border-t border-white/5">
              <span className="text-xs text-muted-foreground">Today's P&L</span>
              <span className={`text-sm font-bold font-mono ${balance.todayPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {balance.todayPnL >= 0 ? '+' : '-'}{fmtINR(balance.todayPnL)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Unrealized P&L</span>
              <span className={`text-sm font-bold font-mono ${balance.unrealizedPnL >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {balance.unrealizedPnL >= 0 ? '+' : '-'}{fmtINR(balance.unrealizedPnL)}
              </span>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── CONNECTION STATUS ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.12 }}
        className="glass-panel border border-border rounded-2xl p-4"
      >
        <p className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Activity size={14} className="text-accent" /> Connection Status
        </p>

        <div className="flex items-center gap-3 mb-4">
          <div className={`w-3 h-3 rounded-full ${brokerIsDemo ? 'bg-yellow-400' : 'bg-primary animate-pulse'}`} />
          <span className="font-bold text-foreground">
            {brokerIsDemo ? 'Demo Mode' : 'Connected'}
          </span>
          {brokerIsDemo && <span className="text-xs text-yellow-400">Using simulated data</span>}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-input rounded-xl p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5">API Latency</p>
            <p className="text-sm font-bold font-mono" style={{ color: latencyColor }}>
              {latency !== null ? `${latency}ms` : '—'}
              <span className="text-[10px] ml-1">{latency !== null ? (latency < 100 ? '🟢' : latency < 500 ? '🟡' : '🔴') : ''}</span>
            </p>
          </div>
          <div className="bg-input rounded-xl p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5">Session Expires</p>
            <p className="text-sm font-bold text-foreground">{sessionCountdown || '—'}</p>
          </div>
          <div className="bg-input rounded-xl p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5">Last Check</p>
            <p className="text-sm font-bold text-foreground">{secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.floor(secondsAgo / 60)}m ago`}</p>
          </div>
          <div className="bg-input rounded-xl p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5">Data</p>
            <p className="text-sm font-bold text-primary flex items-center gap-1"><Zap size={11} /> Live</p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => refreshAll(true)}
            className="flex-1 h-9 bg-input border border-border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
          >
            <RefreshCw size={12} /> Check Now
          </button>
          <button
            onClick={handleDisconnect}
            className="flex-1 h-9 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition-transform"
          >
            <LogOut size={12} /> Disconnect
          </button>
        </div>
      </motion.div>

      {/* ── QUICK STATS ── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.16 }}
        className="grid grid-cols-2 gap-3"
      >
        {[
          { label: 'Holdings', value: holdings.length, sub: 'stocks', icon: BarChart3, color: '#00FF88' },
          { label: 'Open Positions', value: positions.filter(p => p.netQuantity !== 0).length, sub: 'active', icon: TrendingUp, color: '#00BFFF' },
          { label: 'Open Orders', value: orderBook.filter(o => o.status === 'open' || o.status === 'trigger pending').length, sub: 'pending', icon: Clock, color: '#FFD700' },
          { label: "Today's Trades", value: orderBook.filter(o => o.status === 'complete').length, sub: 'executed', icon: CheckCircle2, color: '#A855F7' },
        ].map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="glass-panel border border-border rounded-xl p-3">
            <div className="flex items-start justify-between mb-1">
              <p className="text-[11px] text-muted-foreground">{label}</p>
              <Icon size={14} style={{ color }} />
            </div>
            <p className="text-2xl font-mono font-bold" style={{ color }}>{value}</p>
            <p className="text-[10px] text-muted-foreground">{sub}</p>
          </div>
        ))}
      </motion.div>
    </div>
  );
}
