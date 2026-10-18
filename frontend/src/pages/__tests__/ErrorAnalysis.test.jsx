import { describe, it, expect } from 'vitest';
import errorData from '../../../../reports/evaluation_errors.json';

describe('Error Analysis data integrity', () => {
  it('has no patient identifiers', () => {
    const recs = errorData.records;
    if (recs.length > 0) {
      const keys = Object.keys(recs[0]);
      expect(keys).not.toContain('subject_id');
      expect(keys).not.toContain('stay_id');
      expect(keys).not.toContain('patient_id');
      expect(keys).not.toContain('visit_id');
    }
    expect(errorData.n_samples).toBeGreaterThan(0);
  });

  it('uses patient-grouped out-of-fold protocol', () => {
    const recs = errorData.records;
    if (recs.length > 0) {
      expect(recs[0].evaluation_protocol).toBe('patient_grouped_5fold_cv_out_of_fold');
      expect(recs[0].fold).toBeGreaterThanOrEqual(0);
    }
  });

  it('correctly categorizes errors', () => {
    const recs = errorData.records.filter(r => r.is_misclassified);
    recs.forEach(r => {
      expect(r.error_category).toBeTruthy();
      const diff = Math.abs(r.true_label - r.pred_label);
      if (diff === 1) expect(r.error_category).toBe('adjacent');
      if (diff > 1) expect(r.error_category).toBe('multi_level');
    });
  });

  it('has valid probability ranges', () => {
    const recs = errorData.records.slice(0, 10);
    recs.forEach(r => {
      expect(r.max_prob).toBeGreaterThanOrEqual(0);
      expect(r.max_prob).toBeLessThanOrEqual(1);
      expect(r.prob_true).toBeGreaterThanOrEqual(0);
      expect(r.prob_true).toBeLessThanOrEqual(1);
      expect(r.prob_pred).toBeGreaterThanOrEqual(0);
      expect(r.prob_pred).toBeLessThanOrEqual(1);
    });
  });
});
