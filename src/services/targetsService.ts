import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { SavedTarget, ScenarioId, SimulatorInputs } from '../types/simulator';
import { clampNumber } from '../utils/finance';

const COLLECTION_NAME = 'investmentTargets';
const GUEST_STORAGE_KEY = 'pakfx_guest_targets_v1';
const ALLOWED_SCENARIOS: ScenarioId[] = [
  'stable_2026',
  'flat_pegged',
  'moderate_rise',
  'historical_surge',
];

function sanitizeTitle(title: string): string {
  const trimmed = title.trim().replace(/\s+/g, ' ');
  if (!trimmed) return 'USD-to-PKR Target Plan';
  return trimmed.slice(0, 120);
}

function sanitizeScenario(scenario: ScenarioId): ScenarioId {
  return ALLOWED_SCENARIOS.includes(scenario) ? scenario : 'moderate_rise';
}

function generateSafeDocId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `tgt_${Date.now()}_${rand}`.replace(/[^a-zA-Z0-9_-]/g, '');
}

export function subscribeToCloudTargets(
  ownerId: string,
  onData: (targets: SavedTarget[]) => void,
  onError: (err: Error) => void
): () => void {
  const q = query(
    collection(db, COLLECTION_NAME),
    where('ownerId', '==', ownerId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: SavedTarget[] = snapshot.docs.map((docSnap) => {
        const d = docSnap.data();
        const createdAtMs =
          d.createdAt instanceof Timestamp ? d.createdAt.toMillis() : Date.now();
        const updatedAtMs =
          d.updatedAt instanceof Timestamp ? d.updatedAt.toMillis() : createdAtMs;

        return {
          id: docSnap.id,
          ownerId: String(d.ownerId ?? ownerId),
          title: String(d.title ?? 'Saved Target'),
          amountUsd: Number(d.amountUsd ?? 100),
          holdingDays: Number(d.holdingDays ?? 30),
          exchangeRate: Number(d.exchangeRate ?? 276.5),
          spreadPkr: Number(d.spreadPkr ?? 1.5),
          targetProfitMode: Boolean(d.targetProfitMode),
          targetProfitPkr: Number(d.targetProfitPkr ?? 0),
          selectedScenario: sanitizeScenario(d.selectedScenario as ScenarioId),
          createdAtMs,
          updatedAtMs,
          source: 'cloud',
        };
      });

      items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export async function saveCloudTarget(
  ownerId: string,
  title: string,
  inputs: SimulatorInputs
): Promise<string> {
  const id = generateSafeDocId();
  const docPath = `${COLLECTION_NAME}/${id}`;

  const payload = {
    ownerId,
    title: sanitizeTitle(title),
    amountUsd: Number(clampNumber(inputs.amountUsd, 10, 50000).toFixed(2)),
    holdingDays: Math.round(clampNumber(inputs.holdingDays, 1, 365)),
    exchangeRate: Number(clampNumber(inputs.exchangeRate, 50, 2000).toFixed(2)),
    spreadPkr: inputs.spreadEnabled
      ? Number(clampNumber(inputs.spreadPkr, 0, 25).toFixed(2))
      : 0,
    targetProfitMode: Boolean(inputs.targetProfitMode),
    targetProfitPkr: inputs.targetProfitMode
      ? Number(clampNumber(inputs.targetProfitPkr, 0, 50000000).toFixed(2))
      : 0,
    selectedScenario: sanitizeScenario(inputs.selectedScenario),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  try {
    await setDoc(doc(db, COLLECTION_NAME, id), payload);
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function deleteCloudTarget(targetId: string): Promise<void> {
  const safeId = targetId.replace(/[^a-zA-Z0-9_-]/g, '');
  const docPath = `${COLLECTION_NAME}/${safeId}`;
  try {
    await deleteDoc(doc(db, COLLECTION_NAME, safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export function loadGuestTargets(): SavedTarget[] {
  try {
    const raw = localStorage.getItem(GUEST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object' && typeof item.id === 'string')
      .map((item) => ({
        id: String(item.id),
        ownerId: 'guest',
        title: sanitizeTitle(String(item.title ?? 'Guest Plan')),
        amountUsd: clampNumber(Number(item.amountUsd ?? 100), 10, 50000),
        holdingDays: Math.round(clampNumber(Number(item.holdingDays ?? 30), 1, 365)),
        exchangeRate: clampNumber(Number(item.exchangeRate ?? 276.5), 50, 2000),
        spreadPkr: clampNumber(Number(item.spreadPkr ?? 1.5), 0, 25),
        targetProfitMode: Boolean(item.targetProfitMode),
        targetProfitPkr: clampNumber(Number(item.targetProfitPkr ?? 0), 0, 50000000),
        selectedScenario: sanitizeScenario(item.selectedScenario as ScenarioId),
        createdAtMs: Number(item.createdAtMs ?? Date.now()),
        updatedAtMs: Number(item.updatedAtMs ?? Date.now()),
        source: 'guest' as const,
      }))
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
  } catch {
    return [];
  }
}

export function saveGuestTarget(title: string, inputs: SimulatorInputs): SavedTarget[] {
  const now = Date.now();
  const nextItem: SavedTarget = {
    id: generateSafeDocId(),
    ownerId: 'guest',
    title: sanitizeTitle(title),
    amountUsd: Number(clampNumber(inputs.amountUsd, 10, 50000).toFixed(2)),
    holdingDays: Math.round(clampNumber(inputs.holdingDays, 1, 365)),
    exchangeRate: Number(clampNumber(inputs.exchangeRate, 50, 2000).toFixed(2)),
    spreadPkr: inputs.spreadEnabled
      ? Number(clampNumber(inputs.spreadPkr, 0, 25).toFixed(2))
      : 0,
    targetProfitMode: Boolean(inputs.targetProfitMode),
    targetProfitPkr: inputs.targetProfitMode
      ? Number(clampNumber(inputs.targetProfitPkr, 0, 50000000).toFixed(2))
      : 0,
    selectedScenario: sanitizeScenario(inputs.selectedScenario),
    createdAtMs: now,
    updatedAtMs: now,
    source: 'guest',
  };

  const existing = loadGuestTargets();
  const updated = [nextItem, ...existing].slice(0, 50);
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export function deleteGuestTarget(targetId: string): SavedTarget[] {
  const existing = loadGuestTargets();
  const updated = existing.filter((item) => item.id !== targetId);
  localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function syncGuestTargetsToCloud(
  ownerId: string,
  guestTargets: SavedTarget[]
): Promise<number> {
  let count = 0;
  for (const gt of guestTargets) {
    await saveCloudTarget(ownerId, gt.title, {
      amountUsd: gt.amountUsd,
      holdingDays: gt.holdingDays,
      exchangeRate: gt.exchangeRate,
      spreadPkr: gt.spreadPkr,
      spreadEnabled: gt.spreadPkr > 0,
      targetProfitMode: gt.targetProfitMode,
      targetProfitPkr: gt.targetProfitPkr,
      selectedScenario: gt.selectedScenario,
    });
    count += 1;
  }
  localStorage.removeItem(GUEST_STORAGE_KEY);
  return count;
}
