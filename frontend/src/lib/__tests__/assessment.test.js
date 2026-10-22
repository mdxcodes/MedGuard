import { describe, it, expect } from 'vitest';
import {
  ASSESSMENT_FIELDS,
  API_FIELD_NAMES,
  emptyAssessment,
  hasValue,
  missingFields,
  toApiPayload,
  validateAssessment,
} from '../assessment';

describe('Shared assessment contract', () => {
  it('exposes every field the inference API accepts, and nothing else', () => {
    // These are the fields declared by AssessmentRequest in
    // backend/api/schemas.py. A field that is not in that contract must not
    // appear here, or the frontend would send something the API rejects.
    const expected = [
      'age', 'sex', 'insurance_type', 'chief_complaint_system', 'pain_score',
      'arrival_mode', 'heart_rate', 'respiratory_rate', 'temperature_c',
      'spo2', 'systolic_bp', 'diastolic_bp', 'arrival_hour',
      'num_prior_ed_visits_12m', 'num_active_medications', 'shock_index',
    ].sort();

    expect([...API_FIELD_NAMES].sort()).toEqual(expected);
  });

  it('starts from an empty assessment with every field blank', () => {
    const values = emptyAssessment();
    expect(Object.keys(values).sort()).toEqual([...API_FIELD_NAMES].sort());
    expect(Object.values(values).every((v) => v === '')).toBe(true);
  });

  it('omits blank fields from the API payload rather than guessing them', () => {
    const payload = toApiPayload({ age: '58', heart_rate: '', spo2: null, pain_score: 6 });
    expect(payload).toEqual({ age: 58, pain_score: 6 });
    expect('heart_rate' in payload).toBe(false);
    expect('spo2' in payload).toBe(false);
  });

  it('converts numeric fields to numbers and keeps categorical fields as strings', () => {
    const payload = toApiPayload({ age: '58', heart_rate: '88.5', sex: 'F' });
    expect(payload.age).toBe(58);
    expect(payload.heart_rate).toBe(88.5);
    expect(payload.sex).toBe('F');
    expect(typeof payload.heart_rate).toBe('number');
  });

  it('rejects a value outside the documented range', () => {
    const errors = validateAssessment({ age: '999', heart_rate: '5', pain_score: 40 });
    expect(errors.age).toBeTruthy();
    expect(errors.heart_rate).toBeTruthy();
    expect(errors.pain_score).toBeTruthy();
  });

  it('accepts a value inside the documented range', () => {
    const errors = validateAssessment({ age: '58', heart_rate: '88', pain_score: 6 });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('treats a blank field as absent rather than invalid', () => {
    const errors = validateAssessment({ age: '', heart_rate: '' });
    expect(Object.keys(errors)).toHaveLength(0);
  });

  it('separates missing clinician-measured fields from self-reported ones', () => {
    const missing = missingFields({ age: '58' });
    expect(missing.selfReported.map((f) => f.name)).not.toContain('heart_rate');
    expect(missing.clinical.map((f) => f.name)).toContain('heart_rate');
    expect(missing.all.length).toBe(API_FIELD_NAMES.length - 1);
  });

  it('recognises which values are usable', () => {
    expect(hasValue(0)).toBe(true);
    expect(hasValue('')).toBe(false);
    expect(hasValue(null)).toBe(false);
    expect(hasValue(undefined)).toBe(false);
    expect(hasValue(NaN)).toBe(false);
  });

  it('marks the fields a clinician would normally measure', () => {
    const clinicianOnly = ASSESSMENT_FIELDS.filter((f) => f.clinicianOnly).map((f) => f.name);
    expect(clinicianOnly).toEqual(
      expect.arrayContaining(['heart_rate', 'respiratory_rate', 'temperature_c', 'spo2', 'systolic_bp', 'diastolic_bp']),
    );
  });
});
