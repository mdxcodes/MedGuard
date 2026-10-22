import { Check } from 'lucide-react';

/**
 * Progress indicator for a multi-step flow.
 *
 * Implemented as an ordered list so the step order is announced correctly.
 * The current step carries `aria-current="step"`, and completed steps are
 * marked with a check plus text — never colour alone.
 */
export default function ProgressSteps({ steps, currentIndex, onSelectStep, className = '' }) {
  return (
    <nav aria-label="Progress" className={className}>
      <ol className="flex items-center gap-1 sm:gap-2">
        {steps.map((step, index) => {
          const isCurrent = index === currentIndex;
          const isDone = index < currentIndex;
          const isPast = index > currentIndex;
          const interactive = Boolean(onSelectStep) && index <= currentIndex;

          return (
            <li key={step.id} className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => interactive && onSelectStep(index)}
                disabled={!interactive}
                aria-current={isCurrent ? 'step' : undefined}
                className={[
                  'flex items-center gap-2 rounded-lg px-1.5 py-1 transition min-w-0',
                  interactive ? 'cursor-pointer hover:bg-surface-lift' : 'cursor-default',
                ].join(' ')}
              >
                <span
                  className={[
                    'shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold transition-colors',
                    isCurrent
                      ? 'bg-primary text-primary-contrast shadow-sm shadow-primary/25'
                      : isDone
                        ? 'bg-primary text-primary-contrast'
                        : 'bg-surface-lift text-muted',
                  ].join(' ')}
                >
                  {isDone ? <Check className="w-3.5 h-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <span className="min-w-0">
                  <span
                    className={[
                      'block text-[11px] font-semibold truncate',
                      isCurrent ? 'text-primary' : isDone ? 'text-secondary' : 'text-muted',
                    ].join(' ')}
                  >
                    {step.label}
                  </span>
                  {isDone && <span className="sr-only">completed</span>}
                  {isCurrent && <span className="sr-only">current step</span>}
                </span>
              </button>
              {index < steps.length - 1 && (
                <span
                  aria-hidden="true"
                  className={[
                    'hidden sm:block h-px flex-1 min-w-[8px] rounded-full',
                    isDone ? 'bg-primary/40' : 'bg-border',
                  ].join(' ')}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
