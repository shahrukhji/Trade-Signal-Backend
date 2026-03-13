import { Router } from "express";
import { generateSignal } from "../lib/signal-engine.js";
import { calculateIndicators } from "../lib/indicators.js";
import { NIFTY50 } from "../lib/constants.js";
import { fetchCandles } from "../lib/candle-fetcher.js";
import type { Candle } from "../lib/broker-adapter.js";

const router = Router();

router.post("/generate", async (req, res) => {
  try {
    const { symbol, symboltoken, exchange = "NSE", interval = "FIFTEEN_MINUTE" } = req.body as {
      symbol: string;
      symboltoken?: string;
      exchange?: string;
      interval?: string;
    };

    let token = symboltoken;
    if (!token) {
      const stock = NIFTY50.find(s => s.symbol === symbol);
      token = stock?.token;
    }

    if (!token) {
      res.status(400).json({ error: "symboltoken or valid symbol required" });
      return;
    }

    const candles = await fetchCandles(token, interval, exchange);
    if (candles.length < 20) {
      res.status(400).json({ error: "Insufficient candle data for signal generation" });
      return;
    }

    const signal = generateSignal(symbol, candles);
    res.json({ success: true, signal });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Signal generation failed";
    res.status(500).json({ error: msg });
  }
});

router.post("/indicators/calculate", async (req, res) => {
  try {
    const { candles } = req.body as { candles: Candle[] };
    if (!candles || !Array.isArray(candles)) {
      res.status(400).json({ error: "candles array required" });
      return;
    }
    const indicators = calculateIndicators(candles);
    res.json({ success: true, indicators });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Indicator calculation failed";
    res.status(500).json({ error: msg });
  }
});

// Simple GET endpoint for mobile app — scans top Nifty 50 stocks and returns JSON
router.get("/", async (req, res) => {
  try {
    const interval = (req.query.interval as string) || "FIFTEEN_MINUTE";
    const minConfidence = parseInt(req.query.minConfidence as string) || 50;
    const limit = parseInt(req.query.limit as string) || 20;

    const stocks = NIFTY50.slice(0, limit);
    const results: ReturnType<typeof generateSignal>[] = [];

    const BATCH_SIZE = 4;
    for (let i = 0; i < stocks.length; i += BATCH_SIZE) {
      const batch = stocks.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(async (stock) => {
          try {
            const candles = await fetchCandles(stock.token, interval);
            if (candles.length >= 20) {
              const signal = generateSignal(stock.symbol, candles);
              results.push(signal);
            }
          } catch { /* skip failed stocks */ }
        })
      );
    }

    const filtered = results
      .filter(r => r.confidence >= minConfidence)
      .sort((a, b) => {
        const order: Record<string, number> = {
          STRONG_BUY: 0, BUY: 1, WEAK_BUY: 2, NEUTRAL: 3,
          WEAK_SELL: 4, SELL: 5, STRONG_SELL: 6,
        };
        return (order[a.signal] ?? 3) - (order[b.signal] ?? 3);
      })
      .map(r => ({
        symbol: r.symbol,
        symboltoken: NIFTY50.find(s => s.symbol === r.symbol)?.token ?? "",
        exchange: "NSE",
        signal: (r.signal === "WEAK_BUY" ? "BUY" : r.signal === "WEAK_SELL" ? "SELL" : r.signal) as
          "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL",
        score: r.confidence,
        indicators: (r.reasons ?? []).map((s: string) => s.replace(/ \([+-]\d+\)$/, "")),
        rsi: (r.indicators as unknown as Record<string, { value?: number } | undefined>)?.rsi?.value,
        ltp: r.entry,
        target1: r.target1,
        stopLoss: r.stopLoss,
        riskReward: r.riskReward,
      }));

    res.json({ success: true, data: filtered, scanned: results.length });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Scanner failed";
    res.status(500).json({ error: msg });
  }
});

router.post("/scanner/run", async (req, res) => {
  try {
    const { interval = "FIFTEEN_MINUTE", minConfidence = 55 } = req.body as {
      interval?: string;
      minConfidence?: number;
    };

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    const total = NIFTY50.length;
    const results: ReturnType<typeof generateSignal>[] = [];

    // Helper: guaranteed flush between SSE events so each arrives as a separate chunk
    const emit = (payload: object) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      // Flush compression middleware if present
      if (typeof (res as any).flush === 'function') (res as any).flush();
    };
    const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

    // Process stocks sequentially so each emit() reaches the browser as a distinct chunk.
    // 60 ms minimum gap ensures cached-data scans still show live progress in the UI.
    for (const stock of NIFTY50) {
      const t0 = Date.now();
      let result: ReturnType<typeof generateSignal> | null = null;
      try {
        const candles = await fetchCandles(stock.token, interval);
        if (candles.length >= 20) {
          result = generateSignal(stock.symbol, candles);
          results.push(result);
        }
      } catch {}

      emit({ scanned: results.length, total, currentStock: stock.symbol, result: result ?? null });

      // If candles were cached the whole thing took <5 ms — pad to 60 ms so the
      // browser has time to paint the progress update before the next event arrives.
      const elapsed = Date.now() - t0;
      if (elapsed < 60) await sleep(60 - elapsed);
    }

    const filtered = results
      .filter(r => r.confidence >= minConfidence)
      .sort((a, b) => {
        const order: Record<string, number> = {
          STRONG_BUY: 0, BUY: 1, WEAK_BUY: 2, NEUTRAL: 3,
          WEAK_SELL: 4, SELL: 5, STRONG_SELL: 6,
        };
        return (order[a.signal] ?? 3) - (order[b.signal] ?? 3);
      });

    res.write(`data: ${JSON.stringify({ done: true, results: filtered })}\n\n`);
    res.end();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Scanner failed";
    if (!res.headersSent) res.status(500).json({ error: msg });
  }
});

export default router;
