import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { X, Activity, CheckCircle2 } from 'lucide-react';

export function ScannerOverlay() {
  const [, setLocation] = useLocation();
  const [progress, setProgress] = useState(0);
  const [currentStock, setCurrentStock] = useState('RELIANCE');
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Simulate SSE progress for scanner
    const stocks = ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'ITC', 'SBIN', 'L&T', 'BAJFINANCE', 'BHARTIARTL'];
    let i = 0;
    
    const interval = setInterval(() => {
      if (i < stocks.length) {
        setCurrentStock(stocks[i]);
        setProgress(((i + 1) / stocks.length) * 100);
        i++;
      } else {
        setDone(true);
        clearInterval(interval);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 50 }}
      className="fixed inset-0 z-50 bg-[#0A0A0F]/95 backdrop-blur-xl flex flex-col p-6 max-w-md mx-auto"
    >
      <div className="flex justify-between items-center mb-10 mt-4">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Activity className="text-accent" /> AI Market Scanner
        </h2>
        <button onClick={() => setLocation('/home')} className="p-2 bg-card rounded-full border border-border active:scale-90 transition-transform">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center text-center">
        {!done ? (
          <>
            <div className="w-24 h-24 relative mb-8">
              <div className="absolute inset-0 border-4 border-border rounded-full" />
              <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                <circle
                  cx="48" cy="48" r="46"
                  stroke="currentColor" strokeWidth="4" fill="none"
                  className="text-accent transition-all duration-300"
                  strokeDasharray="289"
                  strokeDashoffset={289 - (289 * progress) / 100}
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-xl">
                {Math.round(progress)}%
              </div>
            </div>
            <h3 className="text-lg font-bold text-foreground mb-1">Scanning NIFTY 50</h3>
            <p className="text-sm text-muted-foreground font-mono">Analyzing {currentStock}...</p>
            <p className="text-xs text-primary mt-4 animate-pulse">Running 20+ indicators & AI models</p>
          </>
        ) : (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
            <div className="w-20 h-20 bg-primary/20 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h3 className="text-2xl font-bold text-foreground mb-2">Scan Complete</h3>
            <p className="text-muted-foreground mb-8">Found 3 Strong Buy setups.</p>
            <button 
              onClick={() => setLocation('/signals')}
              className="w-full py-4 bg-accent text-background font-bold rounded-xl shadow-[0_0_20px_rgba(0,191,255,0.4)] active:scale-95 transition-transform"
            >
              View Results
            </button>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
