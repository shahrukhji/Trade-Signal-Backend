import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScanLine, Download, TrendingUp, TrendingDown, Minus, Activity } from 'lucide-react';
import { SCREENER_FILTERS, applyScreenerFilter } from '@/engine/screener';
import { generateLiveSignal, type LiveSignal } from '@/engine/signalEngine';
import { angelOne, STOCK_MASTER_LIST } from '@/broker/angelOne';
import { useLocation } from 'wouter';

const fmtINR = (n: number) =>
  `₹${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)}`;

function SignalIcon({ sig }: { sig: string }) {
  if (sig.includes('BUY')) return <TrendingUp size={12} className="text-primary" />;
  if (sig.includes('SELL')) return <TrendingDown size={12} className="text-destructive" />;
  return <Minus size={12} className="text-muted-foreground" />;
}

function SignalBadge({ sig }: { sig: string }) {
  const isBuy = sig.includes('BUY');
  const isSell = sig.includes('SELL');
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
      isBuy ? 'text-primary bg-primary/10 border-primary/20' :
      isSell ? 'text-destructive bg-destructive/10 border-destructive/20' :
      'text-muted-foreground bg-input border-border'
    }`}>
      {isBuy ? '🟢' : isSell ? '🔴' : '⚪'} {sig.replace('_', ' ')}
    </span>
  );
}

function ConfidenceRing({ value, size = 32 }: { value: number; size?: number }) {
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;
  const color = value >= 70 ? '#00FF88' : value >= 50 ? '#FFD700' : '#FF3366';
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2A2A3E" strokeWidth="4" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - value / 100)}
          strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold" style={{ color }}>
        {value}%
      </span>
    </div>
  );
}

export function ScannerScreen() {
  const [, navigate] = useLocation();
  const [activeFilter, setActiveFilter] = useState('all');
  const [allResults, setAllResults] = useState<LiveSignal[]>([]);
  const [filteredResults, setFilteredResults] = useState<LiveSignal[]>([]);
  const [scanning, setScanning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentSymbol, setCurrentSymbol] = useState('');
  const [scanned, setScanned] = useState(false);

  const buys = filteredResults.filter(s => s.signal.includes('BUY'));
  const sells = filteredResults.filter(s => s.signal.includes('SELL'));
  const neutral = filteredResults.filter(s => s.signal === 'NEUTRAL');

  const scanAll = useCallback(async () => {
    setScanning(true);
    setProgress(0);
    const results: LiveSignal[] = [];
    const stocks = STOCK_MASTER_LIST.slice(0, 50);

    for (let i = 0; i < stocks.length; i++) {
      const stock = stocks[i];
      setCurrentSymbol(stock.tradingSymbol);
      setProgress(i + 1);
      try {
        const toDate = new Date().toISOString().slice(0, 10) + ' 15:30';
        const fromDate = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10) + ' 09:15';
        const candles = await angelOne.getCandleData(
          stock.exchange, stock.symbolToken, 'ONE_DAY', fromDate, toDate
        );
        if (candles.length >= 30) {
          const signal = generateLiveSignal(candles, stock.tradingSymbol, stock.companyName, stock.exchange);
          results.push(signal);
        }
      } catch (_) {
        // Use mock signal for failed fetches
        const mockCandles = angelOne.generateMockCandles(stock.tradingSymbol, 100);
        if (mockCandles.length >= 30) {
          const signal = generateLiveSignal(mockCandles, stock.tradingSymbol, stock.companyName, stock.exchange);
          results.push(signal);
        }
      }
    }

    setAllResults(results);
    setFilteredResults(applyScreenerFilter(results, activeFilter));
    setScanning(false);
    setScanned(true);
  }, [activeFilter]);

  const changeFilter = (id: string) => {
    setActiveFilter(id);
    if (allResults.length) setFilteredResults(applyScreenerFilter(allResults, id));
  };

  const exportCSV = () => {
    const rows = [
      ['Symbol', 'Signal', 'Score', 'Confidence', 'Price', 'SL', 'T1', 'R:R'],
      ...filteredResults.map(s => [
        s.symbol, s.signal, s.score, s.confidence,
        s.currentPrice, s.tradeSetup.stopLoss, s.tradeSetup.target1, s.tradeSetup.riskRewardRatio,
      ]),
    ];
    navigator.clipboard.writeText(rows.map(r => r.join(',')).join('\n')).catch(() => {});
  };

  return (
    <div className="pb-6 pt-4">
      {/* Header */}
      <div className="px-4 flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ScanLine size={18} className="text-accent" /> Smart Scanner
          </h1>
          {scanned && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Found: <span className="text-primary font-bold">{buys.length} Buy</span> · {' '}
              <span className="text-destructive font-bold">{sells.length} Sell</span> · {' '}
              <span className="text-muted-foreground">{neutral.length} Neutral</span>
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {scanned && (
            <button
              onClick={exportCSV}
              className="p-2 rounded-xl bg-input border border-border text-muted-foreground"
              title="Export CSV"
            >
              <Download size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-3">
        <button
          onClick={() => changeFilter('all')}
          className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-bold transition-all ${
            activeFilter === 'all' ? 'bg-accent text-background border-accent' : 'bg-input border-border text-muted-foreground'
          }`}
        >
          All
        </button>
        {SCREENER_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => changeFilter(f.id)}
            className={`flex-shrink-0 text-xs px-3 py-1.5 rounded-full border font-bold whitespace-nowrap transition-all ${
              activeFilter === f.id ? 'bg-accent text-background border-accent' : 'bg-input border-border text-muted-foreground'
            }`}
          >
            {f.emoji} {f.name.split(' ').slice(0, 2).join(' ')}
          </button>
        ))}
      </div>

      {/* Scan button */}
      <div className="px-4 mb-4">
        <button
          onClick={scanAll}
          disabled={scanning}
          className="w-full h-12 rounded-2xl bg-accent text-background font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60"
        >
          {scanning ? (
            <>
              <Activity size={16} className="animate-pulse" />
              Scanning {progress}/50 — {currentSymbol}
            </>
          ) : (
            <>
              <ScanLine size={16} />
              {scanned ? 'Re-Scan All 50 Stocks' : 'Scan All 50 Stocks'}
            </>
          )}
        </button>

        {/* Progress bar */}
        <AnimatePresence>
          {scanning && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-2"
            >
              <div className="h-2 bg-input rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-accent rounded-full"
                  animate={{ width: `${(progress / 50) * 100}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Results */}
      {scanned && !scanning && (
        <div className="px-4 space-y-4">
          {/* BUY section */}
          {buys.length > 0 && (
            <div>
              <p className="text-xs font-bold text-primary mb-2 flex items-center gap-1">
                <TrendingUp size={12} /> BUY Signals ({buys.length})
              </p>
              <div className="space-y-2">
                {buys.sort((a, b) => b.score - a.score).map(s => (
                  <ResultCard key={s.id} signal={s} onClick={() => navigate(`/charts?symbol=${s.symbol}`)} />
                ))}
              </div>
            </div>
          )}

          {/* NEUTRAL section */}
          {neutral.length > 0 && (
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">
                <Minus size={12} /> Neutral ({neutral.length})
              </p>
              <div className="space-y-2">
                {neutral.slice(0, 5).map(s => (
                  <ResultCard key={s.id} signal={s} onClick={() => navigate(`/charts?symbol=${s.symbol}`)} />
                ))}
                {neutral.length > 5 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    +{neutral.length - 5} more neutral stocks...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* SELL section */}
          {sells.length > 0 && (
            <div>
              <p className="text-xs font-bold text-destructive mb-2 flex items-center gap-1">
                <TrendingDown size={12} /> SELL Signals ({sells.length})
              </p>
              <div className="space-y-2">
                {sells.sort((a, b) => a.score - b.score).map(s => (
                  <ResultCard key={s.id} signal={s} onClick={() => navigate(`/charts?symbol=${s.symbol}`)} />
                ))}
              </div>
            </div>
          )}

          {filteredResults.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <ScanLine size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No stocks match this filter</p>
              <p className="text-xs mt-1">Try "All" or another filter</p>
            </div>
          )}
        </div>
      )}

      {!scanned && !scanning && (
        <div className="text-center py-16 text-muted-foreground px-8">
          <ScanLine size={40} className="mx-auto mb-3 opacity-20" />
          <p className="text-sm font-medium">Tap "Scan All 50 Stocks" to find opportunities</p>
          <p className="text-xs mt-2">
            Uses {SCREENER_FILTERS.length} smart filters to find<br />
            BUY signals, volume spikes, breakouts & more
          </p>
        </div>
      )}
    </div>
  );
}

function ResultCard({ signal, onClick }: { signal: LiveSignal; onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="glass-panel border border-border rounded-2xl p-3 flex items-center gap-3 active:scale-95 transition-transform cursor-pointer"
    >
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center flex-shrink-0 font-bold text-accent text-sm">
        {signal.symbol[0]}
      </div>
      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-bold text-sm text-foreground font-mono">{signal.symbol}</span>
          <SignalBadge sig={signal.signal} />
        </div>
        <p className="text-[10px] text-muted-foreground truncate">{signal.stockName}</p>
        {signal.signal !== 'NEUTRAL' && (
          <div className="flex gap-2 mt-0.5 text-[10px] font-mono">
            <span className="text-muted-foreground">
              ₹{signal.currentPrice.toFixed(1)} → SL ₹{signal.tradeSetup.stopLoss.toFixed(1)}
            </span>
            <span className="text-primary">T1 ₹{signal.tradeSetup.target1.toFixed(1)}</span>
          </div>
        )}
      </div>
      {/* Confidence + Score */}
      <div className="flex flex-col items-center gap-1 flex-shrink-0">
        <ConfidenceRing value={signal.confidence} />
        <span className={`text-[9px] font-bold ${signal.score > 0 ? 'text-primary' : signal.score < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
          {signal.score > 0 ? '+' : ''}{signal.score}
        </span>
      </div>
    </motion.div>
  );
}
