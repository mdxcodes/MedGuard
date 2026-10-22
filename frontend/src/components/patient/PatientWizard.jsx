import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Loader2, RotateCcw, Stethoscope } from 'lucide-react';
import ProgressSteps from '../ui/ProgressSteps';
import { FormField, MeasurementInput, SelectInput } from '../ui/FormField';
import SyntheticExamples from '../SyntheticExamples';
import { EmergencyNotice } from './PatientNav';
import {
  ASSESSMENT_FIELDS,
  hasValue,
  missingFields,
  validateAssessment,
} from '../../lib/assessment';

/**
 * The Patient Mode assessment wizard.
 *
 * It is a guided presentation over the *same* verified contract the Research
 * Lab form uses: the same field names, the same validation rules, the same
 * API payload. Only the presentation differs — short steps, plain-language
 * labels, and an explicit review before anything is submitted.
 *
 * The entered values live in the shared assessment store, so switching modes
 * mid-way through keeps them.
 */

export const WIZARD_STEPS = [
  { id: 'basics', title: 'Basic information', short: 'Basics' },
  { id: 'feeling', title: 'How the person is feeling', short: 'Symptoms' },
  { id: 'measurements', title: 'Available measurements', short: 'Measurements' },
  { id: 'review', title: 'Review', short: 'Review' },
];

function fieldsForGroup(group) {
  return ASSESSMENT_FIELDS.filter((field) => field.group === group);
}

