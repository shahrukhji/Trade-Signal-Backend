# TradeSignal Pro

A full-stack algorithmic trading signal app for Indian markets (NSE/BSE), optimized for Android.

## Architecture

**Monorepo** managed by pnpm workspaces.

### Backend — `artifacts/api-server`
- Node.js + Express, port 8080
- AngelOne SmartAPI integration with TOTP auto-login (speakeasy)
- Groww broker adapter (stub, extendable)
- 15+ technical indicators via `technicalindicators`
- 30+ candlestick/chart pattern detection
- Signal scoring engine
- Paper trading engine (virtual ₹10L balance)
- GTT (Good Till Triggered) orders
- Real-time SSE streaming (`/api/live`)
- AI analysis routing (`/api/ai`) — Gemini/OpenAI/Claude
- NIFTY50 scanner (`/api/scanner`)
- Rate limiting via `bottleneck`
- Cron jobs via `node-cron`

**Routes:** `/api/auth`, `/api/market`, `/api/orders`, `/api/portfolio`, `/api/signals`, `/api/scanner`, `/api/gtt`, `/api/symbols`, `/api/live`, `/api/ai`, `/api/paper`

### Frontend — `artifacts/tradesignal-pro`
- React + TypeScript + Tailwind CSS
- Vite build, port 19288, previewPath `/`
- Dark trading theme: bg #0A0A0F, green #00FF88, red #FF3366, accent #00BFFF
- TradingView `lightweight-charts` v5 for candlestick charts
- Framer Motion animations
- Zustand global state
- Sonner toasts
- Wouter client-side routing
- React Query for API calls

**Screens:**
1. `/` — Splash (2.5s auto-navigate)
2. `/home` — Dashboard with portfolio summary, market indices, signals
3. `/charts` — Full candlestick chart with indicators, AI analysis, execute trade
4. `/signals` — Signal cards with confidence, entry/target/SL
5. `/portfolio` — Holdings, open orders, trade history
6. `/settings` — Broker connection, AI config, trading preferences
7. `/scanner` — Smart Scanner: scan 50 stocks with 10 filters (Oversold, Volume Spike, Breakout, etc.)
8. `/strategies` — Strategy Lab: AI market condition detector + 10 strategies with confluence scoring
9. `/account` — Angel One broker login + holdings/positions/orders tabs (post-login)

**Key Features:**
- Paper Trading Mode (red banner on every screen)
- Global status dots (Broker | Gemini | Market)
- Real engine OHLCV generation (250 candles per symbol, live ±tick every 3s)
- Watermark: "Made with ❤️ by Shahrukh" on every screen
- localStorage: broker_auth, gemini_config, trading_prefs, watchlist, paper_portfolio, signal_history

### New Engine Files (strategies, risk, screener)

**strategies.ts** — 10 trading strategies (each returns StrategySignal with entry/SL/TP/RR):
Trend Following, RSI Oversold Bounce, MACD Crossover, Bollinger Mean Reversion, Volume Breakout, Supertrend Momentum, ADX Trend Filter, VWAP Bounce, EMA Pullback, Range Bound Trader
- `detectMarketCondition(candles)` — returns STRONG_UPTREND…STRONG_DOWNTREND with confidence
- `recommendBestStrategies(candles)` — ranks strategies for current market conditions
- All strategies return `StrategySignal { action, entry, stopLoss, target, rr, confidence, reason }`

**riskManager.ts** — RiskManager class:
- `calculatePositionSize()` — Kelly Criterion + 1% rule (whichever is smaller)
- `validateTrade()` — checks daily loss limit, max position count, trade size limits
- `calculateRisk()` — detailed risk/reward metrics
- `createTradeAlert()` — real-time monitoring alert
- Configurable risk params: maxPositionSizePct, maxDailyLossPct, maxPositions

**screener.ts** — StockScreener class:
- 10 built-in filters: BUY signals, oversold, volume spike, breakout, Supertrend, MACD, EMA cross, Bollinger squeeze, ADX strong trend, near support
- `screenStocks(stocks, filterKey)` — returns ScreenerResult[] with all signal details
- `getPopularStocksForFilter(filterKey)` — returns top matching stocks

### Core Analysis Engine — `artifacts/tradesignal-pro/src/engine/`

**indicators.ts** — 20 pure-math indicator functions:
SMA, EMA, RSI, MACD, BollingerBands, Stochastic, ATR, Supertrend, ADX, VWAP, OBV, CCI, WilliamsR, MFI, ParabolicSAR, PivotPoints, findSupportResistance, detectRSIDivergence, analyzeVolume, findSwingLow/findSwingHigh

**patterns.ts** — 30 pattern detectors:
22 candlestick (Doji, Dragonfly/Gravestone Doji, Hammer, Inverted Hammer, Shooting Star, Hanging Man, Bullish/Bearish Engulfing/Harami, Piercing Line, Dark Cloud Cover, Tweezer Top/Bottom, Morning/Evening Star, Three White Soldiers, Three Black Crows, Marubozu, Spinning Top)
8 chart (Double Bottom, Double Top, Ascending/Descending Triangle, Falling/Rising Wedge, Bull/Bear Flag)

