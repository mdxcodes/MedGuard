import { useState } from 'react';
import { ArrowRight, RotateCcw, AlertCircle } from 'lucide-react';
import SyntheticExamples from './SyntheticExamples';
import { FormField, MeasurementInput, SelectInput, controlClass } from './ui/FormField';

export const INITIAL = {
  heart_rate: '',
  respiratory_rate: '',
  temperature_c: '',
  spo2: '',
  systolic_bp: '',
  diastolic_bp: '',
  pain_score: '',
  arrival_mode: '',
  chief_complaint_system: '',
  age: '',
  sex: '',
  insurance_type: '',
  arrival_hour: '',
  shock_index: '',
  num_prior_ed_visits_12m: '',
  num_active_medications: '',
};

/**
 * The option lists are the categories the model was actually trained on
 * (the raw Triagegeist values). A value outside these sets is ignored by the
 * fitted encoder, so offering anything else would silently remove the
 * feature from the prediction.
 */
const SELECT_OPTIONS = {
  arrival_mode: [
    'walk-in',
    'ambulance',
    'transfer',
    'brought_by_family',
    'police',
    'helicopter',
  ],
  sex: ['F', 'M', 'Other'],
  insurance_type: ['public', 'private', 'military', 'none', 'unknown'],
  chief_complaint_system: [
    'cardiovascular',
    'respiratory',
    'neurological',
    'gastrointestinal',
    'musculoskeletal',
    'trauma',
    'psychiatric',
    'infectious',
    'endocrine',
    'dermatological',
    'genitourinary',
    'ophthalmic',
    'ENT',
    'other',
  ],
};

const NUMERIC_FIELDS = [
  { name: 'heart_rate', label: 'Heart Rate', unit: 'bpm', step: 1, placeholder: '88' },
  { name: 'respiratory_rate', label: 'Resp. Rate', unit: '/min', step: 1, placeholder: '16' },
  { name: 'temperature_c', label: 'Temperature', unit: '°C', step: 0.1, placeholder: '37.0' },
  { name: 'spo2', label: 'O₂ Saturation', unit: '%', step: 1, placeholder: '98' },
  { name: 'systolic_bp', label: 'Systolic BP', unit: 'mmHg', step: 1, placeholder: '120' },
  { name: 'diastolic_bp', label: 'Diastolic BP', unit: 'mmHg', step: 1, placeholder: '80' },
];

/**
 * Research Lab assessment form.
 *
 * When `onChange` is supplied the form is controlled by the shared
 * assessment store, so the entered values survive a mode switch. When it is
 * not, the form keeps its own state and behaves as before.
 */
