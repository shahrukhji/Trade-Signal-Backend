import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import {
  Home, BarChart2, Zap, Briefcase, Settings, Activity,
  ScanLine, Target, User,
} from 'lucide-react';
import { useStore } from '@/store/use-store';
import { angelOne } from '@/broker/angelOne';

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { paperMode, brokerSession, brokerIsDemo } = useStore();

  const tabs = [
    { id: '/home',       icon: Home,      label: 'Home'     },
    { id: '/charts',     icon: BarChart2,  label: 'Charts'   },
    { id: '/signals',    icon: Zap,        label: 'Signals'  },
    { id: '/strategies', icon: Target,     label: 'Strategy' },
    { id: '/scanner',    icon: ScanLine,   label: 'Scanner'  },
    { id: '/portfolio',  icon: Briefcase,  label: 'Portfolio'},
    { id: '/account',    icon: User,       label: 'Account'  },
    { id: '/settings',   icon: Settings,   label: 'Settings' },
  ];

  // Connection status dots
  const isConnected = !!brokerSession && !brokerIsDemo;
  const isDemo = !!brokerSession && brokerIsDemo;

  // Hide nav on splash screen
  if (location === '/') return <>{children}</>;

  return (
    <div className="mobile-container flex flex-col">
      {/* Paper Mode Banner */}
      {paperMode && (
        <div className="bg-destructive/10 text-destructive text-xs font-bold py-1 text-center w-full uppercase tracking-wider flex items-center justify-center gap-1 flex-shrink-0">
          <Activity size={12} /> Paper Trading Active
        </div>
      )}

      {/* Global Status Bar */}
      <div className="absolute top-[28px] right-4 flex gap-1.5 z-50">
        <div
          className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-primary animate-pulse' : isDemo ? 'bg-yellow-400' : 'bg-muted-foreground'}`}
          title={isConnected ? 'Broker Connected' : isDemo ? 'Demo Mode' : 'Disconnected'}
        />
        <div className="w-1.5 h-1.5 rounded-full bg-primary" title="Market Active" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary" title="Engine Running" />
      </div>

      {/* Main Content Area - Scrollable */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-[72px]">
        {children}

        {/* Watermark */}
        <div className="mt-8 mb-4 border-t border-border/50 mx-8 pt-4 flex flex-col items-center justify-center text-[11px] text-muted-foreground">
          <p>Made with <span className="text-destructive">❤️</span> by Shahrukh</p>
        </div>
      </main>

      {/* Fixed Bottom Nav — horizontally scrollable for 8 tabs */}
      <nav className="absolute bottom-0 w-full h-[64px] glass-panel border-t border-white/10 z-50 overflow-x-auto no-scrollbar">
        <div className="flex items-center h-full min-w-max px-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = location.startsWith(tab.id);
            return (
              <Link
                key={tab.id}
                href={tab.id}
                className={`relative flex flex-col items-center justify-center w-[11.5vw] min-w-[58px] h-full transition-all duration-200 flex-shrink-0 ${
                  isActive ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon
                  size={20}
                  className={isActive ? 'mb-0.5 drop-shadow-[0_0_8px_rgba(0,191,255,0.5)]' : 'mb-0.5'}
                />
                <span className="text-[9px] font-medium leading-none">{tab.label}</span>
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-[2px] bg-accent rounded-b-md shadow-[0_2px_8px_rgba(0,191,255,0.8)]" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
