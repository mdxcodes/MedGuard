import { useState } from 'react';
import { Sparkles } from 'lucide-react';

const samples = [
  {
    label: 'Respiratory Distress',
    values: {
      heart_rate: 112, respiratory_rate: 28, temperature_c: 37.2, spo2: 88,
      systolic_bp: 94, diastolic_bp: 62, pain_score: 7, arrival_mode: 'AMBULANCE',
      chief_complaint_system: 'Respiratory', age: 68, sex: 'F',
      insurance_type: 'Medicare', arrival_hour: 14, shock_index: 1.19,
      num_prior_ed_visits_12m: 3, num_active_medications: 5,
    },
  },
  {
    label: 'Stable Trauma',
    values: {
      heart_rate: 82, respiratory_rate: 14, temperature_c: 36.5, spo2: 98,
      systolic_bp: 128, diastolic_bp: 78, pain_score: 4, arrival_mode: 'WALK IN',
      chief_complaint_system: 'Trauma', age: 32, sex: 'M',
      insurance_type: 'Private', arrival_hour: 10, shock_index: 0.64,
      num_prior_ed_visits_12m: 1, num_active_medications: 1,
    },
  },
  {
    label: 'Altered Mental Status',
    values: {
      heart_rate: 118, respiratory_rate: 22, temperature_c: 38.1, spo2: 92,
      systolic_bp: 102, diastolic_bp: 68, pain_score: 9, arrival_mode: 'AMBULANCE',
      chief_complaint_system: 'Neurological', age: 74, sex: 'F',
      insurance_type: 'Medicare', arrival_hour: 2, shock_index: 1.16,
      num_prior_ed_visits_12m: 5, num_active_medications: 8,
    },
  },
];

export default function SyntheticExamples({ onApply }) {
  const [picked, setPicked] = useState(null);
  return (
    <div className="rounded-2xl bg-surface border border-border shadow-card p-5">
      <h3 className="font-semibold text-primary tracking-tight mb-3 flex items-center gap-2">
        Synthetic Examples <span className="text-xs font-mono text-text-muted bg-surface-soft px-1.5 py-0.5 rounded">Fictional</span>
      </h3>
      <div className="space-y-2">
        {samples.map((s) => (
          <button
            key={s.label}
            onClick={() => { setPicked(s); onApply(s.values); }}
            className={`w-full text-left text-sm px-3 py-2.5 rounded-lg border transition font-medium ${picked?.label === s.label ? 'border-teal bg-teal-900/30 text-teal' : 'border-border-subtle hover:border-teal/30 hover:bg-teal-900/20 text-primary'}`}
          >
            <div className="flex items-center justify-between">
              <span>{s.label}</span>
              <span className="text-[10px] font-mono text-text-muted">{s.values.arrival_mode}</span>
            </div>
            <div className="text-[11px] text-text-secondary font-normal mt-0.5 truncate">{s.values.chief_complaint_system}</div>
          </button>
        ))}
      </div>
      <div className="mt-3 text-[11px] text-text-muted leading-relaxed font-mono bg-surface-soft rounded-md px-2.5 py-1.5 border border-border-subtle">
        Examples use synthetic vital-sign values from the Triagegeist dataset ranges. They are not real patient records.
      </div>
    </div>
  );
}
