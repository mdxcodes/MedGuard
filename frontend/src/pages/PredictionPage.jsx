import { useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCcw } from 'lucide-react';
import PredictionResults from '../components/PredictionResults';
import { PageShell, LoadingState } from '../components/ui/states';

export default function PredictionPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadDemo();
  }, []);

  const loadDemo = () => {
    setLoading(true);
    fetch('/api/predict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ temperature: 98.6, heartrate: 88, resprate: 16, o2sat: 98, sbp: 120, dbp: 80, pain: 3, arrival_transport: 'AMBULANCE', chiefcomplaint: 'CHEST PAIN' })
    })
      .then(r => r.json())
      .then(body => { setData(body); setLoading(false); })
      .catch(() => { setError('Failed to load real model response'); setLoading(false); });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <PageShell
        title="Prediction analysis"
        subtitle="Actual backend response from POST /predict using the saved Random Forest pipeline."
        breadcrumb="Workspace · Prediction Results"
      />

      {loading && <LoadingState message="Loading real prediction from /api/predict…" />}
      {error && !loading && (
        <div className="rounded-xl border border-error/20 bg-error-bg p-5">
          <div className="flex items-start gap-3">
            <div className="w-5 h-5 rounded-full bg-error flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-[14px]">💥</span>
            </div>
            <div className="flex-1">
              <div className="font-bold text-error">Prediction unavailable</div>
              <div className="text-xs text-secondary mt-1">{error}</div>
            </div>
          </div>
          <button onClick={loadDemo} className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-primary hover:underline font-mono">
            <RefreshCcw className="w-3 h-3" /> Retry with synthetic data
          </button>
        </div>
      )}
      {!loading && !error && data && <PredictionResults result={data} />}
    </div>
  );
}
