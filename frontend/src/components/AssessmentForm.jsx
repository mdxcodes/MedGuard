import { useState } from 'react';
import { ArrowRight, RotateCcw, AlertCircle } from 'lucide-react';
import SyntheticExamples from './SyntheticExamples';

const INITIAL = { temperature: '', heartrate: '', resprate: '', o2sat: '', sbp: '', dbp: '', pain: '', arrival_transport: '', chiefcomplaint: '' };

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
    const temp = n(values.temperature);
    if (temp !== null && (temp < 30 || temp > 110)) e.temperature = 'Outside plausible clinical envelope';
    const hr = n(values.heartrate); if (hr !== null && (hr < 30 || hr > 220)) e.heartrate = 'Outside 30–220 bpm';
    const rr = n(values.resprate); if (rr !== null && (rr < 4 || rr > 60)) e.resprate = 'Outside 4–60 /min';
    const o2 = n(values.o2sat); if (o2 !== null && (o2 < 50 || o2 > 100)) e.o2sat = 'Outside 50–100 %';
    const sbp = n(values.sbp); if (sbp !== null && (sbp < 50 || sbp > 250)) e.sbp = 'Outside 50–250 mmHg';
    const dbp = n(values.dbp); if (dbp !== null && (dbp < 30 || dbp > 150)) e.dbp = 'Outside 30–150 mmHg';
    const pain = n(values.pain); if (pain !== null && (pain < 0 || pain > 10)) e.pain = 'Outside 0–10';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = (ev) => {
    ev.preventDefault();
    if (validate()) {
      const payload = {
        temperature: values.temperature === '' ? undefined : Number(values.temperature),
        heartrate: values.heartrate === '' ? undefined : Number(values.heartrate),
        resprate: values.resprate === '' ? undefined : Number(values.resprate),
        o2sat: values.o2sat === '' ? undefined : Number(values.o2sat),
        sbp: values.sbp === '' ? undefined : Number(values.sbp),
        dbp: values.dbp === '' ? undefined : Number(values.dbp),
        pain: values.pain === '' ? undefined : Number(values.pain),
        arrival_transport: values.arrival_transport || undefined,
        chiefcomplaint: values.chiefcomplaint || undefined,
      };
      onSubmit(payload);
    }
  };

  const inputClass = (k) => `w-full px-3 py-3 rounded-lg border text-sm font-medium transition bg-surface focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary ${errors[k] ? 'border-error bg-error-bg/30' : 'border-border hover:border-secondary/40'}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-8" aria-label="Triage assessment form" noValidate>
      {/* Vital signs */}
      <section aria-labelledby="vs-heading" className="space-y-6">
        <h2 id="vs-heading" className="text-xs font-mono text-muted uppercase tracking-widest font-semibold">Vital signs</h2>
        <div className="grid sm:grid-cols-3 gap-3">
          <Field label="Temperature" unit="°C / °F" name="temperature" value={values.temperature} onChange={v => update('temperature', v)} error={errors.temperature} placeholder="98.6" className={inputClass('temperature')} />
          <Field label="Heart rate" unit="bpm" name="heartrate" value={values.heartrate} onChange={v => update('heartrate', v)} error={errors.heartrate} placeholder="88" className={inputClass('heartrate')} />
          <Field label="Resp. rate" unit="/min" name="resprate" value={values.resprate} onChange={v => update('resprate', v)} error={errors.resprate} placeholder="16" className={inputClass('resprate')} />
          <Field label="O₂ saturation" unit="%" name="o2sat" value={values.o2sat} onChange={v => update('o2sat', v)} error={errors.o2sat} placeholder="98" className={inputClass('o2sat')} />
          <Field label="Systolic BP" unit="mmHg" name="sbp" value={values.sbp} onChange={v => update('sbp', v)} error={errors.sbp} placeholder="120" className={inputClass('sbp')} />
          <Field label="Diastolic BP" unit="mmHg" name="dbp" value={values.dbp} onChange={v => update('dbp', v)} error={errors.dbp} placeholder="80" className={inputClass('dbp')} />
        </div>
      </section>

      {/* Pain & context */}
      <section aria-labelledby="ctx-heading" className="space-y-6">
        <h2 id="ctx-heading" className="text-xs font-mono text-muted uppercase tracking-widest font-semibold">Pain & context</h2>
        <div className="grid sm:grid-cols-2 gap-3 lg:gap-6">
          <div>
            <Field
              label="Pain score" unit="0–10" name="pain" value={values.pain}
              onChange={v => update('pain', v)} error={errors.pain} placeholder="3" className={inputClass('pain')}
              hint="Numeric 0–10 scale. Sentinels (UA, unable) become missing."
            />
          </div>
          <div>
            <FieldSelect
              label="Arrival transport" name="arrival_transport" value={values.arrival_transport}
              onChange={e => update('arrival_transport', e.target.value)} error={errors.arrival_transport}
            />
          </div>
          <div className="lg:col-span-2">
            <FieldText
              label="Chief complaint" name="chiefcomplaint" value={values.chiefcomplaint}
              onChange={e => update('chiefcomplaint', e.target.value)} error={errors.chiefcomplaint}
              placeholder="e.g. CHEST PAIN, HEAD INJURY, ABDOMINAL PAIN"
              hint="Normalised upstream (uppercase, whitespace collapsed). Placeholders mapped to 'unknown'."
            />
          </div>
        </div>
      </section>

      {/* Submit */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-white font-semibold text-sm px-6 py-3.5 rounded-xl shadow-lg shadow-primary/20 transition disabled:opacity-50 disabled:cursor-not-allowed">
          {isSubmitting ? 'Submitting…' : 'Submit assessment'}
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
        step={name === 'pain' ? 1 : 0.1}
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
  return (
    <div>
      <div className="flex items-baseline gap-1 mb-1.5">
        <label htmlFor={name} className="text-xs font-semibold text-secondary">{label}</label>
      </div>
      <select id={name} value={value} onChange={e => onChange(e.target.value)} className={inputClassForSelect(error)}>
        <option value="">Select…</option>
        <option value="AMBULANCE">AMBULANCE</option>
        <option value="WALK IN">WALK IN</option>
        <option value="UNKNOWN">UNKNOWN</option>
        <option value="OTHER">OTHER</option>
      </select>
      {error && <div id={`${name}-err`} className="text-[10px] text-error mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</div>}
    </div>
  );
}

function inputClassForSelect(error) {
  return `w-full px-3 py-3 rounded-lg border text-sm font-medium transition bg-surface focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 12 12%22%3E%3Cpath fill=%22none%22 stroke=%22%23475569%22 stroke-width=%221.5%22 d=%22M2 4l4 4 4-4%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_10px_center] pr-8 ${error ? 'border-error bg-error-bg/30' : 'border-border hover:border-secondary/40'}`;
}
