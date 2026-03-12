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
- Mock data fallback (200 OHLCV candles, live ±tick simulation)
- Watermark: "Made with ❤️ by Shahrukh" on every screen
- localStorage: broker_auth, gemini_config, trading_prefs, watchlist, paper_portfolio, signal_history

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
