import { useState } from 'react';
import { Sparkles } from 'lucide-react';

/**
 * Synthetic example cases.
 *
 * Every value here is fictional and lives inside the Triagegeist dataset
 * ranges. The component exists so a visitor can see the assessment flow
 * without inventing data themselves — it is a demo affordance, never a
 * default, and it never fills the form unless the visitor asks for it.
 */
export const SAMPLES = [
  {
    label: 'Respiratory distress',
    summary: 'Fast breathing, low oxygen, brought in by ambulance',
    values: {
      heart_rate: 112, respiratory_rate: 28, temperature_c: 37.2, spo2: 88,
      systolic_bp: 94, diastolic_bp: 62, pain_score: 7, arrival_mode: 'ambulance',
      chief_complaint_system: 'respiratory', age: 68, sex: 'F',
      insurance_type: 'public', arrival_hour: 14, shock_index: 1.19,
      num_prior_ed_visits_12m: 3, num_active_medications: 5,
    },
  },
  {
    label: 'Stable injury',
    summary: 'Walking in, settled observations',
    values: {
      heart_rate: 82, respiratory_rate: 14, temperature_c: 36.5, spo2: 98,
      systolic_bp: 128, diastolic_bp: 78, pain_score: 4, arrival_mode: 'walk-in',
      chief_complaint_system: 'trauma', age: 32, sex: 'M',
      insurance_type: 'private', arrival_hour: 10, shock_index: 0.64,
      num_prior_ed_visits_12m: 1, num_active_medications: 1,
    },
  },
  {
    label: 'Altered mental status',
    summary: 'Confusion, fever, arrived at night',
    values: {
      heart_rate: 118, respiratory_rate: 22, temperature_c: 38.1, spo2: 92,
      systolic_bp: 102, diastolic_bp: 68, pain_score: 9, arrival_mode: 'ambulance',
      chief_complaint_system: 'neurological', age: 74, sex: 'F',
      insurance_type: 'public', arrival_hour: 2, shock_index: 1.16,
      num_prior_ed_visits_12m: 5, num_active_medications: 8,
    },
  },
];

export default function SyntheticExamples({ onApply, variant = 'research' }) {
  const [picked, setPicked] = useState(null);
  const patient = variant === 'patient';

  return (
    <div className={`rounded-2xl border border-border shadow-sm ${patient ? 'bg-surface-soft/60' : 'bg-surface shadow-card'}`}>
      <div className="p-5">
        <h3 className="font-semibold text-primary tracking-tight mb-1 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" aria-hidden="true" />
          {patient ? 'Try a demonstration' : 'Synthetic Examples'}
          <span className="text-xs font-mono text-muted bg-surface-soft px-1.5 py-0.5 rounded">Fictional</span>
        </h3>
        <p className="text-[11px] text-muted mb-3 leading-snug">
          {patient
            ? 'Fill the form with invented example values to see how the result is presented. Nothing here is a real person.'
            : 'Examples use synthetic vital-sign values from the Triagegeist dataset ranges. They are not real patient records.'}
        </p>
        <div className="space-y-2">
          {SAMPLES.map((sample) => (
            <button
              key={sample.label}
              type="button"
              onClick={() => {
                setPicked(sample);
                onApply(sample.values);
              }}
              className={[
                'w-full text-left px-3 py-2.5 rounded-lg border transition font-medium',
                picked?.label === sample.label
                  ? 'border-primary bg-primary-soft text-primary-muted'
                  : 'border-border hover:border-primary/40 hover:bg-surface-lift text-primary',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-2">
                <span>{sample.label}</span>
                <span className="text-[10px] font-mono text-muted">{sample.values.arrival_mode}</span>
              </div>
              <div className="text-[11px] text-secondary font-normal mt-0.5">{sample.summary}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
