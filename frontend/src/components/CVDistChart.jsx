import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const COLORS = {
  mean: '#14b8a6',
  std: '#94a3b8',
};

export default function CVDistChart({ summary, title = 'Cross-Validation Distributions (5-fold grouped)' }) {
  if (!summary) return null;

  const data = [
    {
      metric: 'Macro-F1',
      mean: summary.mean_macro_f1?.toFixed(3) || 0,
      std: summary.std_macro_f1?.toFixed(3) || 0,
    },
    {
      metric: 'Balanced Acc',
      mean: summary.mean_balanced_accuracy?.toFixed(3) || 0,
      std: summary.std_balanced_accuracy?.toFixed(3) || 0,
    },
    {
      metric: 'QWK',
      mean: summary.mean_quadratic_weighted_kappa?.toFixed(3) || 0,
      std: summary.std_quadratic_weighted_kappa?.toFixed(3) || 0,
    },
  ];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-border-subtle rounded-lg shadow-lg p-3 text-xs">
          <p className="font-semibold text-navy mb-1">{label}</p>
          {payload.map((entry, idx) => (
            <p key={idx} style={{ color: entry.color }}>
              {entry.name}: {entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-navy tracking-tight">{title}</h3>
        <span className="text-[10px] font-mono text-text-muted bg-slate-50 px-2 py-0.5 rounded-md border border-border-subtle">
          Mean ± Std (n={summary.n_folds || 5})
        </span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barSize={36} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="metric"
              tick={{ fontSize: 11, fill: '#475569' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <YAxis
              domain={[0, 0.7]}
              tick={{ fontSize: 11, fill: '#475569' }}
              axisLine={{ stroke: '#e2e8f0' }}
              tickLine={false}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f1f5f9' }} />
            <Bar dataKey="mean" fill="#14b8a6" radius={[6, 6, 0, 0]} name="Mean" />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3 text-center">
        {data.map(d => (
          <div key={d.metric} className="rounded-lg py-2 text-xs bg-slate-50 text-text-secondary">
            <div className="font-extrabold text-sm">{d.mean}</div>
            <div className="text-[10px] font-mono opacity-70">± {d.std}</div>
            <div className="font-mono text-[10px] opacity-70 mt-0.5">{d.metric}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
