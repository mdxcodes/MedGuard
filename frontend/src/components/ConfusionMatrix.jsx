import React from 'react';

export default function ConfusionMatrix({
  title = 'Confusion Matrix (CV Aggregate)',
  subtitle = 'True labels (rows) vs Predicted labels (columns)',
  matrix,
  labels = ['ESI 1', 'ESI 2', 'ESI 3', 'ESI 4', 'ESI 5'],
}) {
  if (!matrix || !Array.isArray(matrix)) return null;

  // Compute max for normalization
  let max = 0;
  matrix.forEach(row => {
    row.forEach(v => {
      if (v > max) max = v;
    });
  });

  const getCellColor = (value, isDiagonal) => {
    if (max === 0) return 'bg-surface-soft';
    const intensity = value / max;
    if (isDiagonal) return `bg-primary/${Math.round(intensity * 40)}`;
    return `bg-error/${Math.round(intensity * 20)}`;
  };

  const getTextColor = () => 'text-primary-contrast';

  return (
    <div className="bg-surface rounded-2xl border border-border shadow-card p-6">
      <div className="mb-4">
        <h3 className="text-base font-bold text-primary tracking-tight">{title}</h3>
        {subtitle && (
          <p className="text-xs text-muted mt-1 font-mono">{subtitle}</p>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-xs font-mono text-muted font-medium"></th>
              {labels.map(label => (
                <th
                  key={`col-${label}`}
                  className="p-2 text-xs font-mono text-muted font-medium text-center"
                >
                  Pred {label.replace('ESI ', '')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row, i) => (
              <tr key={`row-${i}`}>
                <th className="p-2 text-xs font-mono text-muted font-medium whitespace-nowrap">
                  True {labels[i].replace('ESI ', '')}
                </th>
                {row.map((value, j) => {
                  const isDiagonal = i === j;
                  return (
                    <td key={`cell-${i}-${j}`} className="p-1">
                      <div
                        className={`flex items-center justify-center h-10 w-full rounded-md border border-border-subtle transition ${getCellColor(
                          value,
                          isDiagonal
                        )}`}
                      >
                        <span
                          className={`text-sm font-mono font-semibold ${getTextColor(
                            value,
                            isDiagonal
                          )}`}
                        >
                          {value}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center gap-4 text-[11px] text-muted">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-primary/60 border border-border-subtle"></div>
            <span>Correct (diagonal)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-error/40 border border-border-subtle"></div>
            <span>Misclassified</span>
          </div>
        <div className="ml-auto font-mono">
          Total: {matrix.reduce((sum, row) => sum + row.reduce((a, b) => a + b, 0), 0)}
        </div>
      </div>
    </div>
  );
}
