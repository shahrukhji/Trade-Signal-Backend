import { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Home, BarChart2, Zap, Briefcase, Settings, Activity } from 'lucide-react';
import { useStore } from '@/store/use-store';

export function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { paperMode } = useStore();

  const tabs = [
    { id: '/home', icon: Home, label: 'Home' },
    { id: '/charts', icon: BarChart2, label: 'Charts' },
    { id: '/signals', icon: Zap, label: 'Signals' },
    { id: '/portfolio', icon: Briefcase, label: 'Portfolio' },
    { id: '/settings', icon: Settings, label: 'Settings' },
  ];

  // Hide nav on splash screen
  if (location === '/') return <>{children}</>;

  return (
    <div className="mobile-container flex flex-col">
      {/* Paper Mode Banner */}
      {paperMode && (
        <div className="bg-destructive/10 text-destructive text-xs font-bold py-1 text-center w-full uppercase tracking-wider flex items-center justify-center gap-1">
          <Activity size={12} /> Paper Trading Active
        </div>
      )}

      {/* Global Status Bar */}
      <div className="absolute top-[28px] right-4 flex gap-1.5 z-50">
        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" title="Broker Connected" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary" title="Gemini AI Active" />
        <div className="w-1.5 h-1.5 rounded-full bg-primary" title="Market Open" />
      </div>

      {/* Main Content Area - Scrollable */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-[80px]">
        {children}
        
        {/* Watermark */}
        <div className="mt-8 mb-4 border-t border-border/50 mx-8 pt-4 flex flex-col items-center justify-center text-[11px] text-muted-foreground">
          <p>Made with <span className="text-destructive">❤️</span> by Shahrukh</p>
        </div>
      </main>

      {/* Fixed Bottom Nav */}
      <nav className="absolute bottom-0 w-full h-[64px] glass-panel border-t border-white/10 flex items-center justify-around px-2 z-50">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = location.startsWith(tab.id);
          return (
            <Link 
              key={tab.id} 
              href={tab.id}
              className={`flex flex-col items-center justify-center w-16 h-full transition-all duration-200 ${
                isActive ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon size={22} className={isActive ? 'mb-1 drop-shadow-[0_0_8px_rgba(0,191,255,0.5)]' : 'mb-1'} />
              <span className="text-[10px] font-medium">{tab.label}</span>
              {isActive && (
                <div className="absolute top-0 w-8 h-[2px] bg-accent rounded-b-md shadow-[0_2px_8px_rgba(0,191,255,0.8)]" />
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
