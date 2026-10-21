import { useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCcw } from 'lucide-react';
import PredictionResults from '../components/PredictionResults';
import { PageShell, LoadingState, EmptyState } from '../components/ui/states';
import { useLocation, useNavigate } from 'react-router-dom';

export default function PredictionPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Use the submitted assessment result passed from AssessmentPage via router state
    const state = location.state || {};
    if (state.result) {
      setData({ ...state.result, _submittedInput: state.payload });
      return;
    }
    // Direct navigation without a prior result — show empty state
    setData(null);
    setLoading(false);
  }, [location]);

  const startNewAssessment = () => {
    navigate('/assessment');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageShell
        title="Prediction analysis"
        subtitle="View the real model response for your submitted assessment."
        breadcrumb="Workspace · Prediction Results"
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
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline font-mono"
            >
              <ArrowUpRight className="w-3 h-3" /> Start new assessment
            </button>
          </div>
        </div>
      )}

      {/* Result: show actual submitted assessment result */}
      {!loading && data && <PredictionResults result={data} />}
    </div>
  );
}
