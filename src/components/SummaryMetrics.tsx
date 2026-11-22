import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { SimulationSummary, SimulatorInputs } from '../types/simulator';
import { formatPkr, formatSignedPkr, formatUsd } from '../utils/finance';

interface SummaryMetricsProps {
  inputs: SimulatorInputs;
  summary: SimulationSummary;
}

export const SummaryMetrics: React.FC<SummaryMetricsProps> = ({
  inputs,
  summary,
}) => {
  const { activeOutcome } = summary;
  const isGain = activeOutcome.netReturnPkr > 0.5;
  const isLoss = activeOutcome.netReturnPkr < -0.5;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
      {/* 1. Initial Investment (PKR) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
        <div className="text-xs font-medium text-slate-500">
          Initial Investment
        </div>
        <div className="text-xl font-mono tabular-nums font-semibold text-slate-900">
          {formatPkr(summary.initialInvestmentPkr)}
        </div>
        <div className="text-xs text-slate-500 font-mono tabular-nums">
          {formatUsd(inputs.amountUsd)} @ {inputs.exchangeRate.toFixed(2)}
        </div>
      </div>

      {/* 2. Projected Payout (PKR) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
        <div className="text-xs font-medium text-slate-500">
          Projected Payout
        </div>
        <div className="text-xl font-mono tabular-nums font-semibold text-slate-900">
          {formatPkr(activeOutcome.netPayoutPkr)}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {activeOutcome.shortLabel} · Net {activeOutcome.effectiveSellRate.toFixed(2)}
        </div>
      </div>

      {/* 3. Net Return (PKR & %) */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
        <div className="text-xs font-medium text-slate-500">
          Net Return (After Spread)
        </div>
        <div
          className={`text-xl font-mono tabular-nums font-semibold flex items-center gap-1 ${
            isGain
              ? 'text-emerald-700'
              : isLoss
              ? 'text-rose-700'
              : 'text-slate-900'
          }`}
        >
          {isGain ? (
            <ArrowUpRight className="w-4 h-4 shrink-0" aria-label="Profit" />
          ) : isLoss ? (
            <ArrowDownRight className="w-4 h-4 shrink-0" aria-label="Loss" />
          ) : (
            <Minus className="w-4 h-4 shrink-0" aria-label="Flat" />
          )}
          <span>{formatSignedPkr(activeOutcome.netReturnPkr)}</span>
        </div>
        <div
          className={`text-xs font-mono tabular-nums font-medium ${
            isGain
              ? 'text-emerald-700'
              : isLoss
              ? 'text-rose-700'
              : 'text-slate-500'
          }`}
        >
          {activeOutcome.netReturnPct > 0 ? '+' : ''}
          {activeOutcome.netReturnPct.toFixed(2)}% over {inputs.holdingDays}d
        </div>
      </div>

      {/* 4. Break-Even Exchange Rate */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5">
        <div className="text-xs font-medium text-slate-500">
          Break-Even Exit Rate
        </div>
        <div className="text-xl font-mono tabular-nums font-semibold text-slate-900">
          {summary.breakEvenRate.toFixed(2)} <span className="text-xs font-normal text-slate-500">PKR</span>
        </div>
        <div className="text-xs text-slate-500 font-mono tabular-nums">
          +{summary.effectiveSpreadPkr.toFixed(2)} PKR spread cover
        </div>
      </div>

      {/* 5. Optimal Sell Date */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-1.5 sm:col-span-2 xl:col-span-1">
        <div className="text-xs font-medium text-slate-500">
          Optimal Sell Date
        </div>
        <div className="text-lg font-mono tabular-nums font-semibold text-slate-900">
          {summary.optimalSellDateLabel}
        </div>
        <div className="text-xs text-slate-500">
          Today + {inputs.holdingDays} {inputs.holdingDays === 1 ? 'day' : 'days'}
        </div>
      </div>
    </div>
  );
};
