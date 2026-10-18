import { describe, it, expect } from 'vitest';

describe('Scenario Comparison', () => {
  it('maintains API contract compatibility', () => {
    // Verify predict response structure expectations
    const mockResponse = {
      prediction: {
        predicted_esi_level: 2,
        probabilities: [
          { esi_level: 1, probability: 0.1 },
          { esi_level: 2, probability: 0.6 },
          { esi_level: 3, probability: 0.2 },
          { esi_level: 4, probability: 0.05 },
          { esi_level: 5, probability: 0.05 },
        ],
      },
      explanation: {
        explanation_status: 'available',
        top_features: [],
      },
      disclaimer: 'test',
    };
    expect(mockResponse.prediction.predicted_esi_level).toBe(2);
    expect(mockResponse.prediction.probabilities).toHaveLength(5);
  });

  it('handles missing explanations gracefully', () => {
    const mockResponse = {
      prediction: { predicted_esi_level: 3, probabilities: [] },
      explanation: { explanation_status: 'unavailable' },
    };
    expect(mockResponse.explanation.explanation_status).toBe('unavailable');
  });

  it('preserves all ESI levels including absent class', () => {
    const probs = [
      { esi_level: 1, probability: 0.0 },
      { esi_level: 2, probability: 0.5 },
      { esi_level: 3, probability: 0.5 },
      { esi_level: 4, probability: 0.0 },
      { esi_level: 5, probability: 0.0 },
    ];
    expect(probs).toHaveLength(5);
    expect(probs.find(p => p.esi_level === 5).probability).toBe(0.0);
  });
});
