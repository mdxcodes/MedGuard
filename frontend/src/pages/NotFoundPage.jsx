import { Link, useLocation } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useMode } from '../app/ModeProvider';
import { MODE_PATIENT, MODE_RESEARCH } from '../lib/modeStorage';

/**
 * Not-found state.
 *
 * It offers the home page of whichever mode is active, so a visitor who
 * mistypes a research URL is not pushed into the patient experience and vice
 * versa.
 */
export default function NotFoundPage() {
  const location = useLocation();
  const { mode, requestMode } = useMode();
  const isResearch = mode === MODE_RESEARCH;

  return (
    <div className="rounded-2xl border border-border bg-surface shadow-sm p-8 sm:p-12 text-center">
      <span className="mx-auto w-12 h-12 rounded-2xl bg-primary-soft text-primary-muted flex items-center justify-center">
        <Compass className="w-6 h-6" aria-hidden="true" />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-primary">
        That page does not exist
      </h1>
      <p className="mt-2 text-sm text-secondary max-w-md mx-auto leading-relaxed">
        <code className="font-mono text-xs">{location.pathname}</code> is not a page in this
        interface. It may have been renamed, or it may belong to the other mode.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Link
          to="/"
          className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-contrast font-semibold text-sm px-5 py-3 rounded-xl shadow-md shadow-primary/15 transition"
        >
          {isResearch ? 'Back to the research overview' : 'Back to home'}
        </Link>
        {isResearch && (
          <button
            type="button"
            onClick={() => requestMode(MODE_PATIENT)}
            className="inline-flex items-center gap-2 font-semibold text-sm text-secondary hover:text-primary px-5 py-3 rounded-xl border border-border hover:bg-surface-soft transition"
          >
            Switch to Patient Mode
          </button>
        )}
      </div>
    </div>
  );
}
