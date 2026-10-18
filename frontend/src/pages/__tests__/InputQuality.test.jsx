import { describe, it, expect } from 'vitest';
import trainingStats from '../../../../reports/training_distribution_stats.json';

describe('Input Quality data integrity', () => {
  it('training stats use only training set', () => {
    expect(trainingStats.source).toBe('training_set_patient_grouped');
    expect(trainingStats.n_samples).toBeGreaterThan(0);
  });

  it('numeric stats have required fields', () => {
    const num = trainingStats.numeric;
    if (num.temperature) {
      expect(num.temperature.mean).toBeDefined();
      expect(num.temperature.min).toBeLessThanOrEqual(num.temperature.max);
      expect(num.temperature.std).toBeGreaterThanOrEqual(0);
    }
  });

  it('no patient identifiers in stats', () => {
    const str = JSON.stringify(trainingStats);
    expect(str).not.toMatch(/subject_id/i);
    expect(str).not.toMatch(/stay_id/i);
  });
});
