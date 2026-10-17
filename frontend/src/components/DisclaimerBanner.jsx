import { useState } from 'react';
import { Sparkles } from 'lucide-react';

export default function DisclaimerBanner() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return (
    <div className="relative overflow-hidden rounded-xl bg-gradient-to-r from-navy-deep via-navy-soft to-navy-deep text-white shadow-elevated">
      <div className="absolute top-0 right-0 w-64 h-64 bg-teal/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
      <div className="relative px-5 py-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
          <Sparkles className="w-4 h-4 text-teal-soft" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold tracking-tight">Research Prototype — Not Clinically Validated</div>
          <p className="text-xs text-white/60 leading-relaxed mt-0.5">
            MedGuard (Triage One) is an educational demonstration of explainable ML for emergency triage. It does not replace clinical judgment, is not FDA-approved, and must not guide live patient care. All assessments shown are synthetic.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-xs text-white/50 hover:text-white transition font-medium ml-auto"
          aria-label="Dismiss research disclaimer"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
