import { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from 'firebase/auth';
import { MessageSquare } from 'lucide-react';
import { googleSignIn, initAuth, logout } from './firebase';
import { SavedTarget, SimulatorInputs } from './types/simulator';
import { calculateSimulation, DEFAULT_FALLBACK_RATE } from './utils/finance';
import { buildMilestones } from './utils/calendar';
import { fetchLiveUsdPkrRate } from './utils/exchangeRate';
import {
  deleteCloudTarget,
  deleteGuestTarget,
  loadGuestTargets,
  saveCloudTarget,
  saveGuestTarget,
  subscribeToCloudTargets,
  syncGuestTargetsToCloud,
} from './services/targetsService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Navbar } from './components/Navbar';
import { SimulatorControls } from './components/SimulatorControls';
import { SummaryMetrics } from './components/SummaryMetrics';
import { ProjectionChart } from './components/ProjectionChart';
import { ScenarioTable } from './components/ScenarioTable';
import { MilestonesAndWorkspace } from './components/MilestonesAndWorkspace';
import { SavedTargetsDashboard } from './components/SavedTargetsDashboard';
import { AiAssistantDrawer } from './components/AiAssistantDrawer';

const INITIAL_INPUTS: SimulatorInputs = {
  amountUsd: 100,
  holdingDays: 30,
  exchangeRate: DEFAULT_FALLBACK_RATE,
  spreadPkr: 1.5,
  spreadEnabled: true,
  targetProfitMode: false,
  targetProfitPkr: 2500,
  selectedScenario: 'moderate_rise',
};

function PakFxApp() {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [guestMode, setGuestMode] = useState(true);

  const [inputs, setInputs] = useState<SimulatorInputs>(INITIAL_INPUTS);
  const [rateMeta, setRateMeta] = useState<{
    isLive: boolean;
    isManualOverride: boolean;
    source: string;
    fetchedAt: string;
    loading: boolean;
    error?: string;
  }>({
    isLive: false,
    isManualOverride: false,
    source: 'Connecting...',
    fetchedAt: '',
    loading: true,
  });

  const [cloudTargets, setCloudTargets] = useState<SavedTarget[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);
  const [guestTargets, setGuestTargets] = useState<SavedTarget[]>(() =>
    loadGuestTargets()
  );

  const [aiOpen, setAiOpen] = useState(false);

  // Auth listener
  useEffect(() => {
    const unsub = initAuth((nextUser, token) => {
      setUser(nextUser);
      setAccessToken(token);
      if (nextUser) {
        setGuestMode(false);
      }
    });
    return () => unsub();
  }, []);

  // Firestore real-time subscription when signed in
  useEffect(() => {
    if (!user) {
      setCloudTargets([]);
      setCloudLoading(false);
      return;
    }

    setCloudLoading(true);
    const unsub = subscribeToCloudTargets(
      user.uid,
      (items) => {
        setCloudTargets(items);
        setCloudLoading(false);
      },
      (err) => {
        console.error('Targets subscription error:', err);
        setCloudLoading(false);
      }
    );

    return () => unsub();
  }, [user]);

  // Fetch live USD/PKR rate on startup
  const refreshLiveRate = useCallback(async () => {
    setRateMeta((prev) => ({ ...prev, loading: true, error: undefined }));
    const res = await fetchLiveUsdPkrRate();
    setInputs((prev) => ({ ...prev, exchangeRate: res.rate }));
    setRateMeta({
      isLive: res.isLive,
      isManualOverride: false,
      source: res.source,
      fetchedAt: res.fetchedAt,
      loading: false,
      error: res.error,
    });
  }, []);

  useEffect(() => {
    void refreshLiveRate();
  }, [refreshLiveRate]);

  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      const res = await googleSignIn();
      setUser(res.user);
      setAccessToken(res.accessToken);
      setGuestMode(false);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Google Sign-In was cancelled or failed.'
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await logout();
    setUser(null);
    setAccessToken(null);
    setGuestMode(true);
  };

  const handleInputsPatch = useCallback((patch: Partial<SimulatorInputs>) => {
    setInputs((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleRateChange = useCallback((newRate: number, manual: boolean) => {
    setInputs((prev) => ({ ...prev, exchangeRate: newRate }));
    setRateMeta((prev) => ({
      ...prev,
      isManualOverride: manual,
    }));
  }, []);

  const summary = useMemo(() => calculateSimulation(inputs), [inputs]);
  const milestones = useMemo(
    () => buildMilestones(inputs, summary),
    [inputs, summary]
  );

  const handleSaveTarget = async (title: string) => {
    if (user) {
      await saveCloudTarget(user.uid, title, inputs);
    } else {
      const updated = saveGuestTarget(title, inputs);
      setGuestTargets(updated);
    }
  };

  const handleLoadTarget = (target: SavedTarget) => {
    setInputs({
      amountUsd: target.amountUsd,
      holdingDays: target.holdingDays,
      exchangeRate: target.exchangeRate,
      spreadPkr: target.spreadPkr,
      spreadEnabled: target.spreadPkr > 0,
      targetProfitMode: target.targetProfitMode,
      targetProfitPkr: target.targetProfitPkr,
      selectedScenario: target.selectedScenario,
    });
    setRateMeta((prev) => ({ ...prev, isManualOverride: true }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteTarget = async (target: SavedTarget) => {
    if (target.source === 'cloud' && user) {
      await deleteCloudTarget(target.id);
    } else {
      const updated = deleteGuestTarget(target.id);
      setGuestTargets(updated);
    }
  };

  const handleSyncGuestToCloud = async () => {
    if (!user || guestTargets.length === 0) return;
    await syncGuestTargetsToCloud(user.uid, guestTargets);
    setGuestTargets([]);
  };

  const activeTargets = user ? cloudTargets : guestTargets;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Navbar
        user={user}
        authLoading={authLoading}
        guestMode={guestMode}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        onContinueGuest={() => setGuestMode(true)}
      />

      <main className="flex-1 max-w-[1360px] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
        {/* Page Header / Workspace Toolbar */}
        <div
          id="simulator"
          className="flex flex-col md:flex-row md:items-end justify-between gap-4"
        >
          <div className="space-y-1 max-w-2xl">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 text-balance">
              USD-to-PKR Investment Simulator & Schedule Planner
            </h1>
            <p className="text-sm text-slate-600">
              Model open-market dealer spreads, proportional multi-regime returns, Google Calendar milestones, and Gmail plan reports.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs text-slate-500">
              {user ? 'Signed in · Cloud Workspace' : 'Guest Mode · LocalStorage'}
            </span>
            <button
              type="button"
              onClick={() => setAiOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Ask AI FX Advisor
            </button>
          </div>
        </div>

        {authError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-800">
            {authError}
          </div>
        )}

        {/* Main 2-Column Simulator Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-4">
            <SimulatorControls
              inputs={inputs}
              summary={summary}
              rateMeta={rateMeta}
              isSignedIn={Boolean(user)}
              onChange={handleInputsPatch}
              onRateChange={handleRateChange}
              onRefreshRate={refreshLiveRate}
              onSaveTarget={handleSaveTarget}
            />
          </div>

          <div className="lg:col-span-8 space-y-6">
            <SummaryMetrics inputs={inputs} summary={summary} />
            <ProjectionChart inputs={inputs} summary={summary} />
            <ScenarioTable
              inputs={inputs}
              summary={summary}
              onSelectScenario={(id) => handleInputsPatch({ selectedScenario: id })}
            />
          </div>
        </div>

        {/* Google Calendar Milestones & Gmail Reports */}
        <MilestonesAndWorkspace
          user={user}
          accessToken={accessToken}
          inputs={inputs}
          summary={summary}
          milestones={milestones}
          onAuthorizeWorkspace={handleSignIn}
        />

        {/* Saved Targets Dashboard */}
        <SavedTargetsDashboard
          targets={activeTargets}
          loading={user ? cloudLoading : false}
          isSignedIn={Boolean(user)}
          guestTargetCount={guestTargets.length}
          onLoadTarget={handleLoadTarget}
          onDeleteTarget={handleDeleteTarget}
          onSyncGuestToCloud={handleSyncGuestToCloud}
          onSignIn={handleSignIn}
        />
      </main>

      <footer className="border-t border-slate-200 bg-white mt-12">
        <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>PakFX Planner · Educational FX Simulation & Planning</span>
          <span>Live reference rates via open.er-api.com · Offline default 276.50 PKR</span>
        </div>
      </footer>

      <AiAssistantDrawer
        open={aiOpen}
        onToggle={setAiOpen}
        inputs={inputs}
        summary={summary}
      />
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <PakFxApp />
    </ErrorBoundary>
  );
}
