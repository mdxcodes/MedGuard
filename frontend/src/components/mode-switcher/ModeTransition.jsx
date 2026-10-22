import { Waves } from 'lucide-react';
import { useMode } from '../../app/ModeProvider';
import { MODE_PATIENT, MODE_RESEARCH } from '../../lib/modeStorage';

const ICONS = {
  [MODE_PATIENT]: Waves,
  [MODE_RESEARCH]: Waves,
};

/**
 * Transition layer shown while the interface switches modes.
 *
 * This is presentation only. The mode is already committed by the time the
 * destination shell renders, so if this component fails to render — or fails
 * entirely — the application still switches correctly. It never triggers a
 * network request and never delays the destination beyond the short overlay.
 *
 * The status message is announced once through an assertive live region, so
 * screen-reader users learn that the interface changed without every
 * animation frame being narrated.
 */
export default function ModeTransition() {
  const { transitioning, pendingMode, transitionMessage, reducedMotion } = useMode();

  if (!transitioning) return null;

  const Icon = ICONS[pendingMode] || Waves;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-page/85 backdrop-blur-[2px]"
      data-testid="mode-transition"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <div className="relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-soft flex items-center justify-center shadow-lg shadow-primary/25">
            <Icon className="w-7 h-7 text-primary-contrast" />
          </div>
          {!reducedMotion && (
            <>
              <span className="absolute inset-0 rounded-2xl border border-primary/40 animate-mg-pulse-ring" />
              <span className="absolute inset-0 rounded-2xl border border-primary/25 animate-mg-pulse-ring-delayed" />
            </>
          )}
        </div>
        <div className="space-y-1.5">
          <div className="text-sm font-semibold text-primary">{transitionMessage}</div>
          <div className="text-[11px] text-muted">
            Same model, same data, different view.
          </div>
        </div>
      </div>

      {/* Announced once to assistive technology. */}
      <div role="status" aria-live="assertive" className="sr-only">
        {transitionMessage}
      </div>
    </div>
  );
}
