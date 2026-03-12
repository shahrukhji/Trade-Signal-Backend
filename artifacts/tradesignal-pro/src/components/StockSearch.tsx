import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Clock, TrendingUp } from 'lucide-react';
import { angelOne, type SearchResult } from '@/broker/angelOne';

export interface StockSearchResult extends SearchResult {}

interface Props {
  onSelectStock: (stock: StockSearchResult) => void;
  placeholder?: string;
  className?: string;
}

const POPULAR = ['RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'SBIN', 'ITC', 'WIPRO', 'TATAMOTORS'];

const SECTOR_COLORS: Record<string, string> = {
  'IT': '#00BFFF', 'Banking': '#A855F7', 'Finance': '#FFD700',
  'Oil & Gas': '#FF8C00', 'FMCG': '#00FF88', 'Auto': '#FF3366',
  'Pharma': '#EC4899', 'Metal': '#94A3B8', 'Power': '#F59E0B',
  'Telecom': '#6366F1', 'Infrastructure': '#14B8A6', 'Consumer': '#F97316',
};

function sectorColor(sector?: string): string {
  return sector ? (SECTOR_COLORS[sector] || '#888') : '#888';
}

const LS_KEY = 'tradesignal_recent_stocks';

function getRecent(): SearchResult[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]');
  } catch { return []; }
}

function saveRecent(stock: SearchResult) {
  const prev = getRecent().filter(s => s.tradingSymbol !== stock.tradingSymbol);
  localStorage.setItem(LS_KEY, JSON.stringify([stock, ...prev].slice(0, 5)));
}

export function StockSearch({ onSelectStock, placeholder = 'Search stocks...', className = '' }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [recent, setRecent] = useState<SearchResult[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setRecent(getRecent());
  }, []);

  // Debounced search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const res = await angelOne.searchStock(query);
      setResults(res);
      setLoading(false);
      setHighlighted(-1);
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = useCallback((stock: SearchResult) => {
    saveRecent(stock);
    setRecent(getRecent());
    setQuery(stock.tradingSymbol);
    setIsOpen(false);
    onSelectStock(stock);
  }, [onSelectStock]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const list = query ? results : [];
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlighted(h => Math.min(h + 1, list.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlighted(h => Math.max(h - 1, -1));
    } else if (e.key === 'Enter' && highlighted >= 0 && list[highlighted]) {
      handleSelect(list[highlighted]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const handlePopular = async (sym: string) => {
    const stock = await angelOne.searchStockBySymbol(sym);
    if (stock) handleSelect(stock);
  };

  const showDropdown = isOpen && (query.length > 0 || recent.length > 0);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Input */}
      <div className="relative flex items-center">
        <Search size={15} className="absolute left-3 text-muted-foreground pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full h-12 bg-input border border-border rounded-xl pl-9 pr-9 text-sm text-foreground outline-none focus:border-accent transition-colors font-mono"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
            className="absolute right-3 text-muted-foreground hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Popular chips (shown when not searching) */}
      {!query && !showDropdown && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {POPULAR.map(sym => (
            <button
              key={sym}
              onClick={() => handlePopular(sym)}
              className="text-[11px] bg-input border border-border px-2.5 py-1 rounded-full text-muted-foreground hover:text-foreground hover:border-accent transition-colors font-mono"
            >
              {sym}
            </button>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {showDropdown && (
        <div
          className="absolute top-full left-0 w-full mt-1 z-[1000] rounded-xl border border-border overflow-hidden shadow-2xl"
          style={{ background: '#12121A', maxHeight: 400, overflowY: 'auto' }}
        >
          {/* Recent searches */}
          {!query && recent.length > 0 && (
            <div className="px-3 pt-3 pb-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-2">
                <Clock size={10} /> Recent
              </p>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {recent.map(s => (
                  <button
                    key={s.tradingSymbol}
                    onClick={() => handleSelect(s)}
                    className="text-[11px] bg-card border border-border px-2 py-0.5 rounded-full text-muted-foreground hover:text-foreground font-mono"
                  >
                    {s.tradingSymbol}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search results */}
          {query && loading && (
            <div className="px-4 py-3 text-sm text-muted-foreground">Searching...</div>
          )}
          {query && !loading && results.length === 0 && (
            <div className="px-4 py-3 text-sm text-muted-foreground">No stocks found for "{query}"</div>
          )}
          {query && !loading && results.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider px-3 pt-2 pb-1 flex items-center gap-1">
                <TrendingUp size={10} /> Results
              </p>
              {results.map((stock, idx) => (
                <div
                  key={stock.tradingSymbol}
                  onClick={() => handleSelect(stock)}
                  className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${highlighted === idx ? 'bg-accent/10' : 'hover:bg-white/5'}`}
                >
                  {/* Sector avatar */}
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold text-background"
                    style={{ background: sectorColor(stock.sector) }}
                  >
                    {stock.companyName[0]}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">{stock.tradingSymbol}</span>
                      {stock.sector && (
                        <span
                          className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase"
                          style={{ background: sectorColor(stock.sector) + '20', color: sectorColor(stock.sector) }}
                        >
                          {stock.sector}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{stock.companyName}</p>
                  </div>
                  {/* Exchange */}
                  <span className="text-[10px] bg-accent/10 text-accent border border-accent/20 px-2 py-0.5 rounded-full font-bold flex-shrink-0">
                    {stock.exchange}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Popular stocks when focused with no query */}
          {!query && (
            <div className="px-3 pb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1 mb-2">
                <TrendingUp size={10} /> Popular
              </p>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR.map(sym => (
                  <button
                    key={sym}
                    onClick={() => { handlePopular(sym); }}
                    className="text-[11px] bg-card border border-border px-2.5 py-1 rounded-full text-muted-foreground hover:text-foreground hover:border-accent transition-colors font-mono"
                  >
                    {sym}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
