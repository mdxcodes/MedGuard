/**
 * Shared assessment contract.
 *
 * This module is the single definition of what an assessment is, how it is
 * validated, and how it is turned into the API request body. Both the
 * Research Lab form and the Patient Mode wizard use it, so the two modes
 * cannot drift apart and cannot submit different payloads.
 *
 * The field list mirrors the verified inference contract in
 * `backend/api/schemas.py` (`AssessmentRequest`). Nothing here invents a
 * model input: if the API does not accept a field, it is not in this file.
 */

import { apiFetch } from './api';

/**
 * @typedef {object} AssessmentField
 * @property {string} name        API field name.
 * @property {string} label       Short label.
 * @property {'number'|'select'} type
 * @property {string} [unit]      Unit shown next to the value.
 * @property {number} [min]
 * @property {number} [max]
 * @property {number} [step]
 * @property {string[]} [options]
 * @property {string} [hint]      Plain-language explanation.
 * @property {boolean} [clinicianOnly]  A clinician would normally supply this.
 * @property {'basics'|'feeling'|'measurements'} group  Patient wizard grouping.
 */

/** @type {AssessmentField[]} */
export const ASSESSMENT_FIELDS = [
  {
    name: 'age',
    label: 'Age',
    type: 'number',
    unit: 'years',
    min: 0,
    max: 120,
    step: 1,
    group: 'basics',
    hint: 'Age in years. Leave blank if you are unsure.',
  },
  {
    name: 'sex',
    label: 'Sex',
    type: 'select',
    options: ['F', 'M', 'Other'],
    group: 'basics',
  },
  {
    name: 'insurance_type',
    label: 'Insurance type',
    type: 'select',
    options: ['public', 'private', 'military', 'none', 'unknown'],
    group: 'basics',
    hint: 'Optional. Used by the model as background context only.',
  },
  {
    name: 'chief_complaint_system',
    label: 'Main concern',
    type: 'select',
    options: [
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
    group: 'feeling',
    hint: 'The general area the problem is about, not a diagnosis.',
  },
  {
    name: 'pain_score',
    label: 'Pain level',
    type: 'number',
    unit: '0–10',
    min: 0,
    max: 10,
    step: 1,
    group: 'feeling',
    hint: '0 means no pain, 10 means the worst pain imaginable.',
  },
  {
    name: 'arrival_mode',
    label: 'How did you arrive?',
    type: 'select',
    options: [
      'walk-in',
      'ambulance',
      'transfer',
      'brought_by_family',
      'police',
      'helicopter',
    ],
    group: 'feeling',
  },
  {
    name: 'heart_rate',
    label: 'Heart rate',
    type: 'number',
    unit: 'bpm',
    min: 20,
    max: 220,
    step: 1,
    group: 'measurements',
    clinicianOnly: true,
    hint: 'Beats per minute. Usually measured by a clinician.',
  },
  {
    name: 'respiratory_rate',
    label: 'Breathing rate',
    type: 'number',
    unit: 'breaths/min',
    min: 4,
    max: 60,
    step: 1,
    group: 'measurements',
    clinicianOnly: true,
    hint: 'Breaths per minute. Usually measured by a clinician.',
  },
  {
    name: 'temperature_c',
    label: 'Temperature',
    type: 'number',
    unit: '°C',
    min: 30,
    max: 42,
    step: 0.1,
    group: 'measurements',
    clinicianOnly: true,
    hint: 'Body temperature in Celsius. A clinician usually measures this.',
  },
  {
    name: 'spo2',
    label: 'Oxygen saturation',
    type: 'number',
    unit: '%',
    min: 50,
    max: 100,
    step: 1,
    group: 'measurements',
    clinicianOnly: true,
    hint: 'Oxygen level in the blood, measured with a fingertip sensor.',
  },
  {
    name: 'systolic_bp',
    label: 'Blood pressure (systolic)',
    type: 'number',
    unit: 'mmHg',
    min: 50,
    max: 250,
    step: 1,
    group: 'measurements',
    clinicianOnly: true,
    hint: 'The upper number. Usually measured by a clinician.',
  },
  {
    name: 'diastolic_bp',
    label: 'Blood pressure (diastolic)',
    type: 'number',
    unit: 'mmHg',
    min: 30,
    max: 150,
    step: 1,
    group: 'measurements',
    clinicianOnly: true,
    hint: 'The lower number. Usually measured by a clinician.',
  },
  {
    name: 'arrival_hour',
    label: 'Hour of arrival',
    type: 'number',
    unit: '0–23',
    min: 0,
    max: 23,
    step: 1,
    group: 'measurements',
    hint: 'The hour the person arrived, on a 24-hour clock.',
  },
  {
    name: 'num_prior_ed_visits_12m',
    label: 'Emergency visits in the last 12 months',
    type: 'number',
    unit: 'visits',
    min: 0,
    max: 50,
    step: 1,
    group: 'measurements',
    hint: 'How many times the person has attended an emergency department in the past year.',
  },
  {
    name: 'num_active_medications',
    label: 'Current medications',
    type: 'number',
    unit: 'medications',
    min: 0,
    max: 30,
    step: 1,
    group: 'measurements',
    hint: 'How many medicines the person takes regularly.',
  },
  {
    name: 'shock_index',
    label: 'Shock index',
    type: 'number',
    unit: 'ratio',
    min: 0,
    max: 10,
    step: 0.01,
    group: 'measurements',
    clinicianOnly: true,
    hint: 'Heart rate divided by systolic blood pressure. A clinician usually calculates this.',
  },
];

export const FIELD_BY_NAME = Object.fromEntries(ASSESSMENT_FIELDS.map((f) => [f.name, f]));

/** Fields a patient can reasonably answer without clinical equipment. */
export const PATIENT_SELF_REPORTABLE = ASSESSMENT_FIELDS.filter((f) => !f.clinicianOnly).map((f) => f.name);

/** Every field the API accepts. */
export const API_FIELD_NAMES = ASSESSMENT_FIELDS.map((f) => f.name);

/** An empty assessment: every field blank. */
export function emptyAssessment() {
  return ASSESSMENT_FIELDS.reduce((acc, field) => {
    acc[field.name] = '';
    return acc;
  }, {});
}

/**
 * True when the field carries a usable value.
 *
 * A non-empty string is always a value: categorical fields such as `sex` or
 * `chief_complaint_system` are not numbers, and treating them as absent
 * would silently drop them from the request body.
 */
export function hasValue(value) {
  if (value === '' || value === null || value === undefined) return false;
  if (typeof value === 'number') return !Number.isNaN(value);
  return true;
}

/**
 * Validate an assessment.
 *
 * @returns {Record<string, string>} field name -> message, for invalid fields.
 */
export function validateAssessment(values) {
  const errors = {};
  for (const field of ASSESSMENT_FIELDS) {
    const raw = values?.[field.name];
    if (!hasValue(raw)) continue; // blank is handled by the missing-information UI
    if (field.type === 'number') {
      const numeric = Number(raw);
      if (Number.isNaN(numeric)) {
        errors[field.name] = 'Enter a number.';
        continue;
      }
      if (field.min !== undefined && numeric < field.min) {
        errors[field.name] = `Must be at least ${field.min}${field.unit ? ` ${field.unit}` : ''}.`;
        continue;
      }
      if (field.max !== undefined && numeric > field.max) {
        errors[field.name] = `Must be at most ${field.max}${field.unit ? ` ${field.unit}` : ''}.`;
      }
    }
  }
  return errors;
}

/**
 * Convert form values into the API request body.
 *
 * Blank fields are omitted entirely — they are never replaced with a guessed
 * value. The backend imputes from its training medians and flags the absence
 * with a missingness indicator, which is the behaviour the data pipeline was
 * designed for.
 */
export function toApiPayload(values) {
  const payload = {};
  for (const field of ASSESSMENT_FIELDS) {
    const raw = values?.[field.name];
    if (!hasValue(raw)) continue;
    payload[field.name] = field.type === 'number' ? Number(raw) : String(raw);
  }
  return payload;
}

/** Fields that were left blank, split by whether a clinician would supply them. */
export function missingFields(values) {
  const missing = ASSESSMENT_FIELDS.filter((f) => !hasValue(values?.[f.name]));
  return {
    all: missing,
    clinical: missing.filter((f) => f.clinicianOnly),
    selfReported: missing.filter((f) => !f.clinicianOnly),
  };
}

/**
 * Submit an assessment to the prediction API.
 *
 * The only place in the frontend that talks to `/predict`. Both modes call
 * this, so there is exactly one prediction service.
 *
 * @returns {Promise<{ok: true, data: object} | {ok: false, error: object}>}
 */
export async function submitAssessment(values) {
  return apiFetch('/api/predict', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toApiPayload(values)),
  });
}