export default function AssessmentForm({ onSubmit, isSubmitting, initialValues, onChange }) {
  const [localValues, setLocalValues] = useState(() => ({ ...INITIAL, ...(initialValues || {}) }));
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const controlled = typeof onChange === 'function';
  const values = controlled ? { ...INITIAL, ...(initialValues || {}) } : localValues;

  const update = (k, v) => {
    if (controlled) onChange(k, v);
    else setLocalValues((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((prev) => ({ ...prev, [k]: null }));
    setTouched((p) => ({ ...p, [k]: true }));
  };

  const applySample = (v) => {
    const next = { ...INITIAL, ...v };
    if (controlled) Object.entries(v).forEach(([key, value]) => onChange(key, value));
    else setLocalValues(next);
  };

  const validate = () => {
    const e = {};
    const n = (x) => (x === '' || x === null || x === undefined || isNaN(Number(x)) ? null : Number(x));
    const hr = n(values.heart_rate); if (hr !== null && (hr < 20 || hr > 220)) e.heart_rate = 'Outside 20–220 bpm';
    const rr = n(values.respiratory_rate); if (rr !== null && (rr < 4 || rr > 60)) e.respiratory_rate = 'Outside 4–60 /min';
    const temp = n(values.temperature_c); if (temp !== null && (temp < 30 || temp > 42)) e.temperature_c = 'Outside 30–42 °C';
    const o2 = n(values.spo2); if (o2 !== null && (o2 < 50 || o2 > 100)) e.spo2 = 'Outside 50–100 %';
    const sbp = n(values.systolic_bp); if (sbp !== null && (sbp < 50 || sbp > 250)) e.systolic_bp = 'Outside 50–250 mmHg';
    const dbp = n(values.diastolic_bp); if (dbp !== null && (dbp < 30 || dbp > 150)) e.diastolic_bp = 'Outside 30–150 mmHg';
    const pain = n(values.pain_score); if (pain !== null && (pain < 0 || pain > 10)) e.pain_score = 'Outside 0–10';
    const age = n(values.age); if (age !== null && (age < 0 || age > 120)) e.age = 'Outside 0–120 years';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (validate()) {
      const payload = {};
      for (const [key, value] of Object.entries(values)) {
        if (value === '' || value === null || value === undefined) continue;
        payload[key] = typeof value === 'number' ? value : (key === 'arrival_hour' || key === 'shock_index' || key === 'num_prior_ed_visits_12m' || key === 'num_active_medications' ? Number(value) : value);
      }
      onSubmit(payload);
    }
  };

  const inputClass = (k) => controlClass(errors[k]);

  return (
    <form onSubmit={handleSubmit} className="space-y-8" aria-label="Triage assessment form" noValidate>
      {/* Vital signs */}
      <section aria-labelledby="vs-heading" className="space-y-6">
        <h2 id="vs-heading" className="text-xs font-mono text-muted uppercase tracking-widest font-semibold">Vital Signs</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          {NUMERIC_FIELDS.map((field) => (
            <FormField
              key={field.name}
              id={field.name}
              label={field.label}
              unit={field.unit}
              error={errors[field.name]}
            >
              {(controlProps) => (
                <MeasurementInput
                  id={field.name}
                  value={values[field.name]}
                  onChange={(v) => update(field.name, v)}
                  error={errors[field.name]}
                  min={0}
                  step={field.step}
                  placeholder={field.placeholder}
                  {...controlProps}
                />
              )}
            </FormField>
          ))}
        </div>
      </section>

      {/* Pain & Demographics */}
      <section aria-labelledby="ctx-heading" className="space-y-6">
        <h2 id="ctx-heading" className="text-xs font-mono text-muted uppercase tracking-widest font-semibold">Pain & Demographics</h2>
        <div className="grid sm:grid-cols-2 gap-3 lg:gap-6">
          <FormField
            id="pain_score"
            label="Pain Score"
            unit="0–10"
            error={errors.pain_score}
            hint="Numeric 0–10 scale."
          >
            {(controlProps) => (
              <MeasurementInput
                id="pain_score"
                value={values.pain_score}
                onChange={(v) => update('pain_score', v)}
                error={errors.pain_score}
                min={0}
                max={10}
                step={1}
                placeholder="3"
                {...controlProps}
              />
            )}
          </FormField>
          <FormField
            id="age"
            label="Age"
            unit="years"
            error={errors.age}
            hint="Patient age in years."
          >
            {(controlProps) => (
              <MeasurementInput
                id="age"
                value={values.age}
                onChange={(v) => update('age', v)}
                error={errors.age}
                min={0}
                max={120}
                step={1}
                placeholder="45"
                {...controlProps}
              />
            )}
          </FormField>
          <FormField id="arrival_mode" label="Arrival Mode" error={errors.arrival_mode} className="lg:col-span-2">
            {(controlProps) => (
              <SelectInput
                id="arrival_mode"
                value={values.arrival_mode}
                onChange={(v) => update('arrival_mode', v)}
                options={SELECT_OPTIONS.arrival_mode}
                error={errors.arrival_mode}
                {...controlProps}
              />
            )}
          </FormField>
          <FormField id="sex" label="Sex" error={errors.sex} className="lg:col-span-2">
            {(controlProps) => (
              <SelectInput
                id="sex"
                value={values.sex}
                onChange={(v) => update('sex', v)}
                options={SELECT_OPTIONS.sex}
                error={errors.sex}
                {...controlProps}
              />
            )}
          </FormField>
          <FormField id="insurance_type" label="Insurance Type" error={errors.insurance_type} className="lg:col-span-2">
            {(controlProps) => (
              <SelectInput
                id="insurance_type"
                value={values.insurance_type}
                onChange={(v) => update('insurance_type', v)}
                options={SELECT_OPTIONS.insurance_type}
                error={errors.insurance_type}
                {...controlProps}
              />
            )}
          </FormField>
          <FormField id="chief_complaint_system" label="Chief Complaint" error={errors.chief_complaint_system} className="lg:col-span-2">
            {(controlProps) => (
              <SelectInput
                id="chief_complaint_system"
                value={values.chief_complaint_system}
                onChange={(v) => update('chief_complaint_system', v)}
                options={SELECT_OPTIONS.chief_complaint_system}
                error={errors.chief_complaint_system}
                {...controlProps}
              />
            )}
          </FormField>
        </div>
      </section>

      {/* Derived / contextual */}
      <section aria-labelledby="ctx2-heading" className="space-y-6">
        <h2 id="ctx2-heading" className="text-xs font-mono text-muted uppercase tracking-widest font-semibold">Derived &amp; Contextual</h2>
        <div className="grid sm:grid-cols-2 gap-3 lg:gap-6">
          <FormField id="arrival_hour" label="Arrival Hour" unit="0–23" error={errors.arrival_hour}>
            {(controlProps) => (
              <MeasurementInput
                id="arrival_hour"
                value={values.arrival_hour}
                onChange={(v) => update('arrival_hour', v)}
                error={errors.arrival_hour}
                min={0}
                max={23}
                step={1}
                placeholder="14"
                {...controlProps}
              />
            )}
          </FormField>
          <FormField id="shock_index" label="Shock Index" unit="ratio" error={errors.shock_index}>
            {(controlProps) => (
              <MeasurementInput
                id="shock_index"
                value={values.shock_index}
                onChange={(v) => update('shock_index', v)}
                error={errors.shock_index}
                min={0}
                step={0.01}
                placeholder="0.73"
                {...controlProps}
              />
            )}
          </FormField>
          <FormField id="num_prior_ed_visits_12m" label="Prior ED Visits (12m)" unit="count" error={errors.num_prior_ed_visits_12m}>
            {(controlProps) => (
              <MeasurementInput
                id="num_prior_ed_visits_12m"
                value={values.num_prior_ed_visits_12m}
                onChange={(v) => update('num_prior_ed_visits_12m', v)}
                error={errors.num_prior_ed_visits_12m}
                min={0}
                step={1}
                placeholder="2"
                {...controlProps}
              />
            )}
          </FormField>
          <FormField id="num_active_medications" label="Active Medications" unit="count" error={errors.num_active_medications}>
            {(controlProps) => (
              <MeasurementInput
                id="num_active_medications"
                value={values.num_active_medications}
                onChange={(v) => update('num_active_medications', v)}
                error={errors.num_active_medications}
                min={0}
                step={1}
                placeholder="3"
                {...controlProps}
              />
            )}
          </FormField>
        </div>
      </section>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-contrast font-semibold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-primary/20 transition disabled:opacity-50 disabled:cursor-not-allowed">
          {isSubmitting ? 'Submitting…' : 'Submit Assessment'}
          {!isSubmitting && <ArrowRight className="w-4 h-4" aria-hidden="true" />}
        </button>
        <button
          type="button"
          onClick={() => {
            if (controlled) {
              Object.keys(INITIAL).forEach((key) => onChange(key, ''));
            } else {
              setLocalValues(INITIAL);
            }
            setErrors({});
            setTouched({});
          }}
          className="inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-primary px-4 py-3.5 rounded-xl hover:bg-surface-lift transition border border-border"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" /> Reset
        </button>
        <span className="text-[10px] font-mono text-muted ml-auto">Synthetic input — not a real patient</span>
      </div>

      {/* Examples sidebar */}
      <div className="mt-8">
        <SyntheticExamples onApply={applySample} />
      </div>
    </form>
  );
}
