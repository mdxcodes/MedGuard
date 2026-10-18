import { useState, useRef } from 'react';
import { BarChart3, ArrowRight, RefreshCcw, GitCompare, AlertCircle, CheckCircle2 } from 'lucide-react';
import AssessmentForm from '../components/AssessmentForm';
import PredictionResults from '../components/PredictionResults';
import SyntheticExamples from '../components/SyntheticExamples';
import DisclaimerBanner from '../components/DisclaimerBanner';

const INITIAL = { temperature: '', heartrate: '', resprate: '', o2sat: '', sbp: '', dbp: '', pain: '', arrival_transport: '', chiefcomplaint: '' };

function ComparisonPanel({ title, onSubmit, result, isSubmitting, error, onClear, payload }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-navy tracking-tight">{title}</h2>
        {payload && (
          <button
            onClick={onClear}
            className="text-xs font-medium text-text-secondary hover:text-navy px-2 py-1 rounded-lg hover:bg-slate-50 transition border border-border-subtle"
          >
            Clear
          </button>
        )}
      </div>
      {!result ? (
        <AssessmentForm
          onSubmit={onSubmit}
          isSubmitting={isSubmitting}
          result={null}
        />
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <div>
                <div className="font-bold">Request failed</div>
                <div className="text-xs mt-0.5 text-rose-700">{error}</div>
              </div>
            </div>
          )}
          <PredictionResults result={result} />
          <button
            onClick={onClear}
            className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-navy px-4 py-2 rounded-xl border border-border-subtle hover:bg-slate-50 transition"
          >
            <RefreshCcw className="w-4 h-4" />
            Edit scenario
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
    <div className="bg-white rounded-2xl border border-border shadow-card p-5">
      <div className="flex items-center gap-2 mb-3">
        <GitCompare className="w-5 h-5 text-teal" />
        <h3 className="font-bold text-navy tracking-tight">Comparison Summary</h3>
      </div>
      <div className="grid sm:grid-cols-3 gap-3 text-sm">
        <div className="p-3 rounded-xl bg-slate-50 border border-border-subtle">
          <div className="text-xs font-mono text-text-muted uppercase tracking-wider">Prediction A</div>
          <div className="text-2xl font-extrabold text-navy mt-1">ESI {predA ?? '—'}</div>
          <div className="text-xs text-text-muted mt-0.5">Max prob {(maxA * 100).toFixed(0)}%</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-border-subtle">
          <div className="text-xs font-mono text-text-muted uppercase tracking-wider">Prediction B</div>
          <div className="text-2xl font-extrabold text-navy mt-1">ESI {predB ?? '—'}</div>
          <div className="text-xs text-text-muted mt-0.5">Max prob {(maxB * 100).toFixed(0)}%</div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-border-subtle flex flex-col justify-center">
          <div className="text-xs font-mono text-text-muted uppercase tracking-wider">Agreement</div>
          <div className="flex items-center gap-2 mt-1">
            {samePred ? (
              <CheckCircle2 className="w-5 h-5 text-teal" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600" />
            )}
            <span className="text-sm font-semibold text-navy">
              {samePred ? 'Same predicted class' : 'Different predicted classes'}
            </span>
          </div>
          <div className="text-xs text-text-muted mt-0.5">
            Max prob diff {(diffMax * 100).toFixed(1)}%
          </div>
        </div>
      </div>
      <div className="mt-3 text-xs text-text-muted leading-relaxed bg-slate-50 rounded-lg p-3 border border-border-subtle">
        <strong>Important:</strong> These differences illustrate model behavior under varying inputs, not medical
        causation. The model is a research prototype and not clinically validated. Both scenarios are synthetic.
      </div>
    </div>
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

  const submitScenario = async (payload, setLoading, setResult, setError) => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const body = await r.json();
      if (body.error) {
        setError(body.error.detail || body.error);
        setResult(null);
        return;
      }
      setResult(body);
    } catch (e) {
      setError('Connection failed — ensure the FastAPI backend is running on port 8000.');
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitA = (payload) => {
    setPayloadA(payload);
    submitScenario(payload, setLoadingA, setResultA, setErrorA);
  };

  const handleSubmitB = (payload) => {
    setPayloadB(payload);
    submitScenario(payload, setLoadingB, setResultB, setErrorB);
  };

  const handleClearA = () => {
    setPayloadA(null);
    setResultA(null);
    setErrorA(null);
  };

  const handleClearB = () => {
    setPayloadB(null);
    setResultB(null);
    setErrorB(null);
  };

  const handleRerun = () => {
    if (payloadA) submitScenario(payloadA, setLoadingA, setResultA, setErrorA);
    if (payloadB) submitScenario(payloadB, setLoadingB, setResultB, setErrorB);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <DisclaimerBanner />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter text-navy flex items-center gap-2">
            <GitCompare className="w-7 h-7 text-teal" />
            Scenario Comparison
          </h1>
          <p className="text-sm text-text-secondary mt-1 leading-relaxed max-w-2xl">
            Compare two synthetic patient assessments side by side using the real MedGuard inference API. Both
            scenarios remain local and are never stored. Differences illustrate model behavior, not medical causation.
          </p>
        </div>
        {(resultA || resultB) && (
          <button
            onClick={handleRerun}
            disabled={loadingA || loadingB}
            className="inline-flex items-center gap-2 text-sm font-medium bg-teal hover:bg-teal/90 text-white px-4 py-2.5 rounded-xl shadow-lg shadow-teal/20 transition disabled:opacity-50"
          >
            <RefreshCcw className="w-4 h-4" />
            Rerun comparison
          </button>
        )}
      </div>

      <DiffSummary resultA={resultA} resultB={resultB} />

      <div className="grid lg:grid-cols-2 gap-6">
        <ComparisonPanel
          title="Scenario A"
          onSubmit={handleSubmitA}
          result={resultA}
          isSubmitting={loadingA}
          error={errorA}
          onClear={handleClearA}
          payload={payloadA}
        />
        <ComparisonPanel
          title="Scenario B"
          onSubmit={handleSubmitB}
          result={resultB}
          isSubmitting={loadingB}
          error={errorB}
          onClear={handleClearB}
          payload={payloadB}
        />
      </div>

      <div className="rounded-2xl bg-slate-50 border border-border-subtle p-4 text-xs text-text-muted leading-relaxed">
        <strong>Methodology note:</strong> Each scenario is submitted independently to <code>POST /api/predict</code>.
        Predictions, class probabilities, and SHAP attributions (when available) come directly from the saved model
        pipeline. Explanation availability depends on the specific input and runtime conditions.
      </div>
    </div>
  );
}
