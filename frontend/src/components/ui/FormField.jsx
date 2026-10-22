import { AlertCircle, ChevronDown } from 'lucide-react';

/**
 * Shared form primitives.
 *
 * The Research Lab form and the Patient Mode wizard both build on these, so
 * label/control/error markup lives in one place. The visual treatment comes
 * from the design tokens, which the patient scope re-points — so the same
 * component reads as "research" in the dark shell and as "calm" in the light
 * one without a second implementation.
 */

const baseControl =
  'w-full px-3 py-3 rounded-lg border text-sm font-medium transition bg-surface ' +
  'focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:border-primary';

const normalControl = 'border-border hover:border-secondary/40';
const errorControl = 'border-error bg-error-bg/30';

export function controlClass(error) {
  return `${baseControl} ${error ? errorControl : normalControl}`;
}

export const selectControlClass = (error) =>
  // The chevron is a separate element rather than a background image: an
  // arbitrary `bg-[url(data:image/svg+xml,…)]` value cannot be parsed by the
  // Tailwind scanner, so it silently produced no arrow at all.
  `${controlClass(error)} appearance-none pr-9`;

/** The validation message shown beneath a control. */
export function ValidationMessage({ id, children }) {
  if (!children) return null;
  return (
    <div id={id} className="text-[11px] text-error mt-1.5 flex items-start gap-1">
      <AlertCircle className="w-3 h-3 mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

/**
 * A labelled control with unit, hint and validation message.
 *
 * `render` receives the props that must land on the input element, so the
 * caller controls the element type without repeating the label plumbing.
 */
export function FormField({
  id,
  label,
  unit,
  hint,
  error,
  required,
  optional,
  children,
  className = '',
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-err` : undefined;
  return (
    <div className={className}>
      <div className="flex items-baseline gap-1.5 mb-1.5 flex-wrap">
        <label htmlFor={id} className="text-xs font-semibold text-secondary">
          {label}
        </label>
        {unit && <span className="text-[10px] font-mono text-muted">{unit}</span>}
        {required && (
          <span className="text-[10px] text-muted">
            <span aria-hidden="true">*</span>
            <span className="sr-only"> (required)</span>
          </span>
        )}
        {optional && <span className="text-[10px] text-muted">optional</span>}
      </div>
      {children({ 'aria-invalid': Boolean(error), 'aria-describedby': errorId || hintId })}
      <ValidationMessage id={errorId}>{error}</ValidationMessage>
      {hint && !error && (
        <div id={hintId} className="text-[11px] text-muted mt-1.5 leading-snug">
          {hint}
        </div>
      )}
    </div>
  );
}

/** A numeric measurement input with an optional unit suffix. */
export function MeasurementInput({ id, value, onChange, error, placeholder, min, max, step = 0.1, inputMode = 'decimal' }) {
  return (
    <input
      id={id}
      type="number"
      inputMode={inputMode}
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={controlClass(error)}
      placeholder={placeholder}
    />
  );
}

/** A select input with a neutral placeholder option. */
export function SelectInput({ id, value, onChange, error, options, placeholder = 'Select…' }) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={selectControlClass(error)}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        aria-hidden="true"
      />
    </div>
  );
}
