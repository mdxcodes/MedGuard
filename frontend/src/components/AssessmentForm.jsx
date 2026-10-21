import { useState } from 'react';
import { ArrowRight, RotateCcw, AlertCircle } from 'lucide-react';
import SyntheticExamples from './SyntheticExamples';

const INITIAL = {
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

export default function AssessmentForm({ onSubmit, isSubmitting }) {
  const [values, setValues] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  const update = (k, v) => {
    setValues(p => ({ ...p, [k]: v }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: null }));
    setTouched(p => ({ ...p, [k]: true }));
  };

  const applySample = (v) => setValues({ ...INITIAL, ...v });

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
      const payload = {
        heart_rate: values.heart_rate === '' ? undefined : Number(values.heart_rate),
        respiratory_rate: values.respiratory_rate === '' ? undefined : Number(values.respiratory_rate),
        temperature_c: values.temperature_c === '' ? undefined : Number(values.temperature_c),
        spo2: values.spo2 === '' ? undefined : Number(values.spo2),
        systolic_bp: values.systolic_bp === '' ? undefined : Number(values.systolic_bp),
        diastolic_bp: values.diastolic_bp === '' ? undefined : Number(values.diastolic_bp),
        pain_score: values.pain_score === '' ? undefined : Number(values.pain_score),
        arrival_mode: values.arrival_mode || undefined,
        chief_complaint_system: values.chief_complaint_system || undefined,
        age: values.age === '' ? undefined : Number(values.age),
        sex: values.sex || undefined,
        insurance_type: values.insurance_type || undefined,
        arrival_hour: values.arrival_hour === '' ? undefined : Number(values.arrival_hour),
        shock_index: values.shock_index === '' ? undefined : Number(values.shock_index),
        num_prior_ed_visits_12m: values.num_prior_ed_visits_12m === '' ? undefined : Number(values.num_prior_ed_visits_12m),
        num_active_medications: values.num_active_medications === '' ? undefined : Number(values.num_active_medications),
      };
      onSubmit(payload);
    }
  };

  const inputClass = (k) => `w-full px-3 py-3 rounded-lg border text-sm font-medium transition bg-surface focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary ${errors[k] ? 'border-error bg-error-bg/30' : 'border-border hover:border-secondary/40'}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-8" aria-label="Triage assessment form" noValidate>
      {/* Vital signs */}
      <section aria-labelledby="vs-heading" className="space-y-6">
        <h2 id="vs-heading" className="text-xs font-mono text-muted uppercase tracking-widest font-semibold">Vital Signs</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Heart Rate" unit="bpm" name="heart_rate" value={values.heart_rate} onChange={v => update('heart_rate', v)} error={errors.heart_rate} placeholder="88" className={inputClass('heart_rate')} />
          <Field label="Resp. Rate" unit="/min" name="respiratory_rate" value={values.respiratory_rate} onChange={v => update('respiratory_rate', v)} error={errors.respiratory_rate} placeholder="16" className={inputClass('respiratory_rate')} />
          <Field label="Temperature" unit="°C" name="temperature_c" value={values.temperature_c} onChange={v => update('temperature_c', v)} error={errors.temperature_c} placeholder="37.0" className={inputClass('temperature_c')} />
          <Field label="O₂ Saturation" unit="%" name="spo2" value={values.spo2} onChange={v => update('spo2', v)} error={errors.spo2} placeholder="98" className={inputClass('spo2')} />
          <Field label="Systolic BP" unit="mmHg" name="systolic_bp" value={values.systolic_bp} onChange={v => update('systolic_bp', v)} error={errors.systolic_bp} placeholder="120" className={inputClass('systolic_bp')} />
          <Field label="Diastolic BP" unit="mmHg" name="diastolic_bp" value={values.diastolic_bp} onChange={v => update('diastolic_bp', v)} error={errors.diastolic_bp} placeholder="80" className={inputClass('diastolic_bp')} />
        </div>
      </section>

      {/* Pain & Demographics */}
      <section aria-labelledby="ctx-heading" className="space-y-6">
        <h2 id="ctx-heading" className="text-xs font-mono text-muted uppercase tracking-widest font-semibold">Pain & Demographics</h2>
        <div className="grid sm:grid-cols-2 gap-3 lg:gap-6">
          <div>
            <Field
              label="Pain Score" unit="0–10" name="pain_score" value={values.pain_score}
              onChange={v => update('pain_score', v)} error={errors.pain_score} placeholder="3" className={inputClass('pain_score')}
              hint="Numeric 0–10 scale."
            />
          </div>
          <div>
            <Field
              label="Age" unit="years" name="age" value={values.age}
              onChange={v => update('age', v)} error={errors.age} placeholder="45" className={inputClass('age')}
              hint="Patient age in years."
            />
          </div>
          <div className="lg:col-span-2">
            <FieldSelect
              label="Arrival Mode" name="arrival_mode" value={values.arrival_mode}
              onChange={e => update('arrival_mode', e.target.value)} error={errors.arrival_mode}
            />
          </div>
          <div className="lg:col-span-2">
            <FieldSelect
              label="Sex" name="sex" value={values.sex}
              onChange={e => update('sex', e.target.value)} error={errors.sex}
            />
          </div>
          <div className="lg:col-span-2">
            <FieldSelect
              label="Insurance Type" name="insurance_type" value={values.insurance_type}
              onChange={e => update('insurance_type', e.target.value)} error={errors.insurance_type}
            />
          </div>
          <div className="lg:col-span-2">
            <FieldSelect
              label="Chief Complaint" name="chief_complaint_system" value={values.chief_complaint_system}
              onChange={e => update('chief_complaint_system', e.target.value)} error={errors.chief_complaint_system}
            />
          </div>
        </div>
      </section>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-primary/20 transition disabled:opacity-50 disabled:cursor-not-allowed">
          {isSubmitting ? 'Submitting…' : 'Submit Assessment'}
          {!isSubmitting && <ArrowRight className="w-4 h-4" />}
        </button>
        <button type="button" onClick={() => { setValues(INITIAL); setErrors({}); setTouched({}); }} className="inline-flex items-center gap-2 text-sm font-medium text-secondary hover:text-primary px-4 py-3.5 rounded-xl hover:bg-surface-lift transition border border-border">
          <RotateCcw className="w-4 h-4" /> Reset
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

function Field({ label, unit, name, value, onChange, error, placeholder, className, hint }) {
  return (
    <div>
      <div className="flex items-baseline gap-1 mb-1.5">
        <label htmlFor={name} className="text-xs font-semibold text-secondary">{label}</label>
        {unit && <span className="text-[10px] font-mono text-muted">{unit}</span>}
      </div>
      <input
        id={name}
        type="number"
        step={name === 'pain_score' ? 1 : 0.1}
        value={value}
        onChange={e => onChange(e.target.value)}
        className={className}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-err` : undefined}
      />
      {error && <div id={`${name}-err`} className="text-[10px] text-error mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</div>}
      {hint && <div className="text-[10px] text-muted mt-1">{hint}</div>}
    </div>
  );
}

