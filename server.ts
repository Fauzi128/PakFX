import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

interface SimulatorContextPayload {
  amountUsd: number;
  holdingDays: number;
  exchangeRate: number;
  spreadPkr: number;
  spreadEnabled: boolean;
  targetProfitMode: boolean;
  targetProfitPkr: number;
  selectedScenarioLabel: string;
  initialInvestmentPkr: number;
  breakEvenRate: number;
  requiredExitRate: number | null;
  scenarios: Array<{
    label: string;
    monthlyRatePct: number;
    projectedRate: number;
    effectiveSellRate: number;
    netPayoutPkr: number;
    netReturnPkr: number;
    netReturnPct: number;
    daysToTarget: number | null;
  }>;
}

interface ChatHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
}

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured on the server.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function sanitizeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function buildSystemInstruction(ctx: SimulatorContextPayload | undefined): string {
  const basePrompt = [
    'You are PakFX Advisor, a practical, balanced USD-to-PKR currency planning and educational assistant embedded inside the PakFX Planner simulator.',
    'Provide clear, structured, objective analysis tailored to Pakistani open-market USD/PKR dynamics, dealer buy/sell spreads, holding horizons, and local alternatives such as PKR savings accounts, National Savings, or money market funds.',
    'Keep responses concise (around 150-260 words unless the user asks for deep detail), use concrete numbers from the user simulator context below, and avoid hype.',
    'Always conclude with a brief one-sentence non-financial-advice disclaimer noting that FX projections are educational simulations and not licensed financial advice.',
  ];

  if (!ctx) {
    return basePrompt.join('\n\n');
  }

  const scenarioSummary = Array.isArray(ctx.scenarios)
    ? ctx.scenarios
        .slice(0, 4)
        .map(
          (s) =>
            `- ${String(s.label).slice(0, 60)} (${sanitizeNumber(s.monthlyRatePct).toFixed(2)}%/30d): Exit ${sanitizeNumber(s.projectedRate).toFixed(2)} PKR, Net Sell ${sanitizeNumber(s.effectiveSellRate).toFixed(2)} PKR, Payout ${Math.round(sanitizeNumber(s.netPayoutPkr)).toLocaleString()} PKR, Net Return ${Math.round(sanitizeNumber(s.netReturnPkr)).toLocaleString()} PKR (${sanitizeNumber(s.netReturnPct).toFixed(2)}%)${
              s.daysToTarget !== null ? `, Est. Days to Target: ${sanitizeNumber(s.daysToTarget)}d` : ''
            }`
        )
        .join('\n')
    : '';

  const contextBlock = [
    'CURRENT USER SIMULATOR CONTEXT:',
    `- Investment Amount: $${sanitizeNumber(ctx.amountUsd).toLocaleString()} USD`,
    `- Holding Duration: ${Math.round(sanitizeNumber(ctx.holdingDays))} days`,
    `- Entry USD/PKR Rate: ${sanitizeNumber(ctx.exchangeRate).toFixed(2)} PKR`,
    `- Initial PKR Outlay: ${Math.round(sanitizeNumber(ctx.initialInvestmentPkr)).toLocaleString()} PKR`,
    `- Open-Market Dealer Spread: ${ctx.spreadEnabled ? `${sanitizeNumber(ctx.spreadPkr).toFixed(2)} PKR/USD` : 'Disabled (0.00 PKR)'}`,
    `- Break-Even Exit Rate: ${sanitizeNumber(ctx.breakEvenRate).toFixed(2)} PKR`,
    `- Selected Focus Scenario: ${String(ctx.selectedScenarioLabel || '').slice(0, 60)}`,
    ctx.targetProfitMode
      ? `- Target Profit Goal: +${Math.round(sanitizeNumber(ctx.targetProfitPkr)).toLocaleString()} PKR (Required Market Exit Rate: ${
          ctx.requiredExitRate !== null ? `${sanitizeNumber(ctx.requiredExitRate).toFixed(2)} PKR` : 'N/A'
        })`
      : '- Target Profit Mode: Off',
    'SCENARIO PROJECTIONS FOR THIS HOLDING PERIOD:',
    scenarioSummary,
  ].join('\n');

  return `${basePrompt.join('\n\n')}\n\n${contextBlock}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok' });
  });

  app.post('/api/ai/chat', async (req: Request, res: Response) => {
    try {
      const body = req.body as {
        message?: unknown;
        history?: unknown;
        simulatorContext?: SimulatorContextPayload;
      };

      if (typeof body?.message !== 'string' || body.message.trim().length === 0) {
        res.status(400).json({ error: 'Please enter a question for the AI assistant.' });
        return;
      }

      const userMessage = body.message.trim().slice(0, 2000);
      const rawHistory = Array.isArray(body.history) ? body.history.slice(-10) : [];
      const historyLines: string[] = [];

      for (const item of rawHistory) {
        if (
          item &&
          typeof item === 'object' &&
          'role' in item &&
          'content' in item &&
          (item.role === 'user' || item.role === 'assistant') &&
          typeof item.content === 'string'
        ) {
          const speaker = item.role === 'user' ? 'User' : 'Advisor';
          historyLines.push(`${speaker}: ${item.content.slice(0, 1200)}`);
        }
      }

      const ai = getGeminiClient();
      const systemInstruction = buildSystemInstruction(body.simulatorContext);
      const prompt =
        historyLines.length > 0
          ? `Conversation so far:\n${historyLines.join('\n')}\n\nUser's new question: ${userMessage}`
          : userMessage;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          systemInstruction,
        },
      });

      const replyText = response.text?.trim();
      if (!replyText) {
        res.status(502).json({ error: 'The AI model returned an empty response. Please try again.' });
        return;
      }

      res.json({ reply: replyText });
    } catch (error: unknown) {
      const errMessage = error instanceof Error ? error.message : 'Unexpected server error';
      console.error('Gemini API error:', errMessage);

      if (errMessage.includes('GEMINI_API_KEY')) {
        res.status(500).json({
          error: 'Gemini API key is missing. Please configure GEMINI_API_KEY in Settings > Secrets.',
        });
        return;
      }

      if (errMessage.includes('PERMISSION_DENIED') || errMessage.includes('API_KEY_INVALID')) {
        res.status(403).json({
          error: 'Gemini API key was rejected. Please verify your key in Settings > Secrets.',
        });
        return;
      }

      if (errMessage.includes('RESOURCE_EXHAUSTED')) {
        res.status(429).json({
          error: 'Gemini API rate limit reached. Please wait a moment and try again.',
        });
        return;
      }

      res.status(500).json({ error: errMessage });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PakFX Planner server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
