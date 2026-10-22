import { useId, useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Expandable explanation.
 *
 * Uses a real button with `aria-expanded` and `aria-controls` so the state is
 * exposed to assistive technology. The panel is unmounted when collapsed, so
 * its content is not read out by a screen reader until the user opens it.
 */
export default function ExpandableExplanation({ summary, children, defaultOpen = false, className = '' }) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  const panelId = `${id}-panel`;

  return (
    <div className={`rounded-xl border border-border bg-surface overflow-hidden ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={panelId}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-soft transition"
      >
        <span className="text-sm font-semibold text-primary">{summary}</span>
        <ChevronDown
          className={`w-4 h-4 text-muted shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open && (
        <div id={panelId} className="px-4 pb-4 pt-1 text-sm text-secondary leading-relaxed">
          {children}
        </div>
      )}
    </div>
  );
}
