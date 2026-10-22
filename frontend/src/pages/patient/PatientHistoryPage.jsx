import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  History, ArrowRight, Loader2, Database, AlertTriangle, FileText, Trash2,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';

/**
 * Stored assessment history.
 *
 * The list is served by the backend, which scopes the query to this
 * browser's owner token. Nothing is read from the database directly by the
 * browser, and no record belonging to another visitor can appear here.
 */

function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function summariseInputs(inputs) {
  if (!inputs || typeof inputs !== 'object') return [];
  const labels = {
    heart_rate: 'Heart rate',
    respiratory_rate: 'Breathing rate',
    temperature_c: 'Temperature',
    spo2: 'Oxygen sat.',
    systolic_bp: 'Systolic BP',
    diastolic_bp: 'Diastolic BP',
    pain_score: 'Pain',
    age: 'Age',
    sex: 'Sex',
    arrival_mode: 'Arrival',
    chief_complaint_system: 'Main concern',
  };
  return Object.entries(inputs)
    .filter(([, value]) => value !== null && value !== undefined && value !== '')
    .slice(0, 6)
    .map(([key, value]) => ({ label: labels[key] || key, value }));
}

export default function PatientHistoryPage() {
  const [state, setState] = useState({ status: 'loading', assessments: [], count: 0 });
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading' }));
    try {
      const result = await apiFetch('/api/history?limit=50');
      if (!result.ok) {
        setError(result.error?.message || 'Could not load history.');
        setState({ status: 'error', assessments: [], count: 0 });
        return;
      }
      setError(null);
      setState({
        status: result.data.status,
        assessments: result.data.assessments || [],
        count: result.data.count || 0,
      });
    } catch (exc) {
      setError(exc.message || 'Could not load history.');
      setState({ status: 'error', assessments: [], count: 0 });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <span className="text-[11px] font-mono text-muted uppercase tracking-wider">
          Patient Mode · History
        </span>
        <h1 className="text-3xl font-extrabold tracking-tight text-primary">My assessments</h1>
        <p className="text-sm text-secondary max-w-2xl leading-relaxed">
          Every assessment you complete in this browser is stored so you can look back at it.
          The list is scoped to this browser only — no one else can see it.
        </p>
      </header>

      {state.status === 'loading' && (
        <div className="rounded-2xl border border-border bg-surface p-10 flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-primary animate-spin" aria-hidden="true" />
          <p className="text-sm text-secondary">Loading your assessments…</p>
        </div>
      )}

      {state.status === 'not_configured' && (
        <div className="rounded-2xl border border-warning/30 bg-warning-bg/40 p-6 flex items-start gap-3">
          <Database className="w-5 h-5 text-warning shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-secondary leading-relaxed">
            <strong className="text-warning">History storage is not enabled on this deployment.</strong>
            <p className="mt-1">
              The backend has no database configured, so assessments are not being saved. Predictions
              still work normally — they are simply not kept.
            </p>
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-2xl border border-error/30 bg-error-bg/40 p-6 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-error shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-secondary leading-relaxed">
            <strong className="text-error">History could not be loaded.</strong>
            <p className="mt-1">{error}</p>
            <button
              type="button"
              onClick={load}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
            >
              <Trash2 className="w-3 h-3" aria-hidden="true" /> Try again
            </button>
          </div>
        </div>
      )}

      {state.status === 'ok' && state.assessments.length === 0 && (
        <div className="rounded-2xl border border-border bg-surface p-10 text-center">
          <History className="w-7 h-7 text-muted mx-auto" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-bold text-primary">Nothing stored yet</h2>
          <p className="mt-1.5 text-sm text-secondary max-w-md mx-auto leading-relaxed">
            Assessments you complete will appear here. You have not run one in this browser yet.
          </p>
          <Link
            to="/assessment"
            className="mt-5 inline-flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-contrast font-semibold text-sm px-5 py-3 rounded-xl transition"
          >
            Start an assessment <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      )}

      {state.status === 'ok' && state.assessments.length > 0 && (
        <ul className="space-y-3">
          {state.assessments.map((row) => {
            const inputs = summariseInputs(row.inputs);
            const level = row.predicted_esi_level;
            return (
              <li
                key={row.id}
                className="rounded-2xl border border-border bg-surface p-5 flex flex-col sm:flex-row sm:items-center gap-4"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div
                    className="shrink-0 w-12 h-12 rounded-xl bg-surface-soft border border-border flex flex-col items-center justify-center"
                    aria-hidden="true"
                  >
                    <span className="text-[9px] text-muted leading-none">ESI</span>
                    <span className="text-lg font-extrabold text-primary leading-tight">
                      {level ?? '—'}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-primary truncate">
                      {formatTimestamp(row.created_at)}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted">
                      {inputs.map((item) => (
                        <span key={item.label}>
                          {item.label}: <span className="text-secondary">{String(item.value)}</span>
                        </span>
                      ))}
                    </div>
                    {row.input_warnings > 0 && (
                      <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-warning">
                        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                        {row.input_warnings} input warning{row.input_warnings === 1 ? '' : 's'}
                      </div>
                    )}
                  </div>
                </div>
                <div className="shrink-0 flex items-center gap-3 text-[11px] font-mono text-muted">
                  {row.model_name && (
                    <span className="inline-flex items-center gap-1">
                      <FileText className="w-3 h-3" aria-hidden="true" />
                      {row.model_name}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
