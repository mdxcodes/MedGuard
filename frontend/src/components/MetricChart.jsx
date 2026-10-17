import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

export default function MetricChart() {
  const data = [
    { model: 'Dummy MF', f1: 0.20, acc: 0.33, label: 'Baseline' },
    { model: 'Dummy Strat', f1: 0.24, acc: 0.26, label: 'Baseline' },
    { model: 'Logistic Reg.', f1: 0.55, acc: 0.54, label: 'Candidate' },
    { model: 'Random Forest', f1: 0.57, acc: 0.60, label: 'Selected' },
  ];

  return (
    <div className="rounded-2xl bg-white border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-navy tracking-tight">Cross-Validation Performance (5-fold grouped)</h3>
        <span className="text-[10px] font-mono text-text-muted bg-slate-50 px-2 py-0.5 rounded-md border border-border-subtle">Macro-F1 ± std</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={36}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="model" tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <YAxis domain={[0, 0.7]} tick={{ fontSize: 11, fill: '#475569' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 13, fontFamily: 'Inter, sans-serif' }}
              cursor={{ fill: '#f1f5f9' }}
              formatter={(v) => [v.toFixed(3), '']}
            />
            <Bar dataKey="f1" fill="#14b8a6" radius={[6, 6, 0, 0]} name="Mean Macro-F1" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
        {data.map(d => (
          <div key={d.model} className={`rounded-lg py-2 text-xs ${d.label === 'Selected' ? 'bg-teal-muted/40 text-teal' : 'bg-slate-50 text-text-secondary'}`}>
            <div className="font-extrabold text-sm">{d.f1.toFixed(2)}</div>
            <div className="font-mono text-[10px] opacity-70">{d.model}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
