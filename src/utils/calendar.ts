import { InvestmentMilestone, SimulationSummary, SimulatorInputs } from '../types/simulator';
import { addDays, formatPkr, formatShortDate, formatSignedPkr, formatUsd, toIsoDateOnly } from './finance';

export function buildMilestones(
  inputs: SimulatorInputs,
  summary: SimulationSummary,
  baseDate: Date = new Date()
): InvestmentMilestone[] {
  const holdingDays = Math.max(1, Math.round(inputs.holdingDays));
  const midDay = Math.max(1, Math.floor(holdingDays / 2));

  const buyDate = addDays(baseDate, 0);
  const midDate = addDays(baseDate, midDay);
  const sellDate = addDays(baseDate, holdingDays);

  const midPointData =
    summary.dailySeries[Math.min(midDay, summary.dailySeries.length - 1)]?.values[
      inputs.selectedScenario
    ];
  const midRate = midPointData ? midPointData.marketRate : inputs.exchangeRate;

  const targetSellRate =
    inputs.targetProfitMode && summary.requiredExitRate !== null
      ? summary.requiredExitRate
      : summary.activeOutcome.projectedMarketRate;

  return [
    {
      id: 'buy',
      dayOffset: 0,
      date: buyDate,
      dateLabel: formatShortDate(buyDate),
      isoDate: toIsoDateOnly(buyDate),
      title: `Buy ${formatUsd(inputs.amountUsd)} USD Entry`,
      badge: 'Day 0 · Entry',
      targetRate: inputs.exchangeRate,
      summary: `Target entry at ${inputs.exchangeRate.toFixed(2)} PKR/USD (${formatPkr(summary.initialInvestmentPkr)}).`,
      details: `Convert ${formatPkr(summary.initialInvestmentPkr)} into ${formatUsd(inputs.amountUsd)} USD at target buy rate ${inputs.exchangeRate.toFixed(2)} PKR. Dealer spread set to ${summary.effectiveSpreadPkr.toFixed(2)} PKR/USD (break-even exit rate: ${summary.breakEvenRate.toFixed(2)} PKR).`,
    },
    {
      id: 'midpoint',
      dayOffset: midDay,
      date: midDate,
      dateLabel: formatShortDate(midDate),
      isoDate: toIsoDateOnly(midDate),
      title: `Mid-Point USD/PKR Market Review`,
      badge: `Day ${midDay} · Check-In`,
      targetRate: midRate,
      summary: `Check open-market rate vs. ${summary.breakEvenRate.toFixed(2)} PKR break-even.`,
      details: `Halfway review for your ${holdingDays}-day ${formatUsd(inputs.amountUsd)} position under ${summary.activeOutcome.label}. Projected checkpoint rate: ${midRate.toFixed(2)} PKR. Compare live dealer buy/sell quotes against break-even (${summary.breakEvenRate.toFixed(2)} PKR).`,
    },
    {
      id: 'sell',
      dayOffset: holdingDays,
      date: sellDate,
      dateLabel: formatShortDate(sellDate),
      isoDate: toIsoDateOnly(sellDate),
      title: `Target Sell & Profit-Taking Review`,
      badge: `Day ${holdingDays} · Target Exit`,
      targetRate: targetSellRate,
      summary: `Target sell rate ${targetSellRate.toFixed(2)} PKR · Est. net ${formatSignedPkr(summary.activeOutcome.netReturnPkr)}.`,
      details: `Scheduled exit date after ${holdingDays} days holding ${formatUsd(inputs.amountUsd)}. Projected market rate: ${summary.activeOutcome.projectedMarketRate.toFixed(2)} PKR (net after ${summary.effectiveSpreadPkr.toFixed(2)} PKR spread: ${summary.activeOutcome.effectiveSellRate.toFixed(2)} PKR, payout ${formatPkr(summary.activeOutcome.netPayoutPkr)}, net return ${formatSignedPkr(summary.activeOutcome.netReturnPkr)}).${
        inputs.targetProfitMode && summary.requiredExitRate !== null
          ? ` Target Profit Goal requires exit >= ${summary.requiredExitRate.toFixed(2)} PKR.`
          : ''
      }`,
    },
  ];
}

function formatGoogleTemplateDateRange(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  // 09:00 AM to 09:30 AM local time format YYYYMMDDTHHMMSS
  return `${y}${m}${d}T090000/${y}${m}${d}T093000`;
}

export function buildGoogleCalendarTemplateUrl(milestone: InvestmentMilestone): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: `PakFX: ${milestone.title}`,
    dates: formatGoogleTemplateDateRange(milestone.date),
    details: milestone.details,
    location: 'PakFX Planner · USD/PKR Open Market',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function formatIcsTimestamp(date: Date, hour = 9, minute = 0): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  return `${y}${m}${d}T${hh}${mm}00`;
}

export function generateIcsContent(milestones: InvestmentMilestone[]): string {
  const now = new Date();
  const dtStamp = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}${String(
    now.getUTCDate()
  ).padStart(2, '0')}T${String(now.getUTCHours()).padStart(2, '0')}${String(
    now.getUTCMinutes()
  ).padStart(2, '0')}${String(now.getUTCSeconds()).padStart(2, '0')}Z`;

  const events = milestones
    .map((m) => {
      const uid = `pakfx-${m.id}-${m.isoDate}-${Math.random().toString(36).slice(2, 8)}@pakfxplanner`;
      const dtStart = formatIcsTimestamp(m.date, 9, 0);
      const dtEnd = formatIcsTimestamp(m.date, 9, 30);
      return [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${dtStamp}`,
        `DTSTART:${dtStart}`,
        `DTEND:${dtEnd}`,
        `SUMMARY:${escapeIcsText(`PakFX: ${m.title}`)}`,
        `DESCRIPTION:${escapeIcsText(m.details)}`,
        'LOCATION:PakFX Planner',
        'BEGIN:VALARM',
        'TRIGGER:-PT30M',
        'ACTION:DISPLAY',
        `DESCRIPTION:${escapeIcsText(m.title)}`,
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n');
    })
    .join('\r\n');

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//PakFX Planner//USD-PKR Investment Schedule//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    events,
    'END:VCALENDAR',
  ].join('\r\n');
}

export function downloadIcsFile(milestones: InvestmentMilestone[], filename: string): void {
  const content = generateIcsContent(milestones);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
