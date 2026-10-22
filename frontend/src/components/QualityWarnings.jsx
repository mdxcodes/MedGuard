import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export default function QualityWarnings({ quality }) {
  if (!quality || (!quality.has_warnings && !quality.has_errors)) return null;

  const warnings = quality.warnings || [];
  const errors = quality.errors || [];

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <div className="rounded-xl border border-error/20 bg-error-bg p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-error mt-0.5" />
            <div className="space-y-2 flex-1">
              <h4 className="font-semibold text-error">Input Issues</h4>
              {errors.map((w, i) => (
                <div key={i} className="text-sm text-error">
                  <span className="font-medium">{w.code}</span>: {w.message}
                  {w.feature && <span className="text-xs font-mono ml-2">[{w.feature}]</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl border border-warning/20 bg-warning-bg p-4">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-warning mt-0.5" />
            <div className="space-y-2 flex-1">
              <h4 className="font-semibold text-warning">Input Quality &amp; Distribution Warnings</h4>
              <p className="text-xs text-warning">
                These indicate inputs that differ from the training distribution. They do not mean the prediction is invalid—just that caution is warranted. This is a research tool, not a clinical safety check.
              </p>
              {warnings.map((w, i) => (
                <div key={i} className="text-sm text-warning">
                  <span className="font-medium">{w.code}</span>: {w.message}
                  {w.feature && <span className="text-xs font-mono ml-2">[{w.feature}]</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
