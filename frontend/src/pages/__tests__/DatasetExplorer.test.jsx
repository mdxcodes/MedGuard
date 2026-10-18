import { describe, it, expect } from 'vitest';
import dataQuality from '../../../../reports/data_quality_report.json';
import modelEval from '../../../../reports/model_evaluation.json';

describe('Dataset Explorer data integrity', () => {
  it('uses only aggregated, non-PII report data', () => {
    expect(dataQuality).toBeDefined();
    expect(modelEval).toBeDefined();
    expect(dataQuality.label_distribution).toBeDefined();
    expect(dataQuality.missing_percent).toBeDefined();
    expect(dataQuality.feature_stats).toBeDefined();
  });

  it('preserves class imbalance structure', () => {
    const dist = dataQuality.label_distribution;
    expect(dist['ESI 1']).toBeDefined();
    expect(dist['ESI 2']).toBeDefined();
    expect(dist['ESI 3']).toBeDefined();
    expect(dist['ESI 4']).toBeDefined();
    expect(typeof dist['ESI 4']).toBe('number');
    // ESI 5 absent in labeled modeling set - must not be invented
    expect(dist['ESI 5']).toBeUndefined();
  });

  it('missingness values are percentages in valid range', () => {
    const missing = dataQuality.missing_percent;
    Object.values(missing).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});
