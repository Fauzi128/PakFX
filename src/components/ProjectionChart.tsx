import React, { useMemo, useState } from 'react';
import {
  ScenarioId,
  SimulationSummary,
  SimulatorInputs,
} from '../types/simulator';
import {
  formatPkr,
  formatSignedPkr,
  SCENARIOS,
} from '../utils/finance';

interface ProjectionChartProps {
  inputs: SimulatorInputs;
  summary: SimulationSummary;
}

export const ProjectionChart: React.FC<ProjectionChartProps> = ({
  inputs,
  summary,
}) => {
  const [visibleScenarios, setVisibleScenarios] = useState<
    Record<ScenarioId, boolean>
  >({
    stable_2026: true,
    flat_pegged: true,
    moderate_rise: true,
    historical_surge: true,
  });
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const series = summary.dailySeries;
  const width = 820;
  const height = 340;
  const pad = { top: 24, right: 24, bottom: 42, left: 78 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const { minY, maxY, yTicks } = useMemo(() => {
    const allVals: number[] = [summary.initialInvestmentPkr];
    if (inputs.targetProfitMode && inputs.targetProfitPkr > 0) {
      allVals.push(summary.initialInvestmentPkr + inputs.targetProfitPkr);
    }

    for (const pt of series) {
      for (const sc of SCENARIOS) {
        if (visibleScenarios[sc.id]) {
          allVals.push(pt.values[sc.id].portfolioPkr);
        }
      }
    }

    const rawMin = Math.min(...allVals);
    const rawMax = Math.max(...allVals);
    const span = Math.max(rawMax - rawMin, summary.initialInvestmentPkr * 0.02, 100);
    const paddedMin = rawMin - span * 0.14;
    const paddedMax = rawMax + span * 0.14;

    const ticks: number[] = [];
    const steps = 4;
    for (let i = 0; i <= steps; i += 1) {
      ticks.push(paddedMin + ((paddedMax - paddedMin) * i) / steps);
    }

    return { minY: paddedMin, maxY: paddedMax, yTicks: ticks };
  }, [series, visibleScenarios, summary.initialInvestmentPkr, inputs.targetProfitMode, inputs.targetProfitPkr]);

  const xForIndex = (idx: number) => {
    if (series.length <= 1) return pad.left + plotW / 2;
    return pad.left + (idx / (series.length - 1)) * plotW;
  };

  const yForValue = (val: number) => {
    const ratio = (val - minY) / (maxY - minY || 1);
    return pad.top + plotH - ratio * plotH;
  };

  const xTickIndices = useMemo(() => {
    if (series.length <= 1) return [0];
    const count = Math.min(5, series.length);
    const set = new Set<number>();
    for (let i = 0; i < count; i += 1) {
      set.add(Math.round((i / (count - 1)) * (series.length - 1)));
    }
    return Array.from(set);
  }, [series.length]);

  const activePoint =
    hoverIndex !== null && series[hoverIndex]
      ? series[hoverIndex]
      : series[series.length - 1];
  const activeIdx =
    hoverIndex !== null && series[hoverIndex]
      ? hoverIndex
      : series.length - 1;

  const toggleScenario = (id: ScenarioId) => {
    setVisibleScenarios((prev) => {
      const enabledCount = Object.values(prev).filter(Boolean).length;
      if (prev[id] && enabledCount === 1) return prev;
      return { ...prev, [id]: !prev[id] };
    });
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width <= 0 || series.length <= 1) return;
    const relX = ((e.clientX - rect.left) / rect.width) * width;
    const clampedPlotX = Math.max(pad.left, Math.min(pad.left + plotW, relX));
    const frac = (clampedPlotX - pad.left) / plotW;
    const idx = Math.round(frac * (series.length - 1));
    setHoverIndex(idx);
  };

  const breakEvenY = yForValue(summary.initialInvestmentPkr);
  const targetPayoutVal =
    inputs.targetProfitMode && inputs.targetProfitPkr > 0
      ? summary.initialInvestmentPkr + inputs.targetProfitPkr
      : null;
  const targetY = targetPayoutVal !== null ? yForValue(targetPayoutVal) : null;

  return (
    <section
      id="projections"
      className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            Day-by-Day Projected Portfolio Value (PKR)
          </h2>
          <p className="text-xs text-slate-500">
            Net liquidation value after {summary.effectiveSpreadPkr.toFixed(2)} PKR/USD dealer spread across 4 historical regimes
          </p>
        </div>

        {/* Scenario Legend Toggles */}
        <div className="flex flex-wrap items-center gap-2">
          {SCENARIOS.map((sc) => {
            const on = visibleScenarios[sc.id];
            return (
              <button
                key={sc.id}
                type="button"
                onClick={() => toggleScenario(sc.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap ${
                  on
                    ? 'bg-slate-50 border-slate-300 text-slate-800'
                    : 'bg-white border-slate-200 text-slate-400'
                }`}
              >
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ backgroundColor: on ? sc.color : '#cbd5e1' }}
                />
                <span>{sc.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Interactive SVG Line Chart */}
      <div className="relative w-full">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full h-auto select-none overflow-visible"
          onMouseMove={handleSvgMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
          role="img"
          aria-label="Projected USD to PKR portfolio value across 4 regimes"
        >
          {/* Horizontal grid lines + Y-axis labels */}
          {yTicks.map((tickVal, idx) => {
            const y = yForValue(tickVal);
            return (
              <g key={idx}>
                <line
                  x1={pad.left}
                  y1={y}
                  x2={pad.left + plotW}
                  y2={y}
                  stroke="#f1f5f9"
                  strokeWidth="1"
                />
                <text
                  x={pad.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-500 text-[11px] font-mono tabular-nums"
                >
                  {Math.round(tickVal).toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Initial Investment Break-Even Line */}
          <line
            x1={pad.left}
            y1={breakEvenY}
            x2={pad.left + plotW}
            y2={breakEvenY}
            stroke="#64748b"
            strokeWidth="1.25"
            strokeDasharray="5 4"
          />
          <text
            x={pad.left + 6}
            y={breakEvenY - 6}
            className="fill-slate-600 text-[10px] font-mono"
          >
            Break-Even ({Math.round(summary.initialInvestmentPkr).toLocaleString()} PKR)
          </text>

          {/* Optional Target Profit Line */}
          {targetY !== null && targetPayoutVal !== null && (
            <g>
              <line
                x1={pad.left}
                y1={targetY}
                x2={pad.left + plotW}
                y2={targetY}
                stroke="#047857"
                strokeWidth="1.25"
                strokeDasharray="3 3"
              />
              <text
                x={pad.left + plotW - 6}
                y={targetY - 6}
                textAnchor="end"
                className="fill-emerald-800 text-[10px] font-mono font-medium"
              >
                Goal ({Math.round(targetPayoutVal).toLocaleString()} PKR)
              </text>
            </g>
          )}

          {/* Scenario Polylines */}
          {SCENARIOS.map((sc) => {
            if (!visibleScenarios[sc.id]) return null;
            const points = series
              .map((pt, idx) => `${xForIndex(idx)},${yForValue(pt.values[sc.id].portfolioPkr)}`)
              .join(' ');
            const isSelected = inputs.selectedScenario === sc.id;

            return (
              <polyline
                key={sc.id}
                fill="none"
                stroke={sc.color}
                strokeWidth={isSelected ? 2.75 : 1.75}
                strokeOpacity={isSelected ? 1 : 0.78}
                strokeLinejoin="round"
                strokeLinecap="round"
                points={points}
              />
            );
          })}

          {/* X-axis tick labels */}
          {xTickIndices.map((idx) => {
            const pt = series[idx];
            if (!pt) return null;
            const x = xForIndex(idx);
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={pad.top + plotH}
                  x2={x}
                  y2={pad.top + plotH + 5}
                  stroke="#cbd5e1"
                />
                <text
                  x={x}
                  y={pad.top + plotH + 20}
                  textAnchor="middle"
                  className="fill-slate-500 text-[11px] font-mono tabular-nums"
                >
                  Day {pt.day}
                </text>
              </g>
            );
          })}

          {/* Hover Crosshair & Points */}
          {activePoint && (
            <g>
              <line
                x1={xForIndex(activeIdx)}
                y1={pad.top}
                x2={xForIndex(activeIdx)}
                y2={pad.top + plotH}
                stroke="#94a3b8"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              {SCENARIOS.map((sc) => {
                if (!visibleScenarios[sc.id]) return null;
                const val = activePoint.values[sc.id].portfolioPkr;
                return (
                  <circle
                    key={sc.id}
                    cx={xForIndex(activeIdx)}
                    cy={yForValue(val)}
                    r={inputs.selectedScenario === sc.id ? 4.5 : 3.5}
                    fill={sc.color}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                );
              })}
            </g>
          )}
        </svg>

        {/* Rich Live Inspection Strip below/coupled with Hover */}
        {activePoint && (
          <div className="mt-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-slate-900">
                Day {activePoint.day} · {activePoint.dateLabel}
              </span>
              <span className="text-slate-500">
                {hoverIndex === null
                  ? 'Showing Target Sell Date (hover chart to inspect any day)'
                  : 'Inspecting hovered day'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {SCENARIOS.map((sc) => {
                const datum = activePoint.values[sc.id];
                const isPos = datum.netReturnPkr > 0;
                const isNeg = datum.netReturnPkr < 0;

                return (
                  <div
                    key={sc.id}
                    className={`p-2.5 rounded-md border bg-white ${
                      inputs.selectedScenario === sc.id
                        ? 'border-slate-400'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                      <span
                        className="w-2 h-2 rounded-sm shrink-0"
                        style={{ backgroundColor: sc.color }}
                      />
                      <span className="truncate">{sc.shortLabel}</span>
                    </div>
                    <div className="mt-1 font-mono tabular-nums text-sm font-semibold text-slate-900">
                      {formatPkr(datum.portfolioPkr)}
                    </div>
                    <div className="mt-0.5 flex items-center justify-between text-[11px] font-mono tabular-nums">
                      <span className="text-slate-500">
                        Rate {datum.marketRate.toFixed(2)}
                      </span>
                      <span
                        className={
                          isPos
                            ? 'text-emerald-700 font-medium'
                            : isNeg
                            ? 'text-rose-700 font-medium'
                            : 'text-slate-600'
                        }
                      >
                        {formatSignedPkr(datum.netReturnPkr)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
