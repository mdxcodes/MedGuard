import { describe, it, expect } from 'vitest';
import globalShap from '../../../../reports/global_shap.json';

describe('Global SHAP data integrity', () => {
  it('has valid provenance', () => {
    expect(globalShap).toBeDefined();
    expect(globalShap.model).toBe('random_forest');
    expect(globalShap.reference_dataset).toBeDefined();
    expect(globalShap.n_reference_samples).toBeGreaterThan(0);
    expect(Array.isArray(globalShap.feature_importances)).toBe(true);
  });

  it('feature importances are sorted by mean_abs_shap desc', () => {
    const imps = globalShap.feature_importances;
    for (let i = 1; i < imps.length; i++) {
      expect(imps[i-1].mean_abs_shap >= imps[i].mean_abs_shap - 1e-10).toBe(true);
    }
  });

  it('mean_abs_shap values are non-negative', () => {
    globalShap.feature_importances.slice(0, 10).forEach(f => {
      expect(f.mean_abs_shap).toBeGreaterThanOrEqual(0);
    });
  });

  it('no patient identifiers in global SHAP', () => {
    const str = JSON.stringify(globalShap);
    expect(str).not.toMatch(/subject_id/i);
    expect(str).not.toMatch(/stay_id/i);
    expect(str).not.toMatch(/patient_id/i);
  });
});
