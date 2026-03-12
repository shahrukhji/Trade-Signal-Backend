import { useState } from 'react';
import { useStore } from '@/store/use-store';
import { Shield, BrainCircuit, Sliders, BellRing, Link as LinkIcon, CheckCircle2, AlertCircle } from 'lucide-react';

export function Settings() {
  const { paperMode, setPaperMode, tradingPrefs, updatePrefs } = useStore();
  const [activeTab, setActiveTab] = useState('broker');

  const TABS = [
    { id: 'broker', icon: LinkIcon, label: 'Broker' },
    { id: 'ai', icon: BrainCircuit, label: 'AI Engine' },
    { id: 'prefs', icon: Sliders, label: 'Trading' },
    { id: 'alerts', icon: BellRing, label: 'Alerts' },
  ];

  return (
    <div className="p-4 pt-10 min-h-screen pb-24">
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

      {/* Connection Dashboard */}
      <div className="glass-panel border border-border rounded-2xl p-4 mb-6 grid grid-cols-2 gap-3">
        <div className="bg-input rounded-xl p-3 border border-white/5">
          <p className="text-[10px] text-muted-foreground uppercase mb-1">Broker Status</p>
          <p className="font-bold text-sm text-primary flex items-center gap-1"><CheckCircle2 size={14}/> Connected</p>
        </div>
        <div className="bg-input rounded-xl p-3 border border-white/5">
          <p className="text-[10px] text-muted-foreground uppercase mb-1">AI Status</p>
          <p className="font-bold text-sm text-accent flex items-center gap-1"><CheckCircle2 size={14}/> Active</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-input p-1 rounded-xl mb-6 overflow-x-auto no-scrollbar">
        {TABS.map(t => {
          const Icon = t.icon;
          return (
            <button 
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 min-w-[80px] py-2 text-[11px] font-bold rounded-lg transition-all flex flex-col items-center gap-1 ${
                activeTab === t.id ? 'bg-card text-foreground shadow border border-white/5' : 'text-muted-foreground'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="space-y-4">
        {activeTab === 'broker' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">Broker Connection</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Select Broker</label>
                <select className="w-full bg-input border border-border rounded-xl h-12 px-3 text-sm text-foreground outline-none focus:border-accent">
                  <option>AngelOne SmartAPI</option>
                  <option>Groww API</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Client Code</label>
                <input type="text" defaultValue="AACE868566" className="w-full bg-input border border-border rounded-xl h-12 px-3 text-sm font-mono text-foreground outline-none focus:border-accent" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">PIN / Password</label>
                <input type="password" value="******" className="w-full bg-input border border-border rounded-xl h-12 px-3 text-sm font-mono text-foreground outline-none focus:border-accent" readOnly/>
              </div>
              <button className="w-full h-12 bg-accent text-background font-bold rounded-xl shadow-[0_0_15px_rgba(0,191,255,0.3)] mt-2">
                Validate & Connect
              </button>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">AI Configuration</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Provider</label>
                <select className="w-full bg-input border border-border rounded-xl h-12 px-3 text-sm text-foreground outline-none focus:border-accent">
                  <option>Google Gemini (Recommended)</option>
                  <option>OpenAI ChatGPT</option>
                  <option>Anthropic Claude</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">API Key</label>
                <input type="password" value="AIzaSyB-xxxxxxxxxxxxxx" className="w-full bg-input border border-border rounded-xl h-12 px-3 text-sm font-mono text-foreground outline-none focus:border-accent" readOnly/>
              </div>
              <button className="w-full h-12 bg-[#FFD700] text-background font-bold rounded-xl mt-2">
                Test AI Connection
              </button>
            </div>
          </div>
        )}

        {activeTab === 'prefs' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 space-y-4">
            <div className="flex items-center justify-between p-4 glass-panel border border-destructive/30 rounded-xl">
              <div>
                <h3 className="font-bold text-destructive flex items-center gap-2"><Shield size={16}/> Paper Trading Mode</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Use virtual money (₹10L) for practice.</p>
              </div>
              <button 
                onClick={() => setPaperMode(!paperMode)}
                className={`w-12 h-6 rounded-full transition-colors relative ${paperMode ? 'bg-destructive' : 'bg-input border border-border'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${paperMode ? 'translate-x-6' : 'translate-x-0.5'}`} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Trading Mode</label>
                <select 
                  value={tradingPrefs.mode}
                  onChange={(e) => updatePrefs({ mode: e.target.value })}
                  className="w-full bg-input border border-border rounded-xl h-12 px-3 text-sm text-foreground outline-none focus:border-accent"
                >
                  <option>Intraday</option>
                  <option>Swing</option>
                  <option>Scalping</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Default Quantity</label>
                <input 
                  type="number" 
                  value={tradingPrefs.defaultQty}
                  onChange={(e) => updatePrefs({ defaultQty: Number(e.target.value) })}
                  className="w-full bg-input border border-border rounded-xl h-12 px-3 text-sm font-mono text-foreground outline-none focus:border-accent" 
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="p-4 bg-input rounded-xl border border-white/5 text-center">
              <AlertCircle className="mx-auto text-accent mb-2" size={32} />
              <h3 className="font-bold text-foreground">Alerts Configuration</h3>
              <p className="text-xs text-muted-foreground mt-1">Notification permissions required to enable price alerts and AI signal triggers.</p>
              <button className="mt-4 px-6 py-2 bg-card border border-border rounded-lg text-sm font-bold active:scale-95 transition-transform">
                Request Permission
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
