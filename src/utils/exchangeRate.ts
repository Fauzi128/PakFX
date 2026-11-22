import { DEFAULT_FALLBACK_RATE } from './finance';

export interface ExchangeRateResult {
  rate: number;
  isLive: boolean;
  source: string;
  fetchedAt: string;
  error?: string;
}

export async function fetchLiveUsdPkrRate(): Promise<ExchangeRateResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const data = (await res.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
    };
    const pkr = data?.rates?.PKR;
    if (typeof pkr !== 'number' || !Number.isFinite(pkr) || pkr <= 0) {
      throw new Error('PKR rate unavailable in API response');
    }

    return {
      rate: Number(pkr.toFixed(2)),
      isLive: true,
      source: 'open.er-api.com',
      fetchedAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : 'Network unavailable';
    return {
      rate: DEFAULT_FALLBACK_RATE,
      isLive: false,
      source: 'Offline fallback default',
      fetchedAt: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      }),
      error: `Live feed unavailable (${reason}). Using default ${DEFAULT_FALLBACK_RATE.toFixed(2)} PKR.`,
    };
  } finally {
    clearTimeout(timer);
  }
}
