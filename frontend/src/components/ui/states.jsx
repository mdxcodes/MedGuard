import React from 'react';
import { Loader2 } from 'lucide-react';

/* ── Loading state ── */
export function LoadingState({ message = 'Loading…', className = '' }) {
  return (
    <div className={`max-w-5xl mx-auto py-12 text-center ${className}`} aria-busy="true">
      <div className="flex items-center justify-center gap-2.5 text-sm font-medium text-secondary">
        <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
        <span>{message}</span>
      </div>
    </div>
  );
}

/* ── Empty state ── */
export function EmptyState({ title, subtitle, icon: Icon, action }) {
  return (
    <div className="max-w-5xl mx-auto py-12 text-center" aria-label={title}>
      {Icon && <Icon className="mx-auto w-10 h-10 text-muted mb-4" />}
      <h3 className="text-lg font-semibold text-primary">{title}</h3>
      {subtitle && <p className="text-sm text-muted mt-2 max-w-md mx-auto">{subtitle}</p>}
      {action && (
        <button
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-primary hover:bg-primary-soft px-4 py-2 rounded-md transition border border-border"
          {...action.props}
        >
          {action.props.children}
        </button>
      )}
    </div>
  );
}

/* ── Unavailable state ── */
export function UnavailableState({ title, subtitle, hint }) {
  return (
    <div className="max-w-5xl mx-auto py-12 text-center" aria-label={title}>
      <div className="mx-auto w-10 h-10 rounded-lg text-muted bg-surface-soft flex items-center justify-center">
        <span className="text-[20px]">⚠️</span>
      </div>
      <h3 className="text-lg font-semibold text-primary mt-4">{title}</h3>
      {subtitle && <p className="text-sm text-muted mt-2 max-w-md mx-auto">{subtitle}</p>}
      {hint && (
        <div className="mt-6 rounded-lg text-muted bg-surface-soft border border-border p-4 text-xs font-mono max-w-md mx-auto">
          {hint}
        </div>
      )}
    </div>
  );
}

/* ── Error state ── */
export function ErrorState({ title, message, onRetry, retryLabel = 'Try again' }) {
  return (
    <div className="max-w-5xl mx-auto py-12 text-center" aria-label={title}>
      <div className="mx-auto w-10 h-10 rounded-lg text-error bg-error-bg flex items-center justify-center">
        <span className="text-[20px]">💥</span>
      </div>
      <h3 className="text-lg font-semibold text-error mt-4">{title}</h3>
      {message && <p className="text-sm text-secondary mt-2 max-w-md mx-auto">{message}</p>}
      {onRetry && (
        <button
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-md transition"
          onClick={onRetry}
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}

/* ── Page shell wrapper ── */
export function PageShell({ children, title, subtitle, breadcrumb }) {
  return (
    <div className="space-y-8">
      {title && (
        <header className="space-y-2">
          {breadcrumb && <span className="text-[11px] font-mono text-muted uppercase tracking-wider">{breadcrumb}</span>}
          <h1 className="text-3xl font-extrabold tracking-tight text-primary">{title}</h1>
          {subtitle && <p className="text-sm text-secondary max-w-3xl">{subtitle}</p>}
        </header>
      )}
      {children}
    </div>
  );
}

/* ── Section card ── */
export function SectionCard({ title, children, icon: Icon, badge }) {
  return (
    <section className="rounded-xl border border-border bg-surface shadow-sm">
      {title && (
        <div className="px-6 py-4 border-b border-border bg-surface-soft">
          <div className="flex items-center gap-2">
            {Icon && React.isValidElement(Icon) ? (
              <span className="flex items-center">{Icon}</span>
            ) : Icon ? (
              <Icon className="w-4 h-4 text-primary" />
            ) : null}
            <h3 className="text-sm font-bold text-primary tracking-tight">{title}</h3>
            {badge && <span className="ml-auto text-[10px] font-mono text-muted uppercase tracking-wider">{badge}</span>}
          </div>
        </div>
      )}
      <div className="p-6">{children}</div>
    </section>
  );
}

/* ── Stat metric ── */
export function StatMetric({ value, label, subtitle, tone = 'primary' }) {
  const toneClass = {
    primary: 'text-primary',
    warning: 'text-warning',
    error: 'text-error',
    success: 'text-success',
    info: 'text-info',
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-[10px] font-mono text-muted uppercase tracking-wider mb-1">{label}</div>
      <div className="text-2xl font-extrabold tracking-tight text-primary">{value}</div>
      {subtitle && <div className="text-[11px] text-muted mt-1 font-mono">{subtitle}</div>}
    </div>
  );
}
