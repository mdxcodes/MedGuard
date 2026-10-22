import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { emptyAssessment } from '../lib/assessment';

/**
 * Shared assessment state.
 *
 * The entered values and the prediction response live here, in memory only.
 * This is what makes the two modes consistent:
 *
 *  - The Patient wizard and the Research form write to the same values.
 *  - The Patient result page and the Research result page read the same
 *    response object.
 *  - Switching modes never discards the entered values or the result, and
 *    never triggers a second prediction.
 *
 * Nothing in this store is persisted. Assessment data is clinical-shaped
 * input, so it stays in the tab's memory and is dropped on reload.
 */

const AssessmentContext = createContext(null);

export function AssessmentProvider({ children }) {
  const [values, setValues] = useState(() => emptyAssessment());
  const [result, setResult] = useState(null);
  const [submittedPayload, setSubmittedPayload] = useState(null);
  const [submittedAt, setSubmittedAt] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const updateValue = useCallback((name, value) => {
    setValues((current) => ({ ...current, [name]: value }));
  }, []);

  const updateMany = useCallback((patch) => {
    setValues((current) => ({ ...current, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setValues(emptyAssessment());
    setResult(null);
    setSubmittedPayload(null);
    setSubmittedAt(null);
    setError(null);
    setSubmitting(false);
  }, []);

  /**
   * Record a completed prediction.
   *
   * The payload and the response are stored together and never separated, so
   * a result page can always state exactly which inputs produced it.
   */
  const recordResult = useCallback((payload, response) => {
    setSubmittedPayload(payload);
    setResult(response);
    setSubmittedAt(new Date().toISOString());
    setError(null);
  }, []);

  const value = useMemo(() => ({
    values,
    result,
    submittedPayload,
    submittedAt,
    error,
    submitting,
    hasResult: Boolean(result && result.prediction),
    updateValue,
    updateMany,
    setValues,
    setResult,
    setSubmittedPayload,
    setSubmittedAt,
    setError,
    setSubmitting,
    recordResult,
    reset,
  }), [
    values, result, submittedPayload, submittedAt, error, submitting,
    updateValue, updateMany, recordResult, reset,
  ]);

  return <AssessmentContext.Provider value={value}>{children}</AssessmentContext.Provider>;
}

export function useAssessment() {
  const context = useContext(AssessmentContext);
  if (!context) {
    throw new Error('useAssessment must be used inside an AssessmentProvider');
  }
  return context;
}
