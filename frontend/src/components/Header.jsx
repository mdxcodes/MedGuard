import { useState } from 'react';
import { Menu, Waves } from 'lucide-react';

export default function Header({ onMenu }) {
  const [hover, setHover] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-border-subtle" style={{ borderBottomColor: '#f1f5f9' }}>
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenu}
            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-slate-100 transition text-slate"
            aria-label="Open navigation"
            title="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal to-teal-soft flex items-center justify-center shadow-md shadow-teal/20">
            <Waves className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-extrabold tracking-tight text-navy leading-none">MedGuard</div>
            <div className="text-[10px] font-mono text-text-muted tracking-widest uppercase leading-none mt-0.5">Triage Research</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="/methodology"
            className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-teal transition px-3 py-1.5 rounded-full hover:bg-teal-muted/40"
          >
            Methodology
          </a>
          <div className="h-4 w-px bg-border" />
          <div className="flex items-center gap-2 text-[11px] font-mono text-text-muted bg-slate-50 px-2.5 py-1 rounded-full border border-border-subtle">
            <span className="w-1.5 h-1.5 rounded-full bg-teal shadow-sm shadow-teal/40" />
            Model ready · v0.2.0-demo
          </div>
        </div>
      </div>
    </header>
  );
}
