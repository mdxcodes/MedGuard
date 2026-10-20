import { Beaker, Waves } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-surface py-8">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="border-t border-border pt-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary-soft flex items-center justify-center">
              <Waves className="w-4 h-4 text-white" />
            </div>
            <div className="leading-none">
              <div className="text-sm font-extrabold tracking-tight text-primary">MedGuard</div>
              <div className="text-[9px] font-mono text-muted tracking-widest uppercase mt-0.5">Triage One</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-mono text-muted">
            <span>Educational research prototype</span>
            <span>·</span>
            <span>Not clinically validated</span>
            <span>·</span>
            <span>ESI labels: 1–5</span>
            <span>·</span>
            <span>MIMIC-IV-ED v2.2 demo</span>
          </div>
        </div>
        <div className="mt-6 md:mt-0 text-[9px] font-mono text-muted">
          MedGuard (Triage One) is an educational demonstration of explainable ML for emergency triage acuity.
          It does not replace clinical judgment and must not guide live patient care.
        </div>
      </div>
    </footer>
  );
}
