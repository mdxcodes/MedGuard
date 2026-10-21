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

  it('describes the Triagegeist dataset', () => {
    expect(dataQuality.dataset.name).toBe('Triagegeist');
    expect(modelEval.dataset).toBe('Triagegeist');
  });

  it('preserves all five ESI levels', () => {
    const dist = dataQuality.label_distribution;
    for (const level of ['ESI 1', 'ESI 2', 'ESI 3', 'ESI 4', 'ESI 5']) {
      expect(dist[level], level).toBeDefined();
      expect(typeof dist[level], level).toBe('number');
      expect(dist[level], level).toBeGreaterThan(0);
    }
  });

  it('row counts agree between the quality report and the evaluation', () => {
    const rows = dataQuality.row_counts;
    expect(modelEval.n_rows).toBe(rows.modelling_rows);
    expect(modelEval.n_patients).toBe(rows.modelling_patients);
    // The grouped split partitions the cohort without overlap.
    expect(rows.train_rows + rows.test_rows).toBe(rows.modelling_rows);
    expect(rows.train_patients + rows.test_patients).toBe(rows.modelling_patients);
  });

  it('missingness values are percentages in valid range', () => {
    const missing = dataQuality.missing_percent;
    Object.values(missing).forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });

  it('reports contain no patient identifiers', () => {
    const str = JSON.stringify(dataQuality) + JSON.stringify(modelEval);
    expect(str).not.toMatch(/"patient_id"\s*:\s*"?\d{3,}/);
    expect(str).not.toMatch(/"subject_id"\s*:\s*"?\d{3,}/);
  });
});
