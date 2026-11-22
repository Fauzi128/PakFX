import {
  DailyChartPoint,
  ScenarioDefinition,
  ScenarioId,
  ScenarioOutcome,
  SimulationSummary,
  SimulatorInputs,
} from '../types/simulator';

export const DEFAULT_FALLBACK_RATE = 276.5;

export const SCENARIOS: ScenarioDefinition[] = [
  {
    id: 'stable_2026',
    label: '2026 Stable Trend',
    shortLabel: '2026 Stable',
    monthlyRatePct: -0.15,
    description: 'Mild PKR appreciation drift (-0.15% per 30 days).',
    color: '#DC2626',
  },
  {
    id: 'flat_pegged',
    label: 'Flat / Pegged Market',
    shortLabel: 'Flat / Pegged',
    monthlyRatePct: 0.0,
    description: 'Unchanged rate (0.00% per 30 days) — highlights spread drag.',
    color: '#D97706',
  },
  {
    id: 'moderate_rise',
    label: 'Moderate Dollar Rise',
    shortLabel: 'Moderate Rise',
    monthlyRatePct: 1.5,
    description: 'Gradual USD appreciation (+1.50% per 30 days).',
    color: '#2563EB',
  },
  {
    id: 'historical_surge',
    label: 'Historical Surge',
    shortLabel: 'Historical Surge',
    monthlyRatePct: 3.5,
    description: 'Sharp PKR depreciation cycle (+3.50% per 30 days, 2022–2023 style).',
    color: '#059669',
  },
];

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function addDays(base: Date, days: number): Date {
  const copy = new Date(base.getFullYear(), base.getMonth(), base.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function formatShortDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function formatCompactDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function toIsoDateOnly(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatPkr(amount: number, decimals = 0): string {
  const absFormatted = Math.abs(amount).toLocaleString('en-PK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return amount < 0 ? `-Rs. ${absFormatted}` : `Rs. ${absFormatted}`;
}

export function formatSignedPkr(amount: number, decimals = 0): string {
  const absFormatted = Math.abs(amount).toLocaleString('en-PK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  if (amount > 0) return `+Rs. ${absFormatted}`;
  if (amount < 0) return `-Rs. ${absFormatted}`;
  return `Rs. ${absFormatted}`;
}

export function formatUsd(amount: number): string {
  return `$${amount.toLocaleString('en-US', {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function calculateSimulation(
  inputs: SimulatorInputs,
  baseDate: Date = new Date()
): SimulationSummary {
  const amountUsd = clampNumber(inputs.amountUsd, 10, 50000);
  const holdingDays = Math.round(clampNumber(inputs.holdingDays, 1, 365));
  const exchangeRate = clampNumber(inputs.exchangeRate, 50, 2000);
  const effectiveSpreadPkr = inputs.spreadEnabled
    ? clampNumber(inputs.spreadPkr, 0, 25)
    : 0;

  const initialInvestmentPkr = amountUsd * exchangeRate;
  const breakEvenRate = exchangeRate + effectiveSpreadPkr;
  const optimalSellDate = addDays(baseDate, holdingDays);

  const requiredExitRate =
    inputs.targetProfitMode && inputs.targetProfitPkr >= 0
      ? exchangeRate + effectiveSpreadPkr + inputs.targetProfitPkr / amountUsd
      : null;

  const outcomes: ScenarioOutcome[] = SCENARIOS.map((scenario) => {
    const proportionalGain = (scenario.monthlyRatePct / 100) * (holdingDays / 30);
    const projectedMarketRate = exchangeRate * (1 + proportionalGain);
    const effectiveSellRate = Math.max(0, projectedMarketRate - effectiveSpreadPkr);
    const grossPayoutPkr = amountUsd * projectedMarketRate;
    const netPayoutPkr = amountUsd * effectiveSellRate;
    const netReturnPkr = netPayoutPkr - initialInvestmentPkr;
    const netReturnPct =
      initialInvestmentPkr > 0 ? (netReturnPkr / initialInvestmentPkr) * 100 : 0;

    let daysToTarget: number | null = null;
    if (requiredExitRate !== null) {
      const requiredMarketGain = (requiredExitRate - exchangeRate) / exchangeRate;
      const monthlyFraction = scenario.monthlyRatePct / 100;
      if (monthlyFraction > 0) {
        daysToTarget = Math.max(1, Math.ceil((requiredMarketGain / monthlyFraction) * 30));
      }
    }

    return {
      id: scenario.id,
      label: scenario.label,
      shortLabel: scenario.shortLabel,
      monthlyRatePct: scenario.monthlyRatePct,
      color: scenario.color,
      projectedMarketRate,
      effectiveSellRate,
      grossPayoutPkr,
      netPayoutPkr,
      netReturnPkr,
      netReturnPct,
      daysToTarget,
    };
  });

  const activeOutcome =
    outcomes.find((o) => o.id === inputs.selectedScenario) ?? outcomes[2];

  const dailySeries: DailyChartPoint[] = [];
  for (let day = 0; day <= holdingDays; day += 1) {
    const date = addDays(baseDate, day);
    const values = {} as DailyChartPoint['values'];

    for (const scenario of SCENARIOS) {
      const gain = (scenario.monthlyRatePct / 100) * (day / 30);
      const marketRate = exchangeRate * (1 + gain);
      const effectiveSellRate = Math.max(0, marketRate - effectiveSpreadPkr);
      const portfolioPkr = amountUsd * effectiveSellRate;
      const netReturnPkr = portfolioPkr - initialInvestmentPkr;
      const netReturnPct =
        initialInvestmentPkr > 0 ? (netReturnPkr / initialInvestmentPkr) * 100 : 0;

      values[scenario.id as ScenarioId] = {
        marketRate,
        effectiveSellRate,
        portfolioPkr,
        netReturnPkr,
        netReturnPct,
      };
    }

    dailySeries.push({
      day,
      dateIso: toIsoDateOnly(date),
      dateLabel: formatShortDate(date),
      values,
    });
  }

  return {
    initialInvestmentPkr,
    effectiveSpreadPkr,
    breakEvenRate,
    optimalSellDate,
    optimalSellDateLabel: formatShortDate(optimalSellDate),
    requiredExitRate,
    activeOutcome,
    outcomes,
    dailySeries,
  };
}
