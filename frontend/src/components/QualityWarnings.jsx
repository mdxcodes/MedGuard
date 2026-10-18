import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export default function QualityWarnings({ quality }) {
  if (!quality || (!quality.has_warnings && !quality.has_errors)) return null;

  const warnings = quality.warnings || [];
  const errors = quality.errors || [];

  return (
    <div className="space-y-3">
      {errors.length > 0 && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-rose-700 mt-0.5" />
            <div className="space-y-2 flex-1">
              <h4 className="font-semibold text-rose-900">Input Issues</h4>
              {errors.map((w, i) => (
                <div key={i} className="text-sm text-rose-800">
                  <span className="font-medium">{w.code}</span>: {w.message}
                  {w.feature && <span className="text-xs font-mono ml-2">[{w.feature}]</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-xl bg-amber-50/60 border border-amber-200 p-4">
          <div className="flex items-start gap-2">
            <Info className="w-5 h-5 text-amber-700 mt-0.5" />
            <div className="space-y-2 flex-1">
              <h4 className="font-semibold text-amber-900">Input Quality & Distribution Warnings</h4>
              <p className="text-xs text-amber-800">
                These indicate inputs that differ from the training distribution. They do not mean the prediction is
                invalid—just that caution is warranted. This is a research tool, not a clinical safety check.
              </p>
              {warnings.map((w, i) => (
                <div key={i} className="text-sm text-amber-800">
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
