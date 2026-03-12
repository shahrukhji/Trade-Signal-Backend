import { Router } from "express";
import axios from "axios";
import type { Candle } from "../lib/broker-adapter.js";

const router = Router();

function buildPrompt(body: {
  stockName: string;
  timeframe: string;
  candles: Candle[];
  indicators: Record<string, unknown>;
  patterns: { candlestick: string[]; chart: string[] };
  levels?: Record<string, unknown>;
}): string {
  const { stockName, timeframe, candles, indicators, patterns, levels } = body;
  const lastCandle = candles[candles.length - 1];

  return `You are an expert technical analyst. Analyze the following stock data and provide a detailed trading signal.

Stock: ${stockName}
Timeframe: ${timeframe}
Current Price: ${lastCandle?.close ?? "N/A"}
Candles analyzed: ${candles.length}

Technical Indicators:
${JSON.stringify(indicators, null, 2)}

Detected Patterns:
- Candlestick: ${patterns.candlestick.join(", ") || "None"}
- Chart: ${patterns.chart.join(", ") || "None"}

Key Levels:
${levels ? JSON.stringify(levels, null, 2) : "N/A"}

Provide your analysis in this exact JSON format:
{
  "signal": "STRONG_BUY|BUY|WEAK_BUY|NEUTRAL|WEAK_SELL|SELL|STRONG_SELL",
  "confidence": 0-100,
  "entry": <price>,
  "target1": <price>,
  "target2": <price>,
  "target3": <price>,
  "stopLoss": <price>,
  "riskReward": <ratio>,
  "reasoning": ["reason1", "reason2", ...],
  "riskFactors": ["risk1", "risk2", ...],
  "summary": "<one paragraph summary>"
}`;
}

async function callGemini(apiKey: string, model: string, prompt: string): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await axios.post(url, {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 4096 },
  });
  return res.data.candidates[0].content.parts[0].text;
}

async function callOpenAI(apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await axios.post(
    "https://api.openai.com/v1/chat/completions",
    {
      model,
      messages: [
        { role: "system", content: "You are an expert stock market technical analyst." },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 4096,
    },
    { headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } }
  );
  return res.data.choices[0].message.content;
}

async function callClaude(apiKey: string, model: string, prompt: string): Promise<string> {
  const res = await axios.post(
    "https://api.anthropic.com/v1/messages",
    {
      model,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    },
    {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
    }
  );
  return res.data.content[0].text;
}

function parseAIResponse(text: string): Record<string, unknown> {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON found in AI response");
  return JSON.parse(jsonMatch[0]);
}

router.post("/analyze", async (req, res) => {
  try {
    const { provider, model, apiKey, stockName, timeframe, candles, indicators, patterns, levels } = req.body as {
      provider: "gemini" | "openai" | "claude";
      model: string;
      apiKey: string;
      stockName: string;
      timeframe: string;
      candles: Candle[];
      indicators: Record<string, unknown>;
      patterns: { candlestick: string[]; chart: string[] };
      levels?: Record<string, unknown>;
    };

    if (!provider || !apiKey || !candles) {
      res.status(400).json({ error: "provider, apiKey, and candles are required" });
      return;
    }

    const prompt = buildPrompt({ stockName, timeframe, candles, indicators, patterns, levels });

    let rawText: string;
    switch (provider) {
      case "gemini":
        rawText = await callGemini(apiKey, model || "gemini-1.5-pro", prompt);
        break;
      case "openai":
        rawText = await callOpenAI(apiKey, model || "gpt-4o", prompt);
        break;
      case "claude":
        rawText = await callClaude(apiKey, model || "claude-3-5-sonnet-20241022", prompt);
        break;
      default:
        res.status(400).json({ error: "provider must be gemini, openai, or claude" });
        return;
    }

    const result = parseAIResponse(rawText);
    res.json({ success: true, provider, result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "AI analysis failed";
    res.status(500).json({ error: msg });
  }
});

export default router;
