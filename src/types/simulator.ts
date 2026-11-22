export type ScenarioId =
  | 'stable_2026'
  | 'flat_pegged'
  | 'moderate_rise'
  | 'historical_surge';

export interface ScenarioDefinition {
  id: ScenarioId;
  label: string;
  shortLabel: string;
  monthlyRatePct: number; // % change per 30 days
  description: string;
  color: string;
}

export interface SimulatorInputs {
  amountUsd: number;
  holdingDays: number;
  exchangeRate: number;
  spreadPkr: number;
  spreadEnabled: boolean;
  targetProfitMode: boolean;
  targetProfitPkr: number;
  selectedScenario: ScenarioId;
}

export interface ScenarioOutcome {
  id: ScenarioId;
  label: string;
  shortLabel: string;
  monthlyRatePct: number;
  color: string;
  projectedMarketRate: number;
  effectiveSellRate: number;
  grossPayoutPkr: number;
  netPayoutPkr: number;
  netReturnPkr: number;
  netReturnPct: number;
  daysToTarget: number | null;
}

export interface DailyChartPoint {
  day: number;
  dateIso: string;
  dateLabel: string;
  values: Record<
    ScenarioId,
    {
      marketRate: number;
      effectiveSellRate: number;
      portfolioPkr: number;
      netReturnPkr: number;
      netReturnPct: number;
    }
  >;
}

export interface SimulationSummary {
  initialInvestmentPkr: number;
  effectiveSpreadPkr: number;
  breakEvenRate: number;
  optimalSellDate: Date;
  optimalSellDateLabel: string;
  requiredExitRate: number | null;
  activeOutcome: ScenarioOutcome;
  outcomes: ScenarioOutcome[];
  dailySeries: DailyChartPoint[];
}

export interface InvestmentMilestone {
  id: 'buy' | 'midpoint' | 'sell';
  dayOffset: number;
  date: Date;
  dateLabel: string;
  isoDate: string;
  title: string;
  badge: string;
  targetRate: number;
  summary: string;
  details: string;
}

export interface SavedTarget {
  id: string;
  ownerId: string;
  title: string;
  amountUsd: number;
  holdingDays: number;
  exchangeRate: number;
  spreadPkr: number;
  targetProfitMode: boolean;
  targetProfitPkr: number;
  selectedScenario: ScenarioId;
  createdAtMs: number;
  updatedAtMs: number;
  source: 'cloud' | 'guest';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: number;
  error?: boolean;
}

export interface GmailMessagePreview {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}
