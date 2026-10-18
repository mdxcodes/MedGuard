import { describe, it, expect } from 'vitest';

function compute_uncertainty_metrics(probs) {
  if (!probs || probs.length === 0) return {max_prob:0, prediction_margin:0, predictive_entropy:0, entropy_norm:0, available:false};
  const p = probs.map(x => Number(x));
  const s = p.reduce((a,b)=>a+b,0);
  const pn = s > 0 && Math.abs(s-1.0)>1e-10 ? p.map(v=>v/s) : p;
  const max_prob = Math.max(...pn);
  const sorted = [...pn].sort((a,b)=>b-a);
  const margin = sorted.length>=2 ? sorted[0]-sorted[1] : max_prob;
  let ent = 0;
  for (let i=0;i<pn.length;i++) {
    if (pn[i] > 1e-18) ent -= pn[i]*Math.log2(pn[i]);
  }
  const ent_norm = pn.length>1 ? ent/Math.log2(pn.length) : 0;
  return {max_prob, prediction_margin:margin, predictive_entropy:ent, entropy_norm:ent_norm, available:true};
}

describe('Uncertainty metrics', () => {
  it('computes correct max prob and margin', () => {
    const res = compute_uncertainty_metrics([0.1, 0.6, 0.2, 0.05, 0.05]);
    expect(res.max_prob).toBeCloseTo(0.6);
    expect(res.prediction_margin).toBeCloseTo(0.4);
    expect(res.available).toBe(true);
  });
  it('computes entropy', () => {
    const res = compute_uncertainty_metrics([0.2, 0.2, 0.2, 0.2, 0.2]);
    expect(res.predictive_entropy).toBeGreaterThan(0);
    expect(res.entropy_norm).toBeCloseTo(1.0);
  });
  it('handles edge cases', () => {
    const res = compute_uncertainty_metrics([1.0, 0, 0, 0, 0]);
    expect(res.max_prob).toBeCloseTo(1.0);
    expect(res.prediction_margin).toBeCloseTo(1.0);
    expect(res.predictive_entropy).toBeCloseTo(0);
  });
  it('normalizes probabilities', () => {
    const res = compute_uncertainty_metrics([2, 4, 4]);
    expect(res.max_prob).toBeCloseTo(0.4);
  });
});
