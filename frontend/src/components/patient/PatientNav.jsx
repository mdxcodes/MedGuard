import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Waves, Menu, X, PhoneCall } from 'lucide-react';
import ModeSwitcher from '../mode-switcher/ModeSwitcher';
import useMediaQuery from '../../hooks/useMediaQuery';

/**
 * Patient Mode navigation.
 *
 * Four destinations only. There is deliberately no "history" entry: the
 * application keeps assessment data in memory for the current tab and does
 * not persist it, so a history list would be a fabrication.
 */
export const PATIENT_NAV = [
  { to: '/', label: 'Home', end: true },
  { to: '/assessment', label: 'New Assessment' },
  { to: '/result', label: 'My Result' },
  { to: '/about', label: 'About' },
];

export default function PatientNav() {
  const [open, setOpen] = useState(false);
  const isWide = useMediaQuery('(min-width: 640px)');
  const linkClass = ({ isActive }) =>
    [
      'px-3 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap',
      isActive
        ? 'bg-primary text-primary-contrast shadow-sm shadow-primary/20'
        : 'text-secondary hover:text-primary-contrast hover:bg-surface-soft',
    ].join(' ');

  return (
    <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
        <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-soft flex items-center justify-center shadow-md shadow-primary/20">
            <Waves className="w-4.5 h-4.5 text-primary" aria-hidden="true" />
          </div>
          <div className="leading-none">
            <div className="text-[15px] font-extrabold tracking-tight text-primary">MedGuard</div>
            <div className="text-[9px] font-mono text-muted tracking-widest uppercase mt-0.5">Triage One</div>
          </div>
        </Link>

        {/* Desktop navigation */}
        <nav aria-label="Patient navigation" className="hidden md:flex items-center gap-1">
          {PATIENT_NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* The mode switcher is always present in the header. On narrow
            screens it collapses to a compact control rather than moving into
            the menu, so it stays discoverable — and only one instance is ever
            rendered. */}
        <div className="shrink-0">
          <ModeSwitcher compact={!isWide} />
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="md:hidden p-2 -ml-2 rounded-lg hover:bg-surface-soft transition text-secondary shrink-0"
          aria-label={open ? 'Close navigation' : 'Open navigation'}
          aria-expanded={open}
        >
          {open ? <X className="w-5 h-5" aria-hidden="true" /> : <Menu className="w-5 h-5" aria-hidden="true" />}
        </button>
      </div>

      {/* Mobile navigation */}
      {open && (
        <div className="md:hidden border-t border-border bg-surface px-4 py-4 space-y-4">
          <nav aria-label="Patient navigation (mobile)" className="flex flex-col gap-1">
            {PATIENT_NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={() => setOpen(false)}
                className={({ isActive }) =>
                  [
                    'px-3 py-2.5 rounded-lg text-sm font-medium transition',
                    isActive ? 'bg-primary text-primary-contrast' : 'text-secondary hover:text-primary-contrast hover:bg-surface-soft',
                  ].join(' ')
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}

/**
 * Emergency guidance strip.
 *
 * Deliberately generic: it does not tell the reader that they are safe, and
 * it does not make any claim about the model's output. It only points to
 * emergency services.
 */
export function EmergencyNotice() {
  return (
    <div className="rounded-xl border border-error/20 bg-error-bg/60 p-4 flex items-start gap-3">
      <PhoneCall className="w-5 h-5 text-error shrink-0 mt-0.5" aria-hidden="true" />
      <div className="text-sm text-secondary leading-relaxed">
        <strong className="text-error">If this may be a medical emergency, seek emergency help now.</strong>{' '}
        Contact your local emergency number. MedGuard cannot assess whether a situation is safe
        to wait, and this result is not a clinical judgement.
      </div>
    </div>
  );
}
