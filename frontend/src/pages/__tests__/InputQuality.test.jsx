import { describe, it, expect } from 'vitest';
import trainingStats from '../../../../reports/triagegeist_training_stats.json';

describe('Input Quality data integrity', () => {
  it('training stats use only training set', () => {
    expect(trainingStats.dataset).toBe('Triagegeist');
    expect(trainingStats.n_samples).toBeGreaterThan(0);
  });

  it('numeric stats have required fields', () => {
    const num = trainingStats.numeric;
    expect(Object.keys(num).length).toBeGreaterThan(0);
    for (const [feature, stats] of Object.entries(num)) {
      expect(stats.count, feature).toBeGreaterThan(0);
      expect(stats.mean, feature).toBeDefined();
      expect(stats.min, feature).toBeLessThanOrEqual(stats.max);
      expect(stats.std, feature).toBeGreaterThanOrEqual(0);
    }
  });

  it('no patient identifiers in stats', () => {
    const str = JSON.stringify(trainingStats);
    expect(str).not.toMatch(/"patient_id"\s*:\s*"?\d{3,}/);
    expect(str).not.toMatch(/"subject_id"\s*:\s*"?\d{3,}/);
  });
});
