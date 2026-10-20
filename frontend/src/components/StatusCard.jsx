import { Activity, ShieldCheck, BrainCircuit, ArrowUpRight } from 'lucide-react';

export default function StatusCard() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatusItem label="API" value="Available" sub="Health endpoint responding" icon={ShieldCheck} tone="teal" />
      <StatusItem label="Model" value="Loaded" sub="Random Forest · 35 features" icon={BrainCircuit} tone="teal" />
      <StatusItem label="Dataset" value="Demo subset" sub="207 labelled visits · 56 patients" icon={Activity} tone="amber" />
    </div>
  );
}

function StatusItem({ label, value, sub, icon: Icon, tone }) {
  const toneClass = tone === 'teal' ? 'text-teal bg-teal-900/60' : 'text-amber-600 bg-amber-900/20';
  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-4 hover:shadow-card-hover transition">
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${toneClass}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <span className="text-xs font-mono text-text-muted uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-lg font-extrabold text-primary leading-none tracking-tight">{value}</div>
      <div className="text-xs text-text-secondary mt-1.5 leading-snug">{sub}</div>
    </div>
  );
}
