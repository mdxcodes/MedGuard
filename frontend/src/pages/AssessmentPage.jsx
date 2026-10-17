import { useState } from 'react';
import { ArrowRight, RotateCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import AssessmentForm from '../components/AssessmentForm';
import SyntheticExamples from '../components/SyntheticExamples';

export default function AssessmentPage() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (payload) => {
    setSubmitting(true); setDone(false); setError(null);
    try {
      const r = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const body = await r.json();
      if (!r.ok && !body.error) throw new Error('Unexpected response');
      if (body.error) { setError(body.error.detail || body.error); setSubmitting(false); return; }
      window.location.href = '/prediction?from=assessment'; // pass result via state if needed
    } catch (e) {
      setError('Connection failed — ensure the FastAPI backend is running on port 8000.');
    } finally { setSubmitting(false); setDone(true); }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tighter text-navy">Patient Assessment</h1>
        <p className="text-sm text-text-secondary mt-1">Synthetic triage assessment for the MedGuard research prototype. All inputs are fictional.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <div>
            <div className="font-bold">Request failed</div>
            <div className="text-xs mt-0.5 text-rose-700">{error}</div>
          </div>
        </div>
      )}

      <AssessmentForm onSubmit={handleSubmit} isSubmitting={submitting} result={done ? {} : null} />
    </div>
  );
}
