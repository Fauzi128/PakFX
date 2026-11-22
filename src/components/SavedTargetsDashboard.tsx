import React, { useMemo, useState } from 'react';
import { CloudUpload, FolderOpen, Search, Trash2 } from 'lucide-react';
import { SavedTarget } from '../types/simulator';
import { formatPkr, formatUsd, SCENARIOS } from '../utils/finance';
import { ConfirmDialog } from './ConfirmDialog';

interface SavedTargetsDashboardProps {
  targets: SavedTarget[];
  loading: boolean;
  isSignedIn: boolean;
  guestTargetCount: number;
  onLoadTarget: (target: SavedTarget) => void;
  onDeleteTarget: (target: SavedTarget) => Promise<void>;
  onSyncGuestToCloud: () => Promise<void>;
  onSignIn: () => void;
}

export const SavedTargetsDashboard: React.FC<SavedTargetsDashboardProps> = ({
  targets,
  loading,
  isSignedIn,
  guestTargetCount,
  onLoadTarget,
  onDeleteTarget,
  onSyncGuestToCloud,
  onSignIn,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [targetToDelete, setTargetToDelete] = useState<SavedTarget | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const filteredTargets = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return targets;
    return targets.filter((t) => t.title.toLowerCase().includes(q));
  }, [targets, searchQuery]);

  const handleConfirmDelete = async () => {
    if (!targetToDelete) return;
    setDeleting(true);
    try {
      await onDeleteTarget(targetToDelete);
      setTargetToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await onSyncGuestToCloud();
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section
      id="saved-targets"
      className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
    >
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            Saved Investment Targets
          </h2>
          <p className="text-sm text-slate-500">
            {isSignedIn
              ? 'Synced to your private Firestore workspace across devices'
              : 'Guest mode (saved locally in this browser) · Sign in with Google for cloud sync'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {isSignedIn && guestTargetCount > 0 && (
            <button
              type="button"
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              {syncing
                ? 'Syncing...'
                : `Import ${guestTargetCount} Guest Plan${guestTargetCount > 1 ? 's' : ''}`}
            </button>
          )}

          {!isSignedIn && (
            <button
              type="button"
              onClick={onSignIn}
              className="px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              Sign in for Cloud Sync
            </button>
          )}
        </div>
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter saved investment plans..."
          className="w-full pl-9 pr-3 py-2 text-sm text-slate-900 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-700/20 focus:border-emerald-700"
        />
      </div>

      {/* States */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((idx) => (
            <div
              key={idx}
              className="h-28 bg-slate-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      ) : filteredTargets.length === 0 ? (
        <div className="py-10 px-4 text-center border border-dashed border-slate-200 rounded-lg space-y-2">
          <p className="text-sm font-medium text-slate-700">
            {targets.length === 0
              ? 'No saved investment targets yet'
              : 'No saved plans match your search'}
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Configure your USD amount, holding duration, and dealer spread in the simulator above, then click Save Target to bookmark it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredTargets.map((target) => {
            const sc = SCENARIOS.find((s) => s.id === target.selectedScenario);
            return (
              <div
                key={target.id}
                className="border border-slate-200 rounded-lg p-4 flex flex-col justify-between gap-3 hover:border-slate-300 transition-colors"
              >
                <div className="space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-900 line-clamp-1">
                      {target.title}
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400 shrink-0">
                      {target.source === 'cloud' ? 'Cloud' : 'Local'}
                    </span>
                  </div>
                  <div className="text-xs font-mono tabular-nums text-slate-600">
                    {formatUsd(target.amountUsd)} · {target.holdingDays}d ·{' '}
                    {target.exchangeRate.toFixed(2)} PKR
                  </div>
                  <div className="text-xs text-slate-500">
                    Spread {target.spreadPkr.toFixed(2)} PKR ·{' '}
                    {sc?.shortLabel ?? 'Moderate Rise'}
                    {target.targetProfitMode
                      ? ` · Goal +${formatPkr(target.targetProfitPkr)}`
                      : ''}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onLoadTarget(target)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors whitespace-nowrap"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    Load into Simulator
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetToDelete(target)}
                    aria-label={`Delete ${target.title}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={targetToDelete !== null}
        title="Delete Saved Investment Target?"
        description={
          targetToDelete
            ? `Are you sure you want to permanently remove "${targetToDelete.title}"? This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete Target"
        tone="danger"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setTargetToDelete(null)}
      />
    </section>
  );
};
