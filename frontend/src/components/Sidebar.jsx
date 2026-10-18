import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu, X, Shield, Activity, BrainCircuit, BarChart3, BookOpen, Database,
  Waves, ChevronRight, GitCompare, AlertTriangle, Lightbulb, ShieldCheck, FlaskConical
} from 'lucide-react';

const navItems = [
  { label: 'Overview', path: '/', icon: Waves },
  { label: 'Assessment', path: '/assessment', icon: Activity },
  { label: 'Prediction', path: '/prediction', icon: BrainCircuit },
  { label: 'Performance', path: '/performance', icon: BarChart3 },
  { label: 'Dataset', path: '/dataset', icon: Database },
  { label: 'Methodology', path: '/methodology', icon: BookOpen },
];

export default function Sidebar({ open, onClose }) {
  const loc = useLocation();
  const isActive = (p) => loc.pathname === p || (p !== '/' && loc.pathname.startsWith(p));

  return (
    <>
      {/* Mobile overlay */}
      {open && <div className="fixed inset-0 bg-navy/30 z-40 md:hidden" onClick={onClose} />}

      <aside className={`fixed top-0 left-0 z-50 h-full w-[260px] bg-navy-deep text-white flex flex-col shadow-2xl transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Header */}
        <div className="px-5 pt-6 pb-4">
          <Link to="/" className="flex items-center gap-2.5 group" onClick={onClose}>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal to-teal-soft flex items-center justify-center shadow-md shadow-teal/20 group-hover:shadow-teal/40 transition">
              <Waves className="w-5 h-5 text-white" />
            </div>
            <div className="leading-none">
              <div className="text-base font-extrabold tracking-tight">MedGuard</div>
              <div className="text-[10px] font-mono text-white/50 mt-0.5 tracking-widest uppercase">Triage One</div>
            </div>
          </Link>
          <div className="mt-3 text-[11px] font-mono text-white/40">Research prototype · v0.2.0</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-0.5" aria-label="Primary">
          {navItems.map(({ label, path, icon: Icon }) => (
            <Link
              key={path}
              to={path}
              onClick={onClose}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${isActive(path) ? 'bg-white/10 text-white shadow-inner' : 'text-white/70 hover:text-white hover:bg-white/5'}`}
              aria-current={isActive(path) ? 'page' : undefined}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
              {isActive(path) && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
            </Link>
          ))}
        </nav>

        {/* Status area */}
        <div className="mx-3 mb-3 p-3 rounded-xl bg-white/[0.05] border border-white/10">
          <div className="flex items-center gap-2 text-[11px] font-medium text-white/90 mb-2">
            <Shield className="w-3.5 h-3.5 text-teal-soft" />
            API Status
          </div>
          <StatusBadge />
          <div className="text-[10px] text-white/40 mt-1 font-mono">Real FastAPI · /health · /model-info</div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-white/10 text-[10px] text-white/30 leading-relaxed font-mono">
          Not clinically validated. Educational research only.
          <br />ESI labels preserved: 1–5.
        </div>
      </aside>
    </>
  );
}

function StatusBadge() {
  const [status, setStatus] = useState('checking');
  useEffect(() => {
    fetch('/api/health').then(r => r.ok ? setStatus('available') : setStatus('error'))
      .catch(() => setStatus('unavailable'));
  }, []);
  const label = status === 'available' ? 'API available' : status === 'unavailable' ? 'API unavailable' : 'Checking...';
  const dot = status === 'available' ? 'bg-teal' : status === 'unavailable' ? 'bg-rose-400' : 'bg-amber-400';
  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <span className={`w-2 h-2 rounded-full ${dot} shadow-sm`} />
      <span className={status === 'available' ? 'text-teal-soft' : 'text-rose-300'}>{label}</span>
    </div>
  );
}
