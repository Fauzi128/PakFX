import React, { useState } from 'react';
import { BookmarkPlus, RefreshCw, Target } from 'lucide-react';
import {
  ScenarioId,
  SimulationSummary,
  SimulatorInputs,
} from '../types/simulator';
import { clampNumber, formatPkr, SCENARIOS } from '../utils/finance';

interface SimulatorControlsProps {
  inputs: SimulatorInputs;
  summary: SimulationSummary;
  rateMeta: {
    isLive: boolean;
    isManualOverride: boolean;
    source: string;
    fetchedAt: string;
    loading: boolean;
    error?: string;
  };
  isSignedIn: boolean;
  onChange: (patch: Partial<SimulatorInputs>) => void;
  onRateChange: (newRate: number, manual: boolean) => void;
  onRefreshRate: () => void;
  onSaveTarget: (title: string) => Promise<void>;
}

const AMOUNT_PRESETS = [100, 500, 1000, 5000, 10000];
const DAY_PRESETS = [15, 30, 60, 90, 180, 365];

export const SimulatorControls: React.FC<SimulatorControlsProps> = ({
  inputs,
  summary,
  rateMeta,
  isSignedIn,
  onChange,
  onRateChange,
  onRefreshRate,
  onSaveTarget,
}) => {
  const [targetTitle, setTargetTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const defaultTitle = `${inputs.holdingDays}-Day USD Plan ($${inputs.amountUsd})`;
    const finalTitle = targetTitle.trim() || defaultTitle;
    setSaving(true);
    setSaveMessage(null);
    try {
      await onSaveTarget(finalTitle);
      setTargetTitle('');
      setSaveMessage(
        isSignedIn ? 'Saved to your cloud targets.' : 'Saved locally in Guest mode.'
      );
      setTimeout(() => setSaveMessage(null), 3500);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Unable to save target.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="bg-white border border-slate-200 rounded-xl p-5 space-y-6">
      {/* Live Exchange Rate Control */}
      <div className="space-y-3 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="exchange-rate-input"
            className="text-sm font-semibold text-slate-900"
          >
            USD / PKR Entry Rate
          </label>
          <button
            type="button"
            onClick={onRefreshRate}
            disabled={rateMeta.loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap shrink-0 disabled:opacity-60"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${rateMeta.loading ? 'animate-spin' : ''}`}
            />
            {rateMeta.loading ? 'Fetching...' : 'Refresh Live'}
          </button>
        </div>

        <div className="relative">
          <input
            id="exchange-rate-input"
            type="number"
            step="0.05"
            min={50}
            max={2000}
            value={inputs.exchangeRate}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!Number.isNaN(val)) {
                onRateChange(clampNumber(val, 50, 2000), true);
              }
            }}
            className="w-full pr-14 pl-3 py-2.5 text-base font-mono tabular-nums font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
            PKR
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          {rateMeta.isManualOverride ? 'Manual override' : rateMeta.source}
          {' · '}
          {rateMeta.isLive ? 'Live feed' : 'Fallback rate'}
          {rateMeta.fetchedAt ? ` · ${rateMeta.fetchedAt}` : ''}
        </p>
        {rateMeta.error && (
          <p className="text-xs text-amber-700">{rateMeta.error}</p>
        )}
      </div>

      {/* Investment Amount (USD) */}
      <div className="space-y-3 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="amount-usd-input"
            className="text-sm font-semibold text-slate-900"
          >
            Investment Amount (USD)
          </label>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {formatPkr(summary.initialInvestmentPkr)}
          </span>
        </div>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-mono text-slate-500">
            $
          </span>
          <input
            id="amount-usd-input"
            type="number"
            min={10}
            max={50000}
            step={10}
            value={inputs.amountUsd}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!Number.isNaN(val)) {
                onChange({ amountUsd: clampNumber(val, 10, 50000) });
              }
            }}
            className="w-full pl-7 pr-14 py-2 text-base font-mono tabular-nums font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
            USD
          </span>
        </div>

        <input
          type="range"
          aria-label="Investment amount slider"
          min={10}
          max={50000}
          step={10}
          value={inputs.amountUsd}
          onChange={(e) => onChange({ amountUsd: Number(e.target.value) })}
          className="w-full fx-slider"
        />

        <div className="flex flex-wrap gap-1.5">
          {AMOUNT_PRESETS.map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => onChange({ amountUsd: preset })}
              className={`px-2.5 py-1 text-xs font-mono tabular-nums rounded-md border transition-colors whitespace-nowrap ${
                inputs.amountUsd === preset
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              ${preset.toLocaleString()}
            </button>
          ))}
        </div>
      </div>

      {/* Holding Duration (Days) */}
      <div className="space-y-3 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <label
            htmlFor="holding-days-input"
            className="text-sm font-semibold text-slate-900"
          >
            Holding Duration (Days)
          </label>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            Sell {summary.optimalSellDateLabel}
          </span>
        </div>

        <div className="relative">
          <input
            id="holding-days-input"
            type="number"
            min={1}
            max={365}
            step={1}
            value={inputs.holdingDays}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!Number.isNaN(val)) {
                onChange({ holdingDays: clampNumber(val, 1, 365) });
              }
            }}
            className="w-full pl-3 pr-14 py-2 text-base font-mono tabular-nums font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
            DAYS
          </span>
        </div>

        <input
          type="range"
          aria-label="Holding duration slider"
          min={1}
          max={365}
          step={1}
          value={inputs.holdingDays}
          onChange={(e) => onChange({ holdingDays: Number(e.target.value) })}
          className="w-full fx-slider"
        />

        <div className="flex flex-wrap gap-1.5">
          {DAY_PRESETS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => onChange({ holdingDays: days })}
              className={`px-2.5 py-1 text-xs font-mono tabular-nums rounded-md border transition-colors whitespace-nowrap ${
                inputs.holdingDays === days
                  ? 'bg-emerald-700 text-white border-emerald-700'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {days}d
            </button>
          ))}
        </div>
      </div>

      {/* Open-Market Dealer Spread */}
      <div className="space-y-3 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <div>
            <label
              htmlFor="spread-input"
              className="text-sm font-semibold text-slate-900 block"
            >
              Open-Market Dealer Spread
            </label>
            <span className="text-xs text-slate-500">
              Buy/sell gap per USD at currency exchanges
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={inputs.spreadEnabled}
            onClick={() => onChange({ spreadEnabled: !inputs.spreadEnabled })}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              inputs.spreadEnabled ? 'bg-emerald-700' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                inputs.spreadEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {inputs.spreadEnabled && (
          <div className="relative">
            <input
              id="spread-input"
              type="number"
              min={0}
              max={25}
              step={0.1}
              value={inputs.spreadPkr}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                if (!Number.isNaN(val)) {
                  onChange({ spreadPkr: clampNumber(val, 0, 25) });
                }
              }}
              className="w-full pl-3 pr-20 py-2 text-sm font-mono tabular-nums font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
              PKR / USD
            </span>
          </div>
        )}
      </div>

      {/* Target Profit Mode (Optional Toggle) */}
      <div className="space-y-3 pb-5 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-700 shrink-0" />
            <div>
              <span className="text-sm font-semibold text-slate-900 block">
                Target Profit Mode
              </span>
              <span className="text-xs text-slate-500">
                Solve required exit rate & days
              </span>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={inputs.targetProfitMode}
            onClick={() =>
              onChange({ targetProfitMode: !inputs.targetProfitMode })
            }
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              inputs.targetProfitMode ? 'bg-emerald-700' : 'bg-slate-200'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                inputs.targetProfitMode ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {inputs.targetProfitMode && (
          <div className="space-y-2.5 pt-1">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                Rs.
              </span>
              <input
                type="number"
                aria-label="Target net profit in PKR"
                min={0}
                max={50000000}
                step={500}
                value={inputs.targetProfitPkr}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  if (!Number.isNaN(val)) {
                    onChange({
                      targetProfitPkr: clampNumber(val, 0, 50000000),
                    });
                  }
                }}
                className="w-full pl-10 pr-14 py-2 text-sm font-mono tabular-nums font-medium text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                PKR
              </span>
            </div>

            {summary.requiredExitRate !== null && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">Required Exit Rate</span>
                  <span className="font-mono tabular-nums font-semibold text-slate-900">
                    {summary.requiredExitRate.toFixed(2)} PKR
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Accounts for {summary.effectiveSpreadPkr.toFixed(2)} PKR spread
                  above {inputs.exchangeRate.toFixed(2)} PKR entry.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Focus Regime Selector */}
      <div className="space-y-2.5 pb-5 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-900 block">
          Focus Regime for Summary
        </span>
        <div className="grid grid-cols-2 gap-1.5">
          {SCENARIOS.map((sc) => {
            const active = inputs.selectedScenario === sc.id;
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => onChange({ selectedScenario: sc.id as ScenarioId })}
                className={`px-2.5 py-2 text-left rounded-lg border text-xs transition-colors ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="font-medium truncate">{sc.shortLabel}</div>
                <div
                  className={`font-mono tabular-nums text-[11px] ${
                    active ? 'text-slate-300' : 'text-slate-500'
                  }`}
                >
                  {sc.monthlyRatePct > 0 ? '+' : ''}
                  {sc.monthlyRatePct.toFixed(2)}% / 30d
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Save Target Form */}
      <form onSubmit={handleSaveSubmit} className="space-y-2.5">
        <label
          htmlFor="save-target-title"
          className="text-sm font-semibold text-slate-900 block"
        >
          Save This Investment Plan
        </label>
        <input
          id="save-target-title"
          type="text"
          maxLength={120}
          placeholder={`e.g. Emergency USD Fund – $${inputs.amountUsd} for ${inputs.holdingDays} days`}
          value={targetTitle}
          onChange={(e) => setTargetTitle(e.target.value)}
          className="w-full px-3 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
        />
        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors disabled:opacity-60"
        >
          <BookmarkPlus className="w-4 h-4" />
          {saving
            ? 'Saving...'
            : isSignedIn
            ? 'Save Target to Cloud'
            : 'Save Target (Guest Mode)'}
        </button>
        {saveMessage && (
          <p className="text-xs text-emerald-700 font-medium">{saveMessage}</p>
        )}
      </form>
    </aside>
  );
};
