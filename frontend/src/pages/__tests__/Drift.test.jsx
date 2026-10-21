import { describe, it, expect } from 'vitest';
import drift from '../../../../reports/drift_analysis.json';

describe('drift', () => {
  it('has limited status and note', () => {
    expect(drift.status).toBe('limited');
    expect(drift.note).toMatch(/sampling variation/i);
  });

  it('reports both partitions', () => {
    expect(drift.reference).toBeTruthy();
    expect(drift.comparison).toBeTruthy();
    expect(drift.sample_sizes.ref).toBeGreaterThan(0);
    expect(drift.sample_sizes.comp).toBeGreaterThan(0);
  });
});
