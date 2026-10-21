import { useState } from 'react';
import { ArrowRight, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import AssessmentForm from '../components/AssessmentForm';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { PageShell } from '../components/ui/states';
import { apiFetch } from '../lib/api';
import { useNavigate } from 'react-router-dom';

export default function AssessmentPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (payload) => {
    setSubmitting(true); setError(null);
    try {
      const result = await apiFetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!result.ok) {
        setError(result.error?.message || 'Request failed');
        setSubmitting(false);
        return;
      }
      navigate('/prediction', { state: { payload, result: result.data } });
    } catch (e) {
      setError('Connection failed — ensure the FastAPI backend is running on port 8000.');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageShell
        title="New assessment"
        subtitle="Enter synthetic triage vitals to see how the model reasons. All inputs are fictional — no real patient data is used."
        breadcrumb="Workspace · Assessment"
      />

      {error && (
        <div className="rounded-xl border border-error/20 bg-error-bg p-5">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="font-bold text-error">Request failed</div>
              <div className="text-xs text-secondary mt-1">{error}</div>
            </div>
          </div>
          <button
            onClick={() => setError(null)}
            className="mt-3 inline-flex items-center gap-1 text-[10px] font-medium text-primary hover:underline font-mono"
          >
            Dismiss <span className="text-[10px]">×</span>
          </button>
        </div>
      )}

      <section className="rounded-xl border border-border bg-surface shadow-sm">
        <div className="p-6 border-b border-border">
          <AssessmentForm onSubmit={handleSubmit} isSubmitting={submitting} result={null} />
        </div>
      </section>
    </div>
  );
}
