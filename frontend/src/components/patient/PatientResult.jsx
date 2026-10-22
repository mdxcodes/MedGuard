import { Link } from 'react-router-dom';
import {
  Shield, AlertTriangle, CheckCircle2, Info, ArrowRight, Stethoscope, PhoneCall,
} from 'lucide-react';
import ExpandableExplanation from '../ui/ExpandableExplanation';
import { EmergencyNotice } from './PatientNav';
import { ASSESSMENT_FIELDS, hasValue, missingFields } from '../../lib/assessment';

/**
 * Plain-language names for the model features that can appear in an
 * explanation. The model reports its own feature names; this map only
 * re-labels them for a non-technical reader. An unmapped feature falls back
 * to a humanised version of its own name — nothing is invented.
 */
const PLAIN_LABELS = {
  heart_rate: 'Heart rate',
  respiratory_rate: 'Breathing rate',
  temperature_c: 'Temperature',
  spo2: 'Oxygen saturation',
  systolic_bp: 'Blood pressure (upper number)',
  diastolic_bp: 'Blood pressure (lower number)',
  mean_arterial_pressure: 'Average blood pressure',
  pulse_pressure: 'Blood pressure difference',
  shock_index: 'Shock index',
  pain_score: 'Pain level',
  age: 'Age',
  gcs_total: 'Consciousness score (GCS)',
  news2_score: 'Early warning score (NEWS2)',
  bmi: 'Body mass index',
  weight_kg: 'Weight',
  height_cm: 'Height',
  num_prior_ed_visits_12m: 'Recent emergency visits',
  num_prior_admissions_12m: 'Recent hospital admissions',
  num_active_medications: 'Current medications',
  num_comorbidities: 'Other long-term conditions',
  chief_complaint_system: 'Main concern',
  arrival_mode: 'How the person arrived',
  arrival_hour: 'Time of arrival',
};

function plainLabel(feature) {
  if (PLAIN_LABELS[feature]) return PLAIN_LABELS[feature];
  return String(feature).replace(/^num__|^cat__/, '').replace(/_/g, ' ');
}

/**
 * The five ESI levels and what they mean on the Emergency Severity Index
 * scale. The names and meanings follow the AHRQ Emergency Severity Index
 * (1 = most urgent, 5 = least urgent).
 */
export const ESI_LEVELS = {
  1: {
    name: 'Resuscitation',
    plain: 'Needs immediate life-saving help',
    detail:
      'On the Emergency Severity Index scale, level 1 is for someone whose condition needs immediate life-saving intervention.',
  },
  2: {
    name: 'Emergent',
    plain: 'Very high risk — should be seen right away',
    detail:
      'On the Emergency Severity Index scale, level 2 is for someone at high risk who needs to be seen very soon.',
  },
  3: {
    name: 'Urgent',
    plain: 'Needs to be seen, but is currently stable',
    detail:
      'On the Emergency Severity Index scale, level 3 is for someone who needs an assessment but is not expected to deteriorate immediately.',
  },
  4: {
    name: 'Less urgent',
    plain: 'Stable, but still needs an assessment',
    detail:
      'On the Emergency Severity Index scale, level 4 is for someone who is stable but should still be assessed.',
  },
  5: {
    name: 'Non-urgent',
    plain: 'Stable, can safely wait longer',
    detail:
      'On the Emergency Severity Index scale, level 5 is for someone who is stable and is expected to need few or no emergency resources.',
  },
};

/**
 * Patient Mode result.
 *
 * It renders the *same* response object the Research Lab renders, with a
 * simpler presentation. It never computes a prediction of its own, never
 * performs a second request, and never shows a result that was not returned
 * by the API for the values that were submitted.
 */
