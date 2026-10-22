import { useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCcw } from 'lucide-react';
import PredictionResults from '../components/PredictionResults';
import { PageShell, LoadingState, EmptyState } from '../components/ui/states';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAssessment } from '../app/AssessmentProvider';

/**
 * Research Lab result view.
 *
 * It renders the response stored by the shared assessment store — the same
 * object the Patient Mode result page renders. Router state is accepted as a
 * fallback so a result handed over by navigation still displays.
 *
 * It never issues a prediction request of its own.
 */
export default function PredictionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { result: storedResult, submittedPayload } = useAssessment();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Prefer the shared store; fall back to router state for a hand-over.
    const state = location.state || {};
    if (storedResult) {
      setData({ ...storedResult, _submittedInput: submittedPayload || state.payload });
      setLoading(false);
      return;
    }
    if (state.result) {
      setData({ ...state.result, _submittedInput: state.payload });
      setLoading(false);
      return;
    }
    // Direct navigation without a prior result — show empty state
    setData(null);
    setLoading(false);
  }, [location, storedResult, submittedPayload]);

  const startNewAssessment = () => {
    navigate('/assessment');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageShell
        title="Prediction analysis"
        subtitle="View the real model response for your submitted assessment."
        breadcrumb="Research Lab · Prediction Results"
      />

      {/* Empty state: no result available (direct navigation) */}
      {!loading && !error && !data && (
        <EmptyState
          title="No prediction to display"
          subtitle="Submit an assessment first to see prediction results."
          action={{
            props: {
              children: 'Start a new assessment',
              onClick: startNewAssessment,
            },
          }}
        />
      )}

      {/* Loading state */}
      {loading && !data && (
        <LoadingState message="Loading prediction result…" />
      )}

      {/* Error state */}
      {error && !loading && !data && (
        <div className="max-w-5xl mx-auto py-12">
          <div className="rounded-xl border border-error/20 bg-error-bg p-5 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="w-5 h-5 rounded-full bg-error flex items-center justify-center shrink-0">
                <span className="text-[14px]">💥</span>
              </div>
              <div>
                <div className="font-bold text-error">Prediction unavailable</div>
                <div className="text-xs text-secondary mt-1">{error}</div>
              </div>
            </div>
              <button
                onClick={startNewAssessment}
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary-contrast bg-primary hover:bg-primary-hover px-3 py-1.5 rounded-lg"
              >
              <ArrowUpRight className="w-3 h-3" aria-hidden="true" /> Start new assessment
            </button>
          </div>
        </div>
      )}

      {/* Result: show actual submitted assessment result */}
      {!loading && data && <PredictionResults result={data} />}
    </div>
  );
}
