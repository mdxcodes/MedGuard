import { useEffect, useState } from 'react';
import DisclaimerBanner from '../components/DisclaimerBanner';

export default function ExperimentPage() {
  const [exps, setExps] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({name:'test', model_name:'random_forest'});
  const [error, setError] = useState(null);

  async function load() {
    const r = await fetch('/api/experiments');
    if (r.ok) setExps(await r.json());
  }

  useEffect(() => { load(); }, []);

  async function run() {
    setLoading(true); setError(null);
    try {
      const r = await fetch('/api/experiments/run', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form)});
      if (!r.ok) throw new Error('failed');
      await load();
    } catch (e) { setError('run failed'); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <DisclaimerBanner />
      <h1 className="text-3xl font-extrabold tracking-tighter text-navy">Experiment Workspace</h1>
      <div className="bg-white rounded-2xl border border-border shadow-card p-4 space-y-3">
        <input className="border p-2 text-sm rounded" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
        <select className="border p-2 text-sm rounded" value={form.model_name} onChange={e=>setForm({...form,model_name:e.target.value})}>
          <option value="random_forest">random_forest</option>
          <option value="logistic_regression">logistic_regression</option>
        </select>
        <button disabled={loading} onClick={run} className="bg-navy text-white px-4 py-2 rounded">{loading?'Running...':'Run'}</button>
        {error && <div className="text-xs text-rose-600">{error}</div>}
      </div>
      <div className="bg-white rounded-2xl border border-border shadow-card p-4">
        <h2 className="font-bold mb-2">History</h2>
        <table className="w-full text-sm">
          <thead><tr><th className="text-left">ID</th><th>Name</th><th>Status</th><th>Model</th></tr></thead>
          <tbody>
            {exps.map((e,i)=>(<tr key={i}><td>{e.id}</td><td>{e.name}</td><td>{e.status}</td><td>{e.config?.model_name}</td></tr>))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
