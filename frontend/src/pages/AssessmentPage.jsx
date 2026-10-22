import { useState } from 'react';
import { ArrowRight, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import AssessmentForm from '../components/AssessmentForm';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { PageShell } from '../components/ui/states';
import { useNavigate } from 'react-router-dom';
import { useAssessment } from '../app/AssessmentProvider';
import { submitAssessment, toApiPayload } from '../lib/assessment';

/**
 * Research Lab assessment.
 *
 * It submits through the same shared prediction service as the Patient Mode
 * wizard, and records the response in the same shared store, so a result
 * produced here is viewable in either mode.
 */
export default function AssessmentPage() {
  const navigate = useNavigate();
  const { values, updateValue, updateMany, recordResult, setError, setSubmitting } = useAssessment();
  const [submitting, setSubmittingState] = useState(false);
  const [error, setErrorState] = useState(null);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setSubmittingState(true);
    setErrorState(null);
    setError(null);

    const response = await submitAssessment(payload);

    if (!response.ok) {
      const message =
        response.error?.message ||
        'Request failed — ensure the FastAPI backend is running on port 8000.';
      setErrorState(message);
      setError(message);
      setSubmitting(false);
      setSubmittingState(false);
      return;
    }

    // Keep the entered values in the shared store so a mode switch does not
    // discard them, and record the response against the exact payload.
    updateMany(values);
    recordResult(toApiPayload(payload), response.data);
    setSubmitting(false);
    setSubmittingState(false);
    navigate('/result');
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageShell
        title="New assessment"
        subtitle="Enter synthetic triage vitals to see how the model reasons. All inputs are fictional — no real patient data is used."
        breadcrumb="Research Lab · Assessment"
      />

      {error && (
        <div className="rounded-xl border border-error/20 bg-error-bg p-5" role="alert">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
              <div className="font-bold text-error">Request failed</div>
              <div className="text-xs text-secondary mt-1">{error}</div>
            </div>
          </div>
          <button
            onClick={() => setErrorState(null)}
            className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline font-mono"
          >
            Dismiss <span className="text-[10px]">×</span>
          </button>
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="p-6 border-b border-border">
          <AssessmentForm
            onSubmit={handleSubmit}
            isSubmitting={submitting}
            initialValues={values}
            onChange={updateValue}
            result={null}
          />
        </div>
      </section>
    </div>
  );
}
