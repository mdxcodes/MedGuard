import { describe, it, expect } from 'vitest';
import drift from '../../../../reports/drift_analysis.json';

describe('drift', () => {
  it('has limited status and note', () => {
    expect(drift.status).toBe('limited');
    expect(drift.note).toMatch(/insufficient/i);
  });
});