function FieldText({ label, name, value, onChange, error, placeholder, hint }) {
  return (
    <div>
      <div className="flex items-baseline gap-1 mb-1.5">
        <label htmlFor={name} className="text-xs font-semibold text-secondary">{label}</label>
      </div>
      <input
        id={name}
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`w-full px-3 py-3 rounded-lg border text-sm font-medium transition bg-surface focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary ${error ? 'border-error bg-error-bg/30' : 'border-border hover:border-secondary/40'}`}
        placeholder={placeholder}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-err` : undefined}
      />
      {error && <div id={`${name}-err`} className="text-[10px] text-error mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</div>}
      {hint && <div className="text-[10px] text-muted mt-1">{hint}</div>}
    </div>
  );
}

function FieldSelect({ label, name, value, onChange, error }) {
  const optionsMap = {
    arrival_mode: ['AMBULANCE', 'WALK IN', 'OTHER', 'UNKNOWN'],
    sex: ['M', 'F', 'Other', 'Unknown'],
    insurance_type: ['Private', 'Medicare', 'Medicaid', 'Self-pay', 'Other', 'Unknown'],
    chief_complaint_system: ['Cardiovascular', 'Respiratory', 'Neurological', 'Abdominal', 'Trauma', 'Other', 'Unknown'],
  };
  const options = optionsMap[name] || [];
  return (
    <div>
      <div className="flex items-baseline gap-1 mb-1.5">
        <label htmlFor={name} className="text-xs font-semibold text-secondary">{label}</label>
      </div>
      <select id={name} value={value} onChange={e => onChange(e.target.value)} className={inputClassForSelect(error)}>
        <option value="">Select…</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {error && <div id={`${name}-err`} className="text-[10px] text-error mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</div>}
    </div>
  );
}

function inputClassForSelect(error) {
  return `w-full px-3 py-3 rounded-lg border text-sm font-medium transition bg-surface focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath fill=%22none%22 stroke=%22%23475569%22 stroke-width=%221.5%22 d=%22M2 4l4 4 4-4%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_10px_center] pr-8 ${error ? 'border-error bg-error-bg/30' : 'border-border hover:border-secondary/40'}`;
}
