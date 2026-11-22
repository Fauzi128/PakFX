import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, Trash2, X } from 'lucide-react';
import {
  ChatMessage,
  SimulationSummary,
  SimulatorInputs,
} from '../types/simulator';

interface AiAssistantDrawerProps {
  open: boolean;
  onToggle: (open: boolean) => void;
  inputs: SimulatorInputs;
  summary: SimulationSummary;
}

export const AiAssistantDrawer: React.FC<AiAssistantDrawerProps> = ({
  open,
  onToggle,
  inputs,
  summary,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const quickPrompts = [
    `Is ${inputs.holdingDays} days long enough to beat the Rs. ${summary.effectiveSpreadPkr.toFixed(
      2
    )} spread?`,
    'Compare holding USD vs. keeping PKR in a Pakistani savings account',
    'What risks should I watch for in USD/PKR?',
  ];

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open, loading]);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: trimmed,
      createdAt: Date.now(),
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setDraft('');
    setLoading(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: messages.slice(-8).map((m) => ({
            role: m.role,
            content: m.content,
          })),
          simulatorContext: {
            amountUsd: inputs.amountUsd,
            holdingDays: inputs.holdingDays,
            exchangeRate: inputs.exchangeRate,
            spreadPkr: inputs.spreadPkr,
            spreadEnabled: inputs.spreadEnabled,
            targetProfitMode: inputs.targetProfitMode,
            targetProfitPkr: inputs.targetProfitPkr,
            selectedScenarioLabel: summary.activeOutcome.label,
            initialInvestmentPkr: summary.initialInvestmentPkr,
            breakEvenRate: summary.breakEvenRate,
            requiredExitRate: summary.requiredExitRate,
            scenarios: summary.outcomes.map((o) => ({
              label: o.label,
              monthlyRatePct: o.monthlyRatePct,
              projectedRate: o.projectedMarketRate,
              effectiveSellRate: o.effectiveSellRate,
              netPayoutPkr: o.netPayoutPkr,
              netReturnPkr: o.netReturnPkr,
              netReturnPct: o.netReturnPct,
              daysToTarget: o.daysToTarget,
            })),
          },
        }),
      });

      const data = (await response.json()) as {
        reply?: string;
        error?: string;
      };

      if (!response.ok || !data.reply) {
        throw new Error(data.error || 'Failed to get AI advisor response.');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          content: data.reply!,
          createdAt: Date.now(),
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: `e_${Date.now()}`,
          role: 'assistant',
          content:
            err instanceof Error
              ? err.message
              : 'Unable to reach AI advisor right now.',
          createdAt: Date.now(),
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Compact Floating Trigger (respects 15% mobile sticky cap) */}
      {!open && (
        <button
          type="button"
          onClick={() => onToggle(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-lg transition-colors whitespace-nowrap"
        >
          <MessageSquare className="w-4 h-4" />
          AI FX Advisor
        </button>
      )}

      {/* Slide-Over Chat Drawer */}
      {open && (
        <aside
          aria-label="Gemini AI FX Investment Assistant"
          className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white border-l border-slate-200 shadow-2xl flex flex-col"
        >
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                PakFX AI Investment Advisor
              </h2>
              <p className="text-xs text-slate-500">
                Synced with your ${inputs.amountUsd.toLocaleString()} · {inputs.holdingDays}d · {inputs.exchangeRate.toFixed(2)} PKR plan
              </p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => setMessages([])}
                  aria-label="Clear conversation"
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onToggle(false)}
                aria-label="Close AI Advisor"
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto p-5 space-y-4 bg-slate-50/50"
          >
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
                  <p className="text-sm text-slate-700 leading-relaxed">
                    Ask me anything about your current USD-to-PKR simulation. I automatically read your active investment amount, holding days, dealer spread, and target profit goal.
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Educational analysis only — not personalized financial advice.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-medium text-slate-500">
                    Suggested questions
                  </div>
                  {quickPrompts.map((promptText, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => void sendQuestion(promptText)}
                      className="w-full text-left p-3 text-xs font-medium text-slate-800 bg-white border border-slate-200 hover:border-emerald-700 hover:bg-emerald-50/40 rounded-lg transition-colors"
                    >
                      {promptText}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${
                    msg.role === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  <div
                    className={`max-w-[88%] rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-slate-900 text-white'
                        : msg.error
                        ? 'bg-rose-50 border border-rose-200 text-rose-900'
                        : 'bg-white border border-slate-200 text-slate-800'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-500">
                  Analyzing your USD/PKR parameters...
                </div>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendQuestion(draft);
            }}
            className="p-4 border-t border-slate-200 bg-white space-y-2"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Ask about spread, holding days, or PKR alternatives..."
                disabled={loading}
                className="flex-1 px-3 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
              <button
                type="submit"
                disabled={loading || !draft.trim()}
                aria-label="Send message"
                className="px-3.5 py-2 text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-400">
              For educational planning only. Verify live dealer quotes before executing FX trades.
            </p>
          </form>
        </aside>
      )}
    </>
  );
};
