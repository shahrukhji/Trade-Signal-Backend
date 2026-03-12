# TradeSignal Pro — Backend

## Overview

Node.js + Express.js algo trading backend with AngelOne SmartAPI and Groww broker support, full technical indicator engine, signal scoring, pattern detection, paper trading, and real-time live data streaming.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Broker APIs**: AngelOne SmartAPI, Groww
- **TOTP**: speakeasy
- **Indicators**: technicalindicators
- **Rate limiting**: bottleneck
- **WebSocket**: ws
- **Scheduling**: node-cron

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/              # Express API server (TradeSignal Pro backend)
│   │   └── src/
│   │       ├── index.ts         # Startup: env validation, login, cron, listen
│   │       ├── app.ts           # Express app, CORS, JSON, route mounting at /api
│   │       ├── lib/
│   │       │   ├── constants.ts          # NIFTY50 tokens, indices, rate limits
│   │       │   ├── angelone.ts           # AngelOne SmartAPI client (auth, orders, market data)
│   │       │   ├── groww.ts              # Groww broker client
│   │       │   ├── broker-adapter.ts     # Unified BrokerAdapter pattern (X-Broker header routing)
│   │       │   ├── indicators.ts         # Full technical indicator library (EMA, MACD, RSI, BB, Supertrend...)
│   │       │   ├── patterns.ts           # Candlestick & chart pattern detection (30+ patterns)
│   │       │   ├── signal-engine.ts      # Signal scoring, classification, SL/target calculation
│   │       │   ├── market-hours.ts       # IST market session check (PRE/OPEN/CLOSED)
│   │       │   ├── paper-trading.ts      # Paper trading engine (₹10L virtual balance)
│   │       │   └── websocket-stream.ts   # AngelOne WebSocket + SSE broadcast
│   │       └── routes/
│   │           ├── health.ts     # GET /api/healthz
│   │           ├── auth.ts       # POST /api/auth/login, GET /api/auth/status
│   │           ├── market.ts     # POST /api/market/quote|candles, GET /api/market/status|indices|gainers-losers
│   │           ├── orders.ts     # POST /api/orders/place|modify|cancel, GET /api/orders/book|tradebook
│   │           ├── portfolio.ts  # GET /api/portfolio/holdings|positions|funds
│   │           ├── gtt.ts        # POST /api/gtt/create|modify|cancel|list, GET /api/gtt/details/:id
│   │           ├── signals.ts    # POST /api/signals/generate|scanner/run|indicators/calculate
│   │           ├── symbols.ts    # GET /api/symbols/search?q=&exchange=, /api/symbols/nifty50
│   │           ├── live.ts       # GET /api/live/stream (SSE), POST /api/live/subscribe
│   │           ├── ai.ts         # POST /api/ai/analyze (Gemini, OpenAI, Claude)
│   │           └── paper.ts      # GET /api/paper/portfolio, POST /api/paper/order|cancel
│   └── mockup-sandbox/          # Component Preview Server (design)
├── lib/
│   ├── api-spec/                # OpenAPI spec + Orval codegen config
│   ├── api-client-react/        # Generated React Query hooks
│   ├── api-zod/                 # Generated Zod schemas
│   └── db/                      # Drizzle ORM schema + DB connection
├── scripts/                     # Utility scripts
└── ...
```

## API Routes Reference

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login to AngelOne (auto TOTP) or Groww (token) |
| GET | /api/auth/status | Connection status, profile, expiry |

### Market Data
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/market/quote | Live quotes (LTP/OHLC/FULL) for up to 50 symbols |
| POST | /api/market/candles | Historical OHLCV candles (any interval) |
| GET | /api/market/status | Market session status (OPEN/PRE/CLOSED) in IST |
| GET | /api/market/indices | NIFTY50, BANKNIFTY, SENSEX, VIX live quotes |
| GET | /api/market/gainers-losers | Top gainers/losers |

### Orders
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/orders/place | Place order (real or paper-mode intercepted) |
| POST | /api/orders/modify | Modify existing order |
| POST | /api/orders/cancel | Cancel order |
| GET | /api/orders/book | Full order book |
| GET | /api/orders/tradebook | Trade book |
| GET | /api/orders/status/:uniqueorderid | Single order status |
| POST | /api/orders/convert-position | Convert position product type |

### Portfolio
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/portfolio/holdings | Long-term holdings |
| GET | /api/portfolio/positions | Intraday/short-term positions |
| GET | /api/portfolio/funds | Available funds & margins |

### GTT Orders
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/gtt/create | Create GTT rule |
| POST | /api/gtt/modify | Modify GTT rule |
| POST | /api/gtt/cancel | Cancel GTT rule |
| POST | /api/gtt/list | List GTT rules |
| GET | /api/gtt/details/:id | GTT rule details |

### Signals & Analysis
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/signals/generate | Fetch candles → compute indicators → generate signal |
| POST | /api/scanner/run | Scan all NIFTY50 (SSE progress events), returns filtered results |
| POST | /api/indicators/calculate | Compute indicators from provided candles array |

### Symbols
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/symbols/search?q=&exchange= | Search symbol scrip |
| GET | /api/symbols/nifty50 | All 50 NIFTY50 symbols with tokens |

### Live Streaming
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/live/stream | SSE stream of live tick data |
| POST | /api/live/subscribe | Subscribe WebSocket tokens |

### AI Analysis
| Method | Path | Description |
|--------|------|-------------|
| POST | /api/ai/analyze | Analyze chart with Gemini/OpenAI/Claude |

### Paper Trading
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/paper/portfolio | Virtual portfolio P&L (₹10L starting) |
| POST | /api/paper/order | Place simulated order |
| POST | /api/paper/cancel/:id | Cancel simulated order |

## Broker Routing

Send `X-Broker: ANGELONE` or `X-Broker: GROWW` header on all requests. Defaults to AngelOne.

## Technical Indicators

EMA (9/21/50/200), SMA (20), MACD (12/26/9), RSI (14), Bollinger Bands (20,2), ATR (14), ADX (14), Stochastic (14,3,3), OBV, VWAP, CCI (20), Williams %R (14), ROC (12), Supertrend (10,3), Pivot Points (Standard).

## Signal Scoring

Scores from −20 to +20. Classification:
- ≥12 = STRONG_BUY | 7-11 = BUY | 3-6 = WEAK_BUY | −2 to 2 = NEUTRAL
- −3 to −6 = WEAK_SELL | −7 to −11 = SELL | ≤−12 = STRONG_SELL

R:R < 1.5 overrides bullish signals to NEUTRAL. Confidence = min(95, max(10, 50 + score×3)).

## Pattern Detection

**Candlestick (23)**: Doji, Hammer, InvertedHammer, HangingMan, ShootingStar, BullEngulfing, BearEngulfing, MorningStar, EveningStar, ThreeWhiteSoldiers, ThreeBlackCrows, PiercingLine, DarkCloud, BullHarami, BearHarami, TweezerBottom, TweezerTop, BullMarubozu, BearMarubozu, SpinningTop, DragonflyDoji, GravestoneDoji.

**Chart (13)**: DoubleTop, DoubleBottom, HeadAndShoulders, InverseHeadAndShoulders, RisingWedge, FallingWedge, AscendingTriangle, DescendingTriangle, SymmetricalTriangle, ChannelUp, ChannelDown, Rectangle.

## Environment Variables (Secrets)

| Key | Description |
|-----|-------------|
| ANGELONE_API_KEY | AngelOne SmartAPI key |
| ANGELONE_CLIENT_CODE | AngelOne client code |
| ANGELONE_PIN | AngelOne login PIN |
| ANGELONE_TOTP_SECRET | Base32 TOTP secret |
| SESSION_SECRET | 32-char session secret |
| PAPER_MODE | Set to "true" for paper trading mode |

## Market Hours (IST)

- Pre-market: 09:00–09:15
- Open: 09:15–15:30 (Mon–Fri)
- Otherwise: CLOSED

## Scripts

- `pnpm --filter @workspace/api-server run dev` — run dev server
- `pnpm --filter @workspace/api-server run typecheck` — typecheck
- `pnpm --filter @workspace/db run push` — push DB schema

## TypeScript & Composite Projects

- `lib/*` packages are composite and emit declarations via `tsc --build`
- `artifacts/*` are leaf packages checked with `tsc --noEmit`
- Root `tsconfig.json` is a solution file for libs only
