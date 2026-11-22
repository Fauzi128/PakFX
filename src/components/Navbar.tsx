import React from 'react';
import { User } from 'firebase/auth';
import { LogOut } from 'lucide-react';

interface NavbarProps {
  user: User | null;
  authLoading: boolean;
  guestMode: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
  onContinueGuest: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  authLoading,
  guestMode,
  onSignIn,
  onSignOut,
  onContinueGuest,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200">
      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#simulator"
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          PakFX Planner
        </a>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav
          aria-label="Primary navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
        >
          <a
            href="#simulator"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Simulator
          </a>
          <a
            href="#projections"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Projections
          </a>
          <a
            href="#milestones"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Milestones
          </a>
          <a
            href="#saved-targets"
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Saved Targets
          </a>
        </nav>

        {/* Zone 3: 1 primary auth action */}
        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-medium text-slate-900 max-w-[160px] truncate">
                  {user.displayName || user.email}
                </span>
                <span className="text-[11px] text-slate-500">Cloud Synced</span>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {!guestMode && (
                <button
                  type="button"
                  onClick={onContinueGuest}
                  className="hidden sm:inline-flex px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
                >
                  Continue as Guest
                </button>
              )}
              <button
                type="button"
                onClick={onSignIn}
                disabled={authLoading}
                className="gsi-material-button"
              >
                <div className="gsi-material-button-state" />
                <div className="gsi-material-button-content-wrapper">
                  <div className="gsi-material-button-icon">
                    <svg
                      version="1.1"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 48 48"
                      style={{ display: 'block' }}
                    >
                      <path
                        fill="#EA4335"
                        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                      />
                      <path
                        fill="#4285F4"
                        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                      />
                      <path
                        fill="#34A853"
                        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                      />
                      <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                  </div>
                  <span className="gsi-material-button-contents">
                    {authLoading ? 'Signing in...' : 'Sign in with Google'}
                  </span>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
