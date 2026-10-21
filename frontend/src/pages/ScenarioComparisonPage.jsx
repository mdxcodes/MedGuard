import { useState } from 'react';
import { GitCompare, AlertCircle, CheckCircle2, RefreshCcw } from 'lucide-react';
import AssessmentForm from '../components/AssessmentForm';
import PredictionResults from '../components/PredictionResults';
import DisclaimerBanner from '../components/DisclaimerBanner';
import { apiFetch } from '../lib/api';
import { PageShell, SectionCard } from '../components/ui/states';

function ComparisonPanel({ title, onSubmit, result, isSubmitting, error, onClear, payload }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-lift border border-border text-primary font-bold">
            {title === 'Scenario A' ? 'A' : 'B'}
          </div>
          <h3 className="font-bold text-primary">{title}</h3>
        </div>
        {payload && (
          <button onClick={onClear} className="text-[10px] font-medium text-secondary hover:text-primary px-3 py-1.5 rounded-lg hover:bg-surface-lift transition border border-border">
            Clear scenario
          </button>
        )}
      </div>
      {!result ? (
        <AssessmentForm onSubmit={onSubmit} isSubmitting={isSubmitting} />
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="rounded-xl border border-error/20 bg-error-bg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="font-bold text-error">Request failed</div>
                  <div className="text-xs text-secondary mt-1">{error}</div>
                </div>
              </div>
            </div>
          )}
          <PredictionResults result={result} />
          <button onClick={onClear} className="inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-primary px-4 py-3 rounded-xl hover:bg-surface-lift transition border border-border">
            <RefreshCcw className="w-4 h-4" /> Edit scenario
          </button>
        </div>
      )}
    </div>
  );
}

function DiffSummary({ resultA, resultB }) {
  if (!resultA || !resultB) return null;

  const predA = resultA.prediction?.predicted_esi_level;
  const predB = resultB.prediction?.predicted_esi_level;
  const probsA = resultA.prediction?.probabilities || [];
  const probsB = resultB.prediction?.probabilities || [];
  const maxA = Math.max(...probsA.map(p => p.probability || 0), 0);
  const maxB = Math.max(...probsB.map(p => p.probability || 0), 0);
  const samePred = predA === predB;
  const diffMax = Math.abs(maxA - maxB);

  return (
    <SectionCard title="Comparison summary" badge="Model behavior · not causation" icon={<GitCompare className="w-4 h-4" />}>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Scenario A</div>
          <div className="text-2xl font-extrabold text-primary">ESI {predA ?? '—'}</div>
          <div className="text-[10px] font-mono text-muted mt-1">Max prob {(maxA * 100).toFixed(0)}%</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Scenario B</div>
          <div className="text-2xl font-extrabold text-primary">ESI {predB ?? '—'}</div>
          <div className="text-[10px] font-mono text-muted mt-1">Max prob {(maxB * 100).toFixed(0)}%</div>
        </div>
        <div className="rounded-xl border border-border bg-surface p-4 flex flex-col justify-center">
          <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">Agreement</div>
          <div className="flex items-center gap-2 mb-2">
            {samePred ? (
              <CheckCircle2 className="w-4 h-4 text-primary" />
            ) : (
              <AlertCircle className="w-4 h-4 text-warning" />
            )}
            <span className="font-medium text-primary">{samePred ? 'Same predicted class' : 'Different classes'}</span>
          </div>
          <div className="text-[10px] font-mono text-muted">Max prob diff {diffMax * 100}%</div>
        </div>
      </div>
      <div className="rounded-lg border border-border/50 bg-surface-lift p-3 text-xs text-secondary leading-relaxed mt-2">
        These differences illustrate model behavior under varying inputs — not medical causation. The model is a research prototype and not clinically validated. Both scenarios are synthetic.
      </div>
    </SectionCard>
  );
}

export default function ScenarioComparisonPage() {
  const [payloadA, setPayloadA] = useState(null);
  const [payloadB, setPayloadB] = useState(null);
  const [resultA, setResultA] = useState(null);
  const [resultB, setResultB] = useState(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [errorA, setErrorA] = useState(null);
  const [errorB, setErrorB] = useState(null);

  const submitScenario = async (payload, setLoadingFn, setResultFn, setErrorFn) => {
    setLoadingFn(true); setErrorFn(null);
    try {
      const result = await apiFetch('/api/predict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
      if (!result.ok) {
        setErrorFn(result.error?.message || 'Request failed');
        setResultFn(null);
        return;
      }
      setResultFn(result.data);
    } catch (e) {
      setErrorFn('Connection failed — ensure the FastAPI backend is running on port 8000.');
      setResultFn(null);
    } finally { setLoadingFn(false); }
  };

  const handleSubmitA = (p) => { setPayloadA(p); submitScenario(p, setLoadingA, setResultA, setErrorA); };
  const handleSubmitB = (p) => { setPayloadB(p); submitScenario(p, setLoadingB, setResultB, setErrorB); };
  const handleClearA = () => { setPayloadA(null); setResultA(null); setErrorA(null); };
  const handleClearB = () => { setPayloadB(null); setResultB(null); setErrorB(null); };
  const handleRerun = () => { if (payloadA) submitScenario(payloadA, setLoadingA, setResultA, setErrorA); if (payloadB) submitScenario(payloadB, setLoadingB, setResultB, setErrorB); };

  return (
    <div className="space-y-8">
      <PageShell
        title="Scenario comparison"
        subtitle="Compare two synthetic patient assessments side by side using the real MedGuard inference API. Differences illustrate model behavior — not medical causation."
        breadcrumb="Advanced Analysis · Scenario Comparison"
      />

      <DiffSummary resultA={resultA} resultB={resultB} />

      <div className="grid lg:grid-cols-2 gap-6">
        <ComparisonPanel title="Scenario A" onSubmit={handleSubmitA} result={resultA} isSubmitting={loadingA} error={errorA} onClear={handleClearA} payload={payloadA} />
        <ComparisonPanel title="Scenario B" onSubmit={handleSubmitB} result={resultB} isSubmitting={loadingB} error={errorB} onClear={handleClearB} payload={payloadB} />
      </div>

      <div className="rounded-lg border border-border/50 bg-surface-lift p-4 text-[11px] font-mono text-muted leading-relaxed">
        Each scenario is submitted independently to POST /api/predict. Predictions, class probabilities, and SHAP attributions (when available) come directly from the saved model pipeline.
      </div>
    </div>
  );
}
