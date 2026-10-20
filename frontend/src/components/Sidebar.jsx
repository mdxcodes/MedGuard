import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Menu, X, Shield, Activity, BrainCircuit, BarChart3, BookOpen, Database,
  Waves, ChevronRight, GitCompare, AlertTriangle, Lightbulb, ShieldCheck, FlaskConical,
  LayoutDashboard, FileText, Search, Beaker, PieChart, Settings
} from 'lucide-react';

const NAV_GROUPS = [
  {
    label: 'Workspace',
    items: [
      { label: 'Overview', path: '/', icon: LayoutDashboard },
      { label: 'New Assessment', path: '/assessment', icon: Activity },
      { label: 'Prediction Results', path: '/prediction', icon: BrainCircuit },
    ],
  },
  {
    label: 'Research',
    items: [
      { label: 'Model Performance', path: '/performance', icon: BarChart3 },
      { label: 'Dataset Explorer', path: '/dataset', icon: Database },
      { label: 'Explainability', path: '/explain', icon: Lightbulb },
      { label: 'Error Analysis', path: '/errors', icon: Search },
    ],
  },
  {
    label: 'Advanced Analysis',
    items: [
      { label: 'Scenario Comparison', path: '/compare', icon: GitCompare },
      { label: 'Model Registry', path: '/registry', icon: ShieldCheck },
      { label: 'Experiments', path: '/experiments', icon: Beaker },
      { label: 'Dataset Drift', path: '/drift', icon: PieChart },
      { label: 'Synthetic Benchmark', path: '/triagegeist', icon: FlaskConical },
      { label: 'Methodology', path: '/methodology', icon: Settings },
    ],
  },
];

export default function Sidebar({ open, onClose }) {
  const loc = useLocation();
  const isActive = (p) => loc.pathname === p || (p !== '/' && loc.pathname.startsWith(p));

  return (
    <>
      {open && <div className="fixed inset-0 z-40 md:hidden" onClick={onClose}><div className="fixed inset-0 bg-navy/40 backdrop-blur-sm" /></div>}

      <aside className={`fixed top-0 left-0 z-50 h-full w-[260px] bg-navy-deep text-white flex flex-col shadow-lg transition-transform duration-300 ease-out ${open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Brand */}
        <div className="px-5 pt-7 pb-6 border-b border-white/10">
          <Link to="/" className="flex items-center gap-2.5 group" onClick={onClose}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-soft flex items-center justify-center shadow-lg shadow-primary/20 group-hover:shadow-primary/30 transition">
              <Waves className="w-5 h-5 text-white" />
            </div>
            <div className="leading-none">
              <div className="text-base font-extrabold tracking-tight text-white">MedGuard</div>
              <div className="text-[10px] font-mono text-white/70 mt-0.5 tracking-widest uppercase">Triage One</div>
            </div>
          </Link>
          <div className="mt-3 text-[10px] font-mono text-white/60">Educational research prototype</div>
        </div>

        {/* Navigation groups */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1" aria-label="Primary navigation">
          {NAV_GROUPS.map((group) => (
            <section key={group.label}>
              <h3 className="px-5 py-2 text-[9px] font-mono text-white/60 uppercase tracking-widest font-semibold mb-1">{group.label}</h3>
              {group.items.map(({ label, path, icon: Icon }) => (
                <Link
                  key={path}
                  to={path}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${isActive(path) ? 'bg-surface/10 text-white shadow-inner' : 'text-white/70 hover:text-white hover:bg-surface/5'}`}
                  aria-current={isActive(path) ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{label}</span>
                  {isActive(path) && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />}
                </Link>
              ))}
            </section>
          ))}
        </nav>

        {/* API Status */}
        <div className="mx-3 mb-4 p-3 rounded-xl bg-surface/[0.04] border border-white/10">
          <div className="flex items-center gap-2 text-[10px] font-medium text-white/90 mb-2">
            <Shield className="w-3 h-3.5 text-primary-soft" />
            API Status
          </div>
          <StatusBadge />
        </div>

        {/* Footer */}
        <div className="px-5 py-5 border-t border-white/10 text-[10px] text-white/50 leading-relaxed font-mono">
          Not clinically validated.<br />
          Educational research only.<br />
          ESI labels preserved: 1–5.
        </div>
      </aside>
    </>
  );
}

function StatusBadge() {
  const [status, setStatus] = useState('checking');
  useEffect(() => {
    fetch('/api/health')
      .then(r => r.ok ? setStatus('available') : setStatus('unavailable'))
      .catch(() => setStatus('unavailable'));
  }, []);
  const label = status === 'available' ? 'API available' : status === 'unavailable' ? 'API unavailable' : 'Checking…';
  const dot = status === 'available' ? 'bg-teal' : status === 'unavailable' ? 'bg-rose-500' : 'bg-amber-500';
  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <span className={`w-2 h-2 rounded-full ${dot} shadow-sm`} />
      <span className={status === 'available' ? 'text-teal-soft' : 'text-rose-400'}>
        {label}
      </span>
    </div>
  );
}
