import React from 'react';
import { ScenarioId, SimulationSummary, SimulatorInputs } from '../types/simulator';
import { formatPkr, formatSignedPkr, SCENARIOS } from '../utils/finance';

interface ScenarioTableProps {
  inputs: SimulatorInputs;
  summary: SimulationSummary;
  onSelectScenario: (id: ScenarioId) => void;
}

export const ScenarioTable: React.FC<ScenarioTableProps> = ({
  inputs,
  summary,
  onSelectScenario,
}) => {
  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Historical USD/PKR Regime Matrix
          </h3>
          <p className="text-xs text-slate-500">
            Proportional projections scaled to {inputs.holdingDays} {inputs.holdingDays === 1 ? 'day' : 'days'} · Click any row to focus summary cards
          </p>
        </div>
        {inputs.targetProfitMode && summary.requiredExitRate !== null && (
          <div className="text-xs font-mono tabular-nums text-emerald-800 font-medium">
            Target Exit: {summary.requiredExitRate.toFixed(2)} PKR
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-xs font-medium text-slate-600">
              <th className="py-2.5 px-4">Regime</th>
              <th className="py-2.5 px-3 text-right">30-Day Drift</th>
              <th className="py-2.5 px-3 text-right">Market Exit</th>
              <th className="py-2.5 px-3 text-right">Net Sell Rate</th>
              <th className="py-2.5 px-3 text-right">Projected Payout</th>
              <th className="py-2.5 px-3 text-right">Net Return</th>
              {inputs.targetProfitMode && (
                <th className="py-2.5 px-4 text-right">Days to Target</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {summary.outcomes.map((outcome) => {
              const def = SCENARIOS.find((s) => s.id === outcome.id);
              const isSelected = inputs.selectedScenario === outcome.id;
              const isPos = outcome.netReturnPkr > 0.5;
              const isNeg = outcome.netReturnPkr < -0.5;

              return (
                <tr
                  key={outcome.id}
                  onClick={() => onSelectScenario(outcome.id)}
                  className={`cursor-pointer transition-colors ${
                    isSelected ? 'bg-emerald-50/50' : 'hover:bg-slate-50'
                  }`}
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: outcome.color }}
                      />
                      <div>
                        <div className="font-medium text-slate-900">
                          {outcome.label}
                        </div>
                        <div className="text-xs text-slate-500">
                          {def?.description}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {outcome.monthlyRatePct > 0 ? '+' : ''}
                    {outcome.monthlyRatePct.toFixed(2)}%
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 whitespace-nowrap">
                    {outcome.projectedMarketRate.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {outcome.effectiveSellRate.toFixed(2)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900 whitespace-nowrap">
                    {formatPkr(outcome.netPayoutPkr)}
                  </td>
                  <td
                    className={`py-3 px-3 text-right font-mono tabular-nums font-medium whitespace-nowrap ${
                      isPos
                        ? 'text-emerald-700'
                        : isNeg
                        ? 'text-rose-700'
                        : 'text-slate-600'
                    }`}
                  >
                    <div>{formatSignedPkr(outcome.netReturnPkr)}</div>
                    <div className="text-xs">
                      ({outcome.netReturnPct > 0 ? '+' : ''}
                      {outcome.netReturnPct.toFixed(2)}%)
                    </div>
                  </td>
                  {inputs.targetProfitMode && (
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-800 whitespace-nowrap">
                      {outcome.daysToTarget !== null ? (
                        <span>{outcome.daysToTarget} days</span>
                      ) : (
                        <span className="text-xs text-slate-400">Not reached</span>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};
