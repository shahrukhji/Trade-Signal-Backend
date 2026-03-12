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
7. `/scanner` — NIFTY50 scanner overlay (SSE progress)

**Key Features:**
- Paper Trading Mode (red banner on every screen)
- Global status dots (Broker | Gemini | Market)
- Real engine OHLCV generation (250 candles per symbol, live ±tick every 3s)
- Watermark: "Made with ❤️ by Shahrukh" on every screen
- localStorage: broker_auth, gemini_config, trading_prefs, watchlist, paper_portfolio, signal_history

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

## Key Files
- `artifacts/api-server/src/routes/index.ts` — All API routes
- `artifacts/api-server/src/lib/signal-engine.ts` — Signal scoring
- `artifacts/api-server/src/lib/indicators.ts` — Technical indicators
- `artifacts/tradesignal-pro/src/App.tsx` — Route config
- `artifacts/tradesignal-pro/src/components/Layout.tsx` — Bottom nav + paper mode banner
- `artifacts/tradesignal-pro/src/components/ChartWidget.tsx` — lightweight-charts v5 wrapper
- `artifacts/tradesignal-pro/src/hooks/use-trading.ts` — Mock data + indicator hooks
- `artifacts/tradesignal-pro/src/store/use-store.ts` — Zustand global state
