import { useState } from 'react';
import { ArrowRight, RotateCcw, Check, AlertCircle } from 'lucide-react';
import SyntheticExamples from './SyntheticExamples';

const INITIAL = { temperature: '', heartrate: '', resprate: '', o2sat: '', sbp: '', dbp: '', pain: '', arrival_transport: '', chiefcomplaint: '' };

export default function AssessmentForm({ onSubmit, isSubmitting, result }) {
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

  const inputClass = (k) => `w-full px-3 py-2.5 rounded-lg border text-sm font-medium transition bg-white focus:outline-none focus:ring-2 focus:ring-teal/20 focus:border-teal ${errors[k] ? 'border-rose-300 bg-rose-50/30' : 'border-border hover:border-slate-300'}`;

  return (
    <form onSubmit={handleSubmit} className="space-y-6" aria-label="Triage assessment form" noValidate>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Vital signs */}
          <section aria-labelledby="vs-heading" className="bg-white rounded-2xl border border-border shadow-card p-5">
            <h2 id="vs-heading" className="text-base font-bold text-navy tracking-tight mb-4 flex items-center gap-2">Vital Signs</h2>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Temperature" unit="°C / °F" name="temperature" value={values.temperature} onChange={v => update('temperature', v)} error={errors.temperature} placeholder="98.6" className={inputClass('temperature')} />
              <Field label="Heart Rate" unit="bpm" name="heartrate" value={values.heartrate} onChange={v => update('heartrate', v)} error={errors.heartrate} placeholder="88" className={inputClass('heartrate')} />
              <Field label="Respiratory Rate" unit="/min" name="resprate" value={values.resprate} onChange={v => update('resprate', v)} error={errors.resprate} placeholder="16" className={inputClass('resprate')} />
              <Field label="O2 Saturation" unit="%" name="o2sat" value={values.o2sat} onChange={v => update('o2sat', v)} error={errors.o2sat} placeholder="98" className={inputClass('o2sat')} />
              <Field label="Systolic BP" unit="mmHg" name="sbp" value={values.sbp} onChange={v => update('sbp', v)} error={errors.sbp} placeholder="120" className={inputClass('sbp')} />
              <Field label="Diastolic BP" unit="mmHg" name="dbp" value={values.dbp} onChange={v => update('dbp', v)} error={errors.dbp} placeholder="80" className={inputClass('dbp')} />
            </div>
          </section>

          {/* Pain & context */}
          <section aria-labelledby="ctx-heading" className="bg-white rounded-2xl border border-border shadow-card p-5">
            <h2 id="ctx-heading" className="text-base font-bold text-navy tracking-tight mb-4">Pain & Context</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="pain" className="block text-xs font-semibold text-slate mb-1.5">Pain Score <span className="font-normal text-text-muted">(0–10)</span></label>
                <input id="pain" type="number" min={0} max={10} step={1} value={values.pain} onChange={e => update('pain', e.target.value)} className={inputClass('pain')} placeholder="3" aria-describedby="pain-hint" />
                <div id="pain-hint" className="text-[11px] text-text-muted mt-1">Numeric 0–10 scale. Sentinels (UA, unable) become missing.</div>
                {errors.pain && <div className="text-xs text-rose-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {errors.pain}</div>}
              </div>
              <div>
                <label htmlFor="transport" className="block text-xs font-semibold text-slate mb-1.5">Arrival Transport</label>
                <select id="transport" value={values.arrival_transport} onChange={e => update('arrival_transport', e.target.value)} className={`${inputClass('transport')} appearance-none bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"12\" height=\"12\" viewBox=\"0 0 12 12\"%3E%3Cpath fill=\"none\" stroke=\"%23475569\" stroke-width=\"1.5\" d=\"M2 4l4 4 4-4\"/%3E%3C/svg%3E')] bg-no-repeat bg-[right_10px_center] pr-8`}>
                  <option value="">Select...</option>
                  <option value="AMBULANCE">AMBULANCE</option>
                  <option value="WALK IN">WALK IN</option>
                  <option value="UNKNOWN">UNKNOWN</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="chief" className="block text-xs font-semibold text-slate mb-1.5">Chief Complaint</label>
                <input id="chief" type="text" value={values.chiefcomplaint} onChange={e => update('chiefcomplaint', e.target.value)} className={inputClass('chiefcomplaint')} placeholder="e.g. CHEST PAIN, HEAD INJURY, ABDOMINAL PAIN" />
                <div className="text-[11px] text-text-muted mt-1">Normalised upstream (uppercase, whitespace collapsed). Placeholders mapped to "unknown".</div>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar: examples */}
        <aside className="lg:col-span-1">
          <SyntheticExamples onApply={applySample} />
          <div className="mt-4 rounded-2xl bg-gradient-to-br from-navy-deep to-navy-soft text-white shadow-card p-5">
            <div className="text-sm font-semibold tracking-tight mb-1">About this form</div>
            <p className="text-xs text-white/70 leading-relaxed">All fields are optional. Missing vitals become informative missingness indicators (temperature_missing, etc.). No age field is available in the demo package.</p>
          </div>
        </aside>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 bg-teal hover:bg-teal/90 text-white font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-teal/20 transition disabled:opacity-50 disabled:cursor-not-allowed">
          {isSubmitting ? 'Submitting...' : 'Submit Assessment'}
          {!isSubmitting && <ArrowRight className="w-4 h-4" />}
        </button>
        <button type="button" onClick={() => { setValues(INITIAL); setErrors({}); setTouched({}); }} className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-navy px-4 py-3 rounded-xl hover:bg-slate-50 transition border border-border-subtle">
          <RotateCcw className="w-4 h-4" /> Reset
        </button>
        <span className="text-xs font-mono text-text-muted ml-auto">Synthetic input — not a real patient</span>
      </div>
    </form>
  );
}

function Field({ label, unit, name, value, onChange, error, placeholder, className }) {
  return (
    <div>
      <label htmlFor={name} className="block text-xs font-semibold text-slate mb-1">{label} <span className="font-normal text-text-muted">{unit}</span></label>
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
      {error && <div id={`${name}-err`} className="text-[11px] text-rose-600 mt-1 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> {error}</div>}
    </div>
  );
}