**signalEngine.ts** — Multi-indicator confluence scoring:
- Scores every indicator: EMA crossovers (±8), MACD (±5), RSI (±5), RSI Divergence (±3), Supertrend (±2), Stochastic (±2), Bollinger Bands (±2), Volume Spike (±3), VWAP (±1), MFI (±2), CCI (±1), ADX (±1), PSAR (±1), S/R levels (±3), candlestick patterns (±3 each), chart patterns (±3 each)
- Outputs: STRONG_BUY → STRONG_SELL with 0-95% confidence, ATR-based SL/TP, R:R ratio
- `generateLiveSignal()` — the main function called by the frontend

**monitor.ts** — LiveMarketMonitor class:
- Continuous scanning with configurable interval
- Batch + single-stock scan modes
- Live tick simulation for demo mode
- createMonitor() factory function

**Integration:**
- `use-trading.ts` hooks: `useMarketData`, `useIndicators`, `useSignalAnalysis`, `useMultiSignals` all use real engine
- `ChartScreen.tsx` — shows live RSI, MACD, Supertrend, patterns from engine
- `Signals.tsx` — shows real engine signals for 8 NIFTY stocks with full detail modal

### Shared Libraries
- `lib/api-spec` — OpenAPI 3.0 spec (18 endpoints)
- `lib/api-client-react` — Orval-generated React Query hooks
- `lib/api-zod` — Orval-generated Zod schemas

## Secrets Required
- `ANGELONE_API_KEY`
- `ANGELONE_CLIENT_CODE`
- `ANGELONE_PIN`
- `ANGELONE_TOTP_SECRET`
- `SESSION_SECRET`

## Running
- API Server: `pnpm --filter @workspace/api-server run dev`
- Frontend: `pnpm --filter @workspace/tradesignal-pro run dev`
- Codegen: `pnpm --filter @workspace/api-spec run codegen`

### Broker Integration — `artifacts/tradesignal-pro/src/broker/angelOne.ts`

**AngelOneService** (singleton `angelOne`):
- `login(credentials)` — calls SmartAPI, falls back to demo mode on network failure
- `logout()` / `refreshSession()` — JWT management
- `restoreSession(session, isDemo, apiKey)` — re-hydrate service from localStorage on app launch
- `getWalletBalance()` / `getHoldings()` / `getPositions()` — portfolio data
- `getOrderBook()` / `placeOrder()` / `modifyOrder()` / `cancelOrder()` — order management
- `getQuote()` / `getCandleData()` — market data (live or mock)
- `searchStock(query)` — fuzzy search over 50 NSE NIFTY stocks
- `placeBracketOrder()` / `placeGTTOrder()` — advanced order types
- All methods instantly return rich mock data when session is null or in demo mode

**Store integration** (`use-store.ts`):
- `brokerSession`, `brokerProfile`, `brokerIsDemo`, `brokerApiKey` — persisted to localStorage
- `walletBalance`, `holdings`, `positions`, `orderBook` — live data (in-memory)
- `setBrokerSession()` / `clearBrokerSession()` — connect/disconnect actions

**Settings screen** — full live broker login form:
- Client Code, Password/PIN (with show/hide), SmartAPI Key, TOTP fields
- Real-time connect button with loading state + error display
- Connected profile card (avatar initials, exchanges, products, last login)
- Disconnect button, AI config tab, trading prefs tab

**Portfolio screen** — fully live:
- Portfolio Value, Invested, Overall P&L%, Today's P&L, Available Cash from wallet
- Open Positions section (auto-shown if positions exist)
- Holdings list with company name, qty, avg price, P&L, day change, animated P&L bar
- Orders tab: full order book with status badges (complete/open/trigger/cancelled)
- Refresh button (pulls fresh data from service)

## Key Files
- `artifacts/api-server/src/routes/index.ts` — All API routes
- `artifacts/tradesignal-pro/src/broker/angelOne.ts` — Angel One SmartAPI integration
- `artifacts/tradesignal-pro/src/App.tsx` — Route config
- `artifacts/tradesignal-pro/src/components/Layout.tsx` — Bottom nav + paper mode banner
- `artifacts/tradesignal-pro/src/components/ChartWidget.tsx` — lightweight-charts v5 wrapper
- `artifacts/tradesignal-pro/src/hooks/use-trading.ts` — Engine hooks
- `artifacts/tradesignal-pro/src/store/use-store.ts` — Zustand global state (with broker session)
- `artifacts/tradesignal-pro/src/pages/Settings.tsx` — Broker login + AI + prefs
- `artifacts/tradesignal-pro/src/pages/Portfolio.tsx` — Live holdings/positions/orders