export default function PatientWizard({ values, errors, onChange, onSubmit, submitting, submitError, onRetry }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = WIZARD_STEPS[stepIndex];
  const isReview = step.id === 'review';

  const missing = useMemo(() => missingFields(values), [values]);
  const entered = useMemo(
    () => ASSESSMENT_FIELDS.filter((field) => hasValue(values[field.name])),
    [values],
  );

  const goNext = () => {
    if (stepIndex < WIZARD_STEPS.length - 1) setStepIndex((index) => index + 1);
  };
  const goBack = () => {
    if (stepIndex > 0) setStepIndex((index) => index - 1);
  };

  return (
    <div className="space-y-6">
      <ProgressSteps
        steps={WIZARD_STEPS.map((s) => ({ id: s.id, label: s.short }))}
        currentIndex={stepIndex}
        onSelectStep={setStepIndex}
        className="rounded-xl border border-border bg-surface px-4 py-3"
      />

      <section
        aria-labelledby="wizard-step-heading"
        className="rounded-2xl border border-border bg-surface shadow-sm p-5 sm:p-7"
      >
        <div className="mb-6">
          <div className="text-[11px] font-mono text-muted uppercase tracking-wider">
            Step {stepIndex + 1} of {WIZARD_STEPS.length}
          </div>
          <h2 id="wizard-step-heading" className="text-xl sm:text-2xl font-extrabold tracking-tight text-primary mt-1">
            {step.title}
          </h2>
          {step.id === 'basics' && (
            <p className="text-sm text-secondary mt-2 leading-relaxed">
              A few details about the person. Leave anything you are unsure about blank — the
              assessment still works, and the result tells you what was missing.
            </p>
          )}
          {step.id === 'feeling' && (
            <p className="text-sm text-secondary mt-2 leading-relaxed">
              The general area of the problem and how much pain there is. This is a description,
              not a diagnosis.
            </p>
          )}
          {step.id === 'measurements' && (
            <p className="text-sm text-secondary mt-2 leading-relaxed">
              These are usually measured by a clinician. If you do not have them, leave them blank
              or ask a clinician to complete them. Nothing is guessed on your behalf.
            </p>
          )}
        </div>

        {isReview ? (
          <ReviewStep
            values={values}
            entered={entered}
            missing={missing}
            onEditStep={setStepIndex}
          />
        ) : (
          <div className="grid sm:grid-cols-2 gap-5">
            {fieldsForGroup(step.id).map((field) => (
              <FormField
                key={field.name}
                id={`p-${field.name}`}
                label={field.label}
                unit={field.unit}
                hint={field.hint}
                error={errors[field.name]}
                optional
                className={field.name === 'chief_complaint_system' || field.name === 'insurance_type' ? 'sm:col-span-2' : ''}
              >
                {(controlProps) =>
                  field.type === 'select' ? (
                    <SelectInput
                      id={`p-${field.name}`}
                      value={values[field.name]}
                      onChange={(value) => onChange(field.name, value)}
                      options={field.options}
                      error={errors[field.name]}
                    />
                  ) : (
                    <MeasurementInput
                      id={`p-${field.name}`}
                      value={values[field.name]}
                      onChange={(value) => onChange(field.name, value)}
                      error={errors[field.name]}
                      min={field.min}
                      max={field.max}
                      step={field.step}
                      placeholder="—"
                    />
                  )
                }
              </FormField>
            ))}
          </div>
        )}

        {/* Errors and submission feedback */}
        {submitError && (
          <div className="mt-6 rounded-xl border border-error/20 bg-error-bg p-4" role="alert">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1">
                <div className="font-semibold text-error">The assessment could not be run</div>
                <p className="text-sm text-secondary mt-1">{submitError}</p>
                {onRetry && (
                  <button
                    type="button"
                    onClick={onRetry}
                    className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline"
                  >
                    <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" /> Try again
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="mt-7 pt-5 border-t border-border flex flex-wrap items-center gap-3">
          {stepIndex > 0 && (
            <button
              type="button"
              onClick={goBack}
              disabled={submitting}
              className="inline-flex items-center gap-2 font-semibold text-sm px-4 py-3 rounded-xl border border-border text-secondary hover:text-primary hover:bg-surface-soft transition disabled:opacity-50"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" /> Back
            </button>
          )}

          {!isReview ? (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-contrast font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-primary/20 transition"
            >
              Continue <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-contrast font-semibold text-sm px-6 py-3 rounded-xl shadow-lg shadow-primary/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Running the assessment…
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" aria-hidden="true" /> See my result
                </>
              )}
            </button>
          )}

          <span className="text-[11px] text-muted ml-auto">
            {entered.length} of {ASSESSMENT_FIELDS.length} details provided
          </span>
        </div>
      </section>

      {/* The demo affordance and the emergency guidance */}
      {stepIndex === 0 && (
        <div className="grid md:grid-cols-2 gap-5">
          <SyntheticExamples
            variant="patient"
            onApply={(sampleValues) => {
              Object.entries(sampleValues).forEach(([key, value]) => onChange(key, value));
            }}
          />
          <div className="space-y-4">
            <EmergencyNotice />
            <div className="rounded-2xl border border-border bg-surface-soft/60 p-5">
              <div className="flex items-start gap-3">
                <Stethoscope className="w-5 h-5 text-primary shrink-0 mt-0.5" aria-hidden="true" />
                <div className="text-sm text-secondary leading-relaxed">
                  <strong className="text-primary">Some fields are clinical.</strong>{' '}
                  Blood pressure, oxygen saturation, temperature, breathing rate and heart rate are
                  normally measured by a clinician. If you do not have them, a clinician can add
                  them, or you can leave them blank — the result will say what was not available.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewStep({ values, entered, missing, onEditStep }) {
  const byGroup = {
    basics: fieldsForGroup('basics'),
    feeling: fieldsForGroup('feeling'),
    measurements: fieldsForGroup('measurements'),
  };

  return (
    <div className="space-y-5">
      {entered.length === 0 ? (
        <div className="rounded-xl border border-warning/30 bg-warning-bg/50 p-4 text-sm text-secondary">
          Nothing has been entered yet. You can still run the assessment, but the model will have
          to work from training averages for every detail.
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(byGroup).map(([group, fields]) => {
            const groupFields = fields.filter((field) => hasValue(values[field.name]));
            if (!groupFields.length) return null;
            const stepIndex = WIZARD_STEPS.findIndex((s) => s.id === group);
            return (
              <div key={group} className="rounded-xl border border-border bg-surface-soft/50 p-4">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h3 className="text-sm font-bold text-primary">
                    {WIZARD_STEPS[stepIndex].title}
                  </h3>
                  <button
                    type="button"
                    onClick={() => onEditStep(stepIndex)}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Edit<span className="sr-only"> {WIZARD_STEPS[stepIndex].title}</span>
                  </button>
                </div>
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-2">
                  {groupFields.map((field) => (
                    <div key={field.name} className="flex items-baseline justify-between gap-3">
                      <dt className="text-sm text-secondary">{field.label}</dt>
                      <dd className="text-sm font-semibold text-primary tabular-nums">
                        {values[field.name]}
                        {field.unit ? <span className="text-[11px] font-normal text-muted ml-1">{field.unit}</span> : null}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
        </div>
      )}

      {missing.all.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <h3 className="text-sm font-bold text-primary mb-2">Not provided</h3>
          <p className="text-sm text-secondary mb-3 leading-relaxed">
            {missing.all.length} detail{missing.all.length === 1 ? '' : 's'} {missing.all.length === 1 ? 'is' : 'are'} not
            provided. The model fills {missing.all.length === 1 ? 'it' : 'them'} with an average from its
            training data and records that the information was absent, which lowers how much the
            result can be trusted.
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {missing.all.map((field) => (
              <li
                key={field.name}
                className="text-[11px] px-2 py-1 rounded-full bg-surface-soft border border-border text-secondary"
              >
                {field.label}
                {field.clinicianOnly && <span className="text-muted"> · clinical</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
