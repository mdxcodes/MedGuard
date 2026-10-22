import { Menu, Waves } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import ModeSwitcher from './mode-switcher/ModeSwitcher';
import useMediaQuery from '../hooks/useMediaQuery';
import { useModelStatus } from '../app/ModelStatusProvider';
import { findRoute } from '../lib/modeRoutes';

export default function Header({ onMenu }) {
  const loc = useLocation();
  // Exactly one mode switcher exists in the DOM at a time: the header on wide
  // screens, the navigation panel on narrow ones. Two instances would leave a
  // duplicate control in the accessibility tree.
  const isWide = useMediaQuery('(min-width: 640px)');
  const route = findRoute(loc.pathname);
  const pageTitle = route?.label || '';
  const { apiStatus, modelStatus } = useModelStatus();

  /**
   * The status chip reports the API first and the model second.
   *
   * A reachable API that has no model artifact loaded is a healthy service
   * with a missing artifact, not an outage — labelling it "unavailable" made
   * a working deployment look broken.
   */
  const status = (() => {
    if (apiStatus === 'error') {
      return {
        label: 'API offline',
        dot: 'bg-error/60',
        title: 'The MedGuard API could not be reached.',
      };
    }
    if (modelStatus === 'ready') {
      return {
        label: 'Model ready',
        dot: 'bg-primary',
        title: 'The triage model is loaded and serving predictions.',
      };
    }
    if (modelStatus === 'not-loaded') {
      return {
        label: 'API online',
        hint: 'model not loaded',
        dot: 'bg-warning/60',
        title:
          'The API is running, but the model artifact is not loaded on the server, '
          + 'so predictions are unavailable.',
      };
    }
    if (modelStatus === 'error') {
      return {
        label: 'API online',
        hint: 'model status unknown',
        dot: 'bg-warning/60',
        title: 'The API is running, but the model status could not be determined.',
      };
    }
    return {
      label: 'Checking…',
      dot: 'bg-warning/50',
      title: 'Checking the API and model status.',
    };
  })();

  return (
    <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onMenu}
            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-surface-soft transition text-secondary shrink-0"
            aria-label="Open navigation"
            title="Menu"
          >
            <Menu className="w-5 h-5" aria-hidden="true" />
          </button>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-soft flex items-center justify-center shadow-md shadow-primary/20 shrink-0">
            <Waves className="w-4.5 h-4.5 text-primary" aria-hidden="true" />
          </div>
            <div className="hidden sm:block min-w-0">
              <div className="text-sm font-extrabold tracking-tight text-ink leading-none">MedGuard</div>
              <div className="text-[10px] font-mono text-secondary tracking-widest uppercase leading-none mt-0.5 truncate">
                Research Lab
              </div>
            </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {pageTitle && (
            <div className="hidden lg:flex items-center gap-1 px-3 py-2 rounded-xl bg-surface-soft border border-border text-xs font-medium text-primary shrink-0">
              <span className="text-primary">{pageTitle}</span>
            </div>
          )}
          {/* The mode switcher stays in the header at every width — it is a
              core feature and must remain discoverable. On narrow screens it
              collapses to short labels and the verbose status chip gives way
              to a compact dot so the row never overflows. */}
          <div className="shrink-0">
            <ModeSwitcher compact={!isWide} />
          </div>
          <div className="h-4 w-px border hidden sm:block" />
          <div
            className="flex items-center gap-2 text-[10px] font-mono bg-surface-soft px-2.5 py-1 rounded-full border border-border shrink-0"
            title={`${status.title} · v0.2.0-demo`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${status.dot} shadow-sm`} />
            <span className="text-ink hidden sm:inline">{status.label}</span>
            {status.hint && (
              <span className="text-muted hidden md:inline">· {status.hint}</span>
            )}
            <span className="text-muted hidden sm:inline">· v0.2.0-demo</span>
          </div>
        </div>
      </div>
    </header>
  );
}
