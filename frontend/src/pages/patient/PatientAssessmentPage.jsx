import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PatientWizard from '../../components/patient/PatientWizard';
import { useAssessment } from '../../app/AssessmentProvider';
import { submitAssessment, toApiPayload, validateAssessment } from '../../lib/assessment';

/**
 * Patient Mode assessment page.
 *
 * The wizard owns the presentation; the values live in the shared assessment
 * store, so a mode switch keeps them. Submitting calls the one shared
 * prediction service, records the response against the payload that produced
 * it, and navigates to the result page.
 */
export default function PatientAssessmentPage() {
  const navigate = useNavigate();
  const { values, updateValue, recordResult, setError, setSubmitting } = useAssessment();
  const [errors, setErrors] = useState({});
  const [submitting, setSubmittingState] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const handleSubmit = async () => {
    const validationErrors = validateAssessment(values);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setSubmitError('Some entries are outside the range the model accepts. Please correct them and try again.');
      return;
    }

    setSubmitting(true);
    setSubmittingState(true);
    setSubmitError(null);
    setError(null);

    const payload = toApiPayload(values);
    const response = await submitAssessment(values);

    if (!response.ok) {
      const message =
        response.error?.message ||
        'The assessment service could not be reached. Check that the backend is running and try again.';
      setSubmitError(message);
      setError(message);
      setSubmitting(false);
      setSubmittingState(false);
      return;
    }

    // The response is stored together with the exact payload that produced it.
    recordResult(payload, response.data);
    setSubmitting(false);
    setSubmittingState(false);
    navigate('/result');
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <span className="text-[11px] font-mono text-muted uppercase tracking-wider">Patient Mode · Assessment</span>
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">New assessment</h1>
        <p className="text-sm text-secondary max-w-2xl leading-relaxed">
          A few short steps. Use fictional or synthetic details — this prototype is not connected
          to any real patient record.
        </p>
      </header>

      <PatientWizard
        values={values}
        errors={errors}
        onChange={(name, value) => {
          updateValue(name, value);
          if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }));
        }}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitError={submitError}
        onRetry={handleSubmit}
      />
    </div>
  );
}
