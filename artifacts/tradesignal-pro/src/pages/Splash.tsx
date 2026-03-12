import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';

export function Splash() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const timer = setTimeout(() => {
      setLocation('/home');
    }, 2500);
    return () => clearTimeout(timer);
  }, [setLocation]);

  return (
    <div className="mobile-container flex flex-col items-center justify-center bg-[#0A0A0F]">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative w-32 h-32 mb-8 flex items-center justify-center"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
        
        {/* Actual Image */}
        <img 
          src={`${import.meta.env.BASE_URL}images/splash-logo.png`}
          alt="TradeSignal Pro Logo" 
          className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_15px_rgba(0,255,136,0.5)]"
        />
      </motion.div>

      <motion.h1 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="text-3xl font-bold text-foreground tracking-tight mb-2"
      >
        TradeSignal <span className="text-primary">Pro</span>
      </motion.h1>

      <motion.p
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
        className="text-muted-foreground text-sm font-medium tracking-wide uppercase"
      >
        Algorithmic Intelligence
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.5 }}
        className="absolute bottom-16 flex flex-col items-center"
      >
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-xs text-muted-foreground font-mono">Connecting to markets...</p>
      </motion.div>
    </div>
  );
}