export default function PatientResult({ result, submittedPayload }) {
  if (!result || !result.prediction) return null;

  const prediction = result.prediction;
  const level = prediction.predicted_esi_level;
  const levelInfo = ESI_LEVELS[level] || ESI_LEVELS[3];
  const probs = prediction.probabilities || [];
  const predictedProbability = probs.find((p) => p.esi_level === level)?.probability;
  const topFeatures = result.explanation?.explanation_status === 'available'
    ? (result.explanation.top_features || [])
    : [];

  const provided = ASSESSMENT_FIELDS.filter((field) => hasValue(submittedPayload?.[field.name]));

  // Whether this assessment was stored. The wording states the fact rather
  // than implying a record exists when it does not.
  const persistenceNote = (() => {
    switch (result.persistence) {
      case 'saved':
        return 'This assessment was saved to your history in this browser.';
      case 'not_configured':
        return 'This assessment was not saved: history storage is not enabled on this deployment.';
      case 'no_owner':
        return 'This assessment was not saved: this browser could not be identified.';
      case 'failed':
        return 'This assessment was not saved: the history store could not be reached.';
      default:
        return null;
    }
  })();
  const missing = missingFields(submittedPayload || {});

  return (
    <div className="space-y-6">
      {/* ── A. Assessment summary ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-surface shadow-sm overflow-hidden">
        <div className="bg-gradient-to-br from-primary/10 via-surface to-surface px-5 sm:px-8 py-7">
          <div className="text-[11px] font-mono text-muted uppercase tracking-wider">
            Your assessment result
          </div>
          <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold tracking-tight text-primary leading-tight">
            ESI {level} · {levelInfo.name}
          </h2>
          <p className="mt-2 text-base text-secondary leading-relaxed max-w-2xl">
            {levelInfo.plain}.
          </p>

          {typeof predictedProbability === 'number' && (
            <p className="mt-4 inline-flex items-center gap-2 text-sm text-secondary rounded-lg bg-surface-soft border border-border px-3 py-2">
              <Info className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
              <span>
                The model gave this estimate{' '}
                <strong className="text-primary">{(predictedProbability * 100).toFixed(0)}%</strong> of its
                confidence. This is a model estimate, not a calibrated clinical probability.
              </span>
            </p>
          )}
        </div>

        <div className="px-5 sm:px-8 py-6 border-t border-border">
          <h3 className="text-sm font-bold text-primary mb-2">About this result</h3>
          <p className="text-sm text-secondary leading-relaxed">
            MedGuard's model estimated this presentation at <strong className="text-primary">ESI {level}</strong>{' '}
            on the Emergency Severity Index scale — a five-level scale used in emergency departments
            to sort people by how urgently they need to be seen.
          </p>
          <p className="text-sm text-secondary leading-relaxed mt-3">
            {levelInfo.detail} The model produced that estimate from the details you submitted. It
            is <strong className="text-primary">an experimental model output, not a clinical
            determination</strong>, and it does not tell you what is wrong or what should be done.
          </p>

          <div className="mt-5 flex items-start gap-3 rounded-xl border border-warning/30 bg-warning-bg/50 p-4">
            <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-sm text-secondary leading-relaxed">
              <strong className="text-warning">This is not a medical assessment.</strong> MedGuard
              is a research prototype trained on synthetic data. It has not been validated for
              clinical decision-making, it may be wrong, and it cannot tell you whether it is safe to
              wait or to stay at home.
            </p>
          </div>
        </div>
      </section>

      {/* ── B. What information was considered? ────────────────────────── */}
      <section className="rounded-2xl border border-border bg-surface shadow-sm p-5 sm:p-7">
        <h2 className="text-lg font-extrabold tracking-tight text-primary">
          What information was considered?
        </h2>

        <div className="mt-5 grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-surface-soft/50 p-4">
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-success" aria-hidden="true" />
              Information included in this assessment
            </h3>
            {provided.length === 0 ? (
              <p className="text-sm text-muted">No details were submitted.</p>
            ) : (
              <dl className="space-y-1.5">
                {provided.map((field) => (
                  <div key={field.name} className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-secondary">{field.label}</dt>
                    <dd className="text-sm font-semibold text-primary tabular-nums">
                      {submittedPayload[field.name]}
                      {field.unit ? <span className="text-[11px] font-normal text-muted ml-1">{field.unit}</span> : null}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface-soft/50 p-4">
            <h3 className="text-sm font-bold text-primary flex items-center gap-2 mb-3">
              <Info className="w-4 h-4 text-info" aria-hidden="true" />
              Some information was not provided
            </h3>
            {missing.all.length === 0 ? (
              <p className="text-sm text-muted">Every field the model accepts was provided.</p>
            ) : (
              <>
                <p className="text-sm text-secondary leading-relaxed mb-3">
                  {missing.all.length} detail{missing.all.length === 1 ? '' : 's'} left blank. For{' '}
                  {missing.all.length === 1 ? 'it' : 'them'} the model used an average from its
                  training data and recorded that the information was missing.
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {missing.all.map((field) => (
                    <li
                      key={field.name}
                      className="text-[11px] px-2 py-1 rounded-full bg-surface border border-border text-secondary"
                    >
                      {field.label}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        {topFeatures.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-surface-soft/50 p-4">
            <h3 className="text-sm font-bold text-primary mb-1">
              Factors the model associated with its prediction
            </h3>
            <p className="text-xs text-muted mb-3 leading-snug">
              These are the details that moved the model's estimate the most. They describe how the
              model behaved, not what caused anything.
            </p>
            <ul className="space-y-1.5">
              {topFeatures.slice(0, 6).map((feature) => (
                <li key={feature.feature} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-secondary">{plainLabel(feature.feature)}</span>
                  <span
                    className={[
                      'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                      feature.shap_value > 0
                        ? 'bg-primary text-primary-contrast'
                        : 'bg-surface-lift text-ink',
                    ].join(' ')}
                  >
                    {feature.shap_value > 0 ? 'pushed this way' : 'pushed the other way'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {persistenceNote && (
          <p className="mt-4 text-[11px] text-muted leading-relaxed">
            {persistenceNote}
          </p>
        )}

        {result.explanation && result.explanation.explanation_status !== 'available' && (
          <p className="mt-4 text-sm text-muted">
            The model could not produce a detailed explanation for this estimate. The result itself
            is unaffected.
          </p>
        )}
      </section>

      {/* ── C. Understanding the result ───────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-surface shadow-sm p-5 sm:p-7">
        <h2 className="text-lg font-extrabold tracking-tight text-primary">Understanding this result</h2>
        <p className="mt-3 text-sm text-secondary leading-relaxed">
          This result comes from an experimental machine-learning model trained on synthetic triage
          data. It has not been validated for clinical decision-making and it may be wrong.
        </p>
        <div className="mt-4 space-y-3">
          <ExpandableExplanation summary="What the model was trained on">
            <p>
              The model was fitted on <strong className="text-primary">Triagegeist</strong>, a
              synthetic dataset of 80,000 fictional emergency-department records. It learned the
              patterns in that made-up data. It has never seen, and was never tested against, real
              patient records.
            </p>
            <p className="mt-2">
              The five ESI levels are all present in that training data, but the rarest level has
              far fewer examples than the most common one, so estimates for that level are the
              least dependable.
            </p>
          </ExpandableExplanation>

          <ExpandableExplanation summary="What the estimate does and does not mean">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>It estimates <em>where on the triage scale</em> this set of details would place a presentation.</li>
              <li>It does <strong className="text-primary">not</strong> diagnose a condition, name a disease, or suggest treatment.</li>
              <li>It does <strong className="text-primary">not</strong> tell you whether waiting is safe.</li>
              <li>The percentages the model produces describe its own confidence; they are not calibrated clinical probabilities.</li>
            </ul>
          </ExpandableExplanation>

          <ExpandableExplanation summary="How missing information affects the result">
            <p>
              When a measurement was not supplied, the model filled it in with an average taken from
              its training data and recorded that the value was missing. A result built partly on
              averages is less reliable than one built on real measurements, which is why the
              missing fields are listed above.
            </p>
          </ExpandableExplanation>
        </div>
      </section>

      {/* ── E. Next actions ───────────────────────────────────────────── */}
      <section className="rounded-2xl border border-border bg-surface shadow-sm p-5 sm:p-7">
        <h2 className="text-lg font-extrabold tracking-tight text-primary">What you can do next</h2>
        <ul className="mt-4 space-y-3">
          <li className="flex items-start gap-3">
            <Stethoscope className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <span className="text-sm text-secondary leading-relaxed">
              <strong className="text-primary">Check the details you entered.</strong> If something was
              recorded incorrectly, correct it and run the assessment again — a different value can
              produce a different estimate.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
            <span className="text-sm text-secondary leading-relaxed">
              <strong className="text-primary">Talk to a qualified healthcare professional.</strong>{' '}
              They can assess the person properly and explain what this result does and does not
              tell you.
            </span>
          </li>
        </ul>

        <div className="mt-5">
          <EmergencyNotice />
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <Link
            to="/assessment"
            className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-contrast text-sm font-semibold px-5 py-3 rounded-xl shadow-md shadow-primary/15 transition"
          >
            Review and correct the details <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            to="/about"
            className="inline-flex items-center gap-2 text-sm font-semibold text-secondary hover:text-primary px-5 py-3 rounded-xl border border-border hover:bg-surface-soft transition"
          >
            About MedGuard
          </Link>
        </div>
      </section>

      {/* ── Technical detail: secondary, on request ───────────────────── */}
      <details className="rounded-2xl border border-border bg-surface-soft/40 p-5 sm:p-6">
        <summary className="cursor-pointer text-sm font-bold text-primary marker:text-muted">
          Technical details
        </summary>
        <dl className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-secondary">Model</dt>
            <dd className="font-mono text-xs text-primary">{result.model_name || 'Triage model'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-secondary">Training data</dt>
            <dd className="font-mono text-xs text-primary">{result.dataset || 'Triagegeist (synthetic)'}</dd>
          </div>
        </dl>
        {result.disclaimer && (
          <p className="mt-4 text-[11px] text-muted leading-relaxed">{result.disclaimer}</p>
        )}
        <p className="mt-3 text-[11px] text-muted leading-relaxed">
          The complete technical breakdown of this prediction — class probabilities, feature
          attribution, input-quality warnings and model metadata — is available in Research Lab.
        </p>
        <Link
          to="/performance"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          Open Research Lab <ArrowRight className="w-3 h-3" aria-hidden="true" />
        </Link>
      </details>
    </div>
  );
}
