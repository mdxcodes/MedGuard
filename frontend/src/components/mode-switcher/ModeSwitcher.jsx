import { useCallback, useId, useRef } from 'react';
import { HeartPulse, FlaskConical } from 'lucide-react';
import { MODE_PATIENT, MODE_RESEARCH } from '../../lib/modeStorage';
import { useMode } from '../../app/ModeProvider';

/**
 * The two interface modes.
 *
 * `label` is the visible text; `shortLabel` is used in the compact mobile
 * rendering. Both are always explicit — "Patient Mode" and "Research Lab" —
 * so the active mode is never communicated by colour or icon alone.
 */
const OPTIONS = [
  {
    id: MODE_PATIENT,
    label: 'Patient Mode',
    shortLabel: 'Patient',
    icon: HeartPulse,
    hint: 'Patient Mode — a simple view of the assessment and its result.',
  },
  {
    id: MODE_RESEARCH,
    label: 'Research Lab',
    shortLabel: 'Research',
    icon: FlaskConical,
    hint: 'Research Lab — the full technical workspace: dataset, metrics, explainability.',
  },
];

/**
 * Global mode switcher.
 *
 * A segmented control built on a two-column grid:
 *
 *  - Both segments are exactly the same width, so the active indicator and
 *    the labels sit on the same optical grid whichever mode is selected.
 *  - The indicator is one half of the track, inset by 3 px on each side, and
 *    slides to the other half with a transform. Because the geometry is
 *    derived from the grid rather than from a hand-tuned pixel value, the
 *    indicator lands exactly on the second segment at any width.
 *  - The control is a single row of a fixed height, so it aligns with the
 *    brand and the status badge beside it instead of sitting on a second
 *    line of helper copy.
 *
 * The control changes the interface only. It never changes the model, the
 * dataset or the prediction logic — the description says so explicitly and
 * is attached to the group for assistive technology.
 */
export default function ModeSwitcher({ compact = false, fluid = false, onNavigate }) {
  const { mode, pendingMode, transitioning, requestMode } = useMode();
  const groupRef = useRef(null);
  const descriptionId = useId();

  // The pending mode is what the control shows while a switch is in flight:
  // the visitor's intent is registered immediately.
  const active = pendingMode || mode;

  const select = useCallback((next) => {
    if (next === mode) return;
    const accepted = requestMode(next);
    if (accepted && onNavigate) onNavigate(next);
  }, [mode, onNavigate, requestMode]);

  // Standard radiogroup keyboard behaviour: arrows move and select.
  const onKeyDown = useCallback((event) => {
    const keys = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    const index = OPTIONS.findIndex((option) => option.id === mode);
    let nextIndex = index;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      nextIndex = (index + 1) % OPTIONS.length;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      nextIndex = (index - 1 + OPTIONS.length) % OPTIONS.length;
    } else if (event.key === 'Home') {
      nextIndex = 0;
    } else if (event.key === 'End') {
      nextIndex = OPTIONS.length - 1;
    }

    const target = OPTIONS[nextIndex];
    select(target.id);
    const buttons = groupRef.current?.querySelectorAll('[role="radio"]');
    buttons?.[nextIndex]?.focus();
  }, [mode, select]);

  const isResearch = active === MODE_RESEARCH;

  return (
    <div className={fluid ? 'w-full' : 'w-auto'}>
      {/* The track holds the two equal segments. The indicator is one half of
          it — exactly, because it is measured against the same box the grid
          columns are laid out in — so it lands on the second segment at any
          width without hand-tuned pixel values. */}
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="Interface mode"
        aria-describedby={descriptionId}
        onKeyDown={onKeyDown}
        title={OPTIONS.find((option) => option.id === active)?.hint}
        className={[
          'rounded-xl border border-border bg-surface-soft p-[3px]',
          'w-full',
        ].join(' ')}
      >
        <div className="relative isolate grid grid-cols-2 w-full">
          {/* The sliding indicator: exactly one half of the track. */}
          <span
            aria-hidden="true"
            className={[
              'absolute inset-y-0 left-0 w-1/2 rounded-lg',
              'bg-primary shadow-sm shadow-primary/25',
              'transition-transform duration-300 ease-out motion-reduce:transition-none',
              isResearch ? 'translate-x-full' : 'translate-x-0',
            ].join(' ')}
          />

          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = active === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={isActive}
                aria-label={option.label}
                disabled={transitioning}
                tabIndex={isActive ? 0 : -1}
                onClick={() => select(option.id)}
                className={[
                  'relative z-10 inline-flex items-center justify-center gap-1.5',
                  'rounded-lg leading-none whitespace-nowrap font-semibold',
                  'transition-colors duration-200 motion-reduce:transition-none',
                  'disabled:cursor-not-allowed disabled:opacity-60',
                  compact ? 'h-7 px-2 text-[11px]' : 'h-8 px-3 text-xs',
                  isActive
                    ? 'text-primary-contrast'
                    : 'text-secondary hover:text-primary',
                ].join(' ')}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="truncate">{compact ? option.shortLabel : option.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Explains what the control does, for assistive technology. The
          visible equivalent is the tooltip on the group. */}
      <span id={descriptionId} className="sr-only">
        Switches the interface only. The model, the dataset and the prediction
        result are unchanged.
      </span>
    </div>
  );
}

export { OPTIONS as MODE_OPTIONS };
