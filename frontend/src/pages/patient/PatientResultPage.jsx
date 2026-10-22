import { Link } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import PatientResult from '../../components/patient/PatientResult';
import { useAssessment } from '../../app/AssessmentProvider';

/**
 * Patient Mode result page.
 *
 * It renders the stored response for the stored payload. It never issues a
 * prediction request of its own, and it never shows a stale or invented
 * result: with no completed assessment in the store it shows an empty state
 * that offers to start one.
 */
export default function PatientResultPage() {
  const { result, submittedPayload } = useAssessment();

  if (!result || !result.prediction) {
    return (
      <div className="rounded-2xl border border-border bg-surface shadow-sm p-8 sm:p-12 text-center">
        <span className="mx-auto w-12 h-12 rounded-2xl bg-primary-soft text-primary-muted flex items-center justify-center">
          <ClipboardList className="w-6 h-6" aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-primary">
          No result to show yet
        </h1>
        <p className="mt-2 text-sm text-secondary max-w-md mx-auto leading-relaxed">
          Complete an assessment and the result will appear here. Results are kept only for this
          browser session — nothing is saved to an account or a server.
        </p>
        <Link
          to="/assessment"
          className="mt-6 inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-contrast font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-primary/20 transition"
        >
          Start an assessment
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <span className="text-[11px] font-mono text-muted uppercase tracking-wider">Patient Mode · Result</span>
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">Your assessment result</h1>
      </header>

      <PatientResult result={result} submittedPayload={submittedPayload} />
    </div>
  );
}
