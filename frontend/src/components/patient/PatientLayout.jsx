import { Waves } from 'lucide-react';
import PatientNav from './PatientNav';

/**
 * Patient Mode shell.
 *
 * A deliberately different shape from the Research Lab: no sidebar, a single
 * narrow column, a calm top navigation, and the same design tokens re-pointed
 * to a warm dark palette by the `mg-patient` scope.
 *
 * The shell is presentational. It never changes the model, the dataset or the
 * prediction request.
 */
export default function PatientLayout({ children, mainRef }) {
  return (
    <div className="mg-patient min-h-screen bg-page flex flex-col">
      <PatientNav />

      <main
        ref={mainRef}
        role="main"
        tabIndex={-1}
        className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12"
      >
        {children}
      </main>

      <PatientFooter />
    </div>
  );
}

function PatientFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex flex-col sm:flex-row gap-6 sm:items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary-soft flex items-center justify-center">
              <Waves className="w-4 h-4 text-primary" aria-hidden="true" />
            </div>
            <div className="leading-none">
              <div className="text-sm font-extrabold tracking-tight text-primary">MedGuard</div>
              <div className="text-[9px] font-mono text-muted tracking-widest uppercase mt-0.5">Triage One</div>
            </div>
          </div>
          <div className="text-sm text-secondary leading-relaxed max-w-xl">
            <p>
              MedGuard is a <strong className="text-primary">research prototype</strong>. It uses a
              model trained entirely on synthetic data and has not been validated for clinical use.
              It does not diagnose, does not replace professional medical care, and must not be used
              to decide whether someone can wait or stay home.
            </p>
            <p className="text-xs text-muted mt-3">
              If someone may be experiencing a medical emergency, contact your local emergency
              number.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
