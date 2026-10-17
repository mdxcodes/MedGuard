import { useEffect, useState } from 'react';
import { ArrowUpRight, RefreshCcw } from 'lucide-react';
import PredictionResults from '../components/PredictionResults';

export default function PredictionPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If coming from assessment with result in session/state, use it
    const from = new URLSearchParams(window.location.search).get('from');
    if (from === 'assessment') {
      // For demo purposes, load a synthetic demo result; in production this would come from state
      loadDemo();
    } else {
      loadDemo();
    }
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

  if (loading) return <div className="max-w-5xl mx-auto pt-10 text-center"><div className="text-sm text-text-muted font-mono animate-pulse">Loading real prediction from /api/predict...</div></div>;
  if (error) return (
    <div className="max-w-5xl mx-auto pt-10">
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-rose-800">{error}</div>
      <button onClick={loadDemo} className="mt-4 text-sm font-medium text-teal hover:underline">Retry with synthetic data</button>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tighter text-navy">Prediction Analysis</h1>
          <p className="text-sm text-text-secondary mt-1">Actual backend response from <code className="text-xs font-mono bg-slate-50 border border-border-subtle px-1 rounded">POST /predict</code> using the saved Random Forest pipeline.</p>
        </div>
        <button onClick={loadDemo} className="inline-flex items-center gap-2 text-xs font-medium bg-white border border-border shadow-card px-3 py-2 rounded-xl hover:shadow-card-hover transition"><RefreshCcw className="w-3.5 h-3.5" /> Refresh real response</button>
      </div>
      <PredictionResults result={data} />
    </div>
  );
}
