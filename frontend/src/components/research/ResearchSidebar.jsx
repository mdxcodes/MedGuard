import { NavLink, useLocation } from 'react-router-dom';
import {
  X, Shield, Activity, BrainCircuit, BarChart3, BookOpen, Database,
  Waves, ChevronRight, GitCompare, AlertTriangle, Lightbulb, ShieldCheck, FlaskConical,
  LayoutDashboard, FileText, Search, Beaker, PieChart, Settings,
} from 'lucide-react';
import useMediaQuery from '../../hooks/useMediaQuery';
import { useModelStatus } from '../../app/ModelStatusProvider';

/**
 * Research Lab navigation.
 *
 * The existing pages are grouped by the kind of question they answer, so a
 * reviewer can find the right tool without scanning a flat list. Every entry
 * points at a page that is actually implemented — a group that has no
 * implemented page is simply absent rather than filled with a placeholder.
 */
export const RESEARCH_NAV = [
  {
    label: 'Overview',
    items: [
      { label: 'Research overview', path: '/', icon: LayoutDashboard, end: true },
    ],
  },
  {
    label: 'Triagegeist Data',
    items: [
      { label: 'Dataset Explorer', path: '/dataset', icon: Database },
      { label: 'Model & dataset status', path: '/triagegeist', icon: FlaskConical },
    ],
  },
  {
    label: 'Model Evaluation',
    items: [
      { label: 'Performance metrics', path: '/performance', icon: BarChart3 },
      { label: 'Scenario comparison', path: '/compare', icon: GitCompare },
    ],
  },
  {
    label: 'Explainability',
    items: [
      { label: 'Global feature importance', path: '/explain', icon: Lightbulb },
      { label: 'Individual prediction', path: '/result', icon: BrainCircuit },
    ],
  },
  {
    label: 'Experiments',
    items: [
      { label: 'Experiment runner', path: '/experiments', icon: Beaker },
      { label: 'Model registry', path: '/registry', icon: ShieldCheck },
    ],
  },
  {
    label: 'Methodology',
    items: [
      { label: 'Data preparation', path: '/methodology#pipeline', icon: Settings },
      { label: 'Validation methodology', path: '/methodology#validation', icon: Shield },
      { label: 'Dataset drift', path: '/drift', icon: PieChart },
      { label: 'Error analysis', path: '/errors', icon: AlertTriangle },
      { label: 'Reproducibility', path: '/methodology#reproducibility', icon: FileText },
      { label: 'Limitations & ethics', path: '/methodology#limitations', icon: AlertTriangle },
    ],
  },
];

export default function ResearchSidebar({ open, onClose }) {
  const loc = useLocation();
  const isWide = useMediaQuery('(min-width: 640px)');
  const [path, hash] = loc.pathname.split('#');

  const isActive = (p) => {
    const [targetPath, targetHash] = p.split('#');
    if (targetHash) return path === targetPath && hash === targetHash;
    return path === targetPath && !hash;
  };

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={onClose}>
          <div className="fixed inset-0 bg-navy/40 backdrop-blur-sm" />
        </div>
      )}

      <aside
        id="research-navigation"
        /* Off-canvas panels must not stay focusable or readable while they
           are hidden, so they are made inert on narrow screens. */
        inert={!isWide && !open ? true : undefined}
        aria-hidden={!isWide && !open ? true : undefined}
        className={`fixed top-0 left-0 z-50 h-full w-[268px] bg-surface text-ink flex flex-col shadow-lg transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand */}
        <div className="px-5 pt-7 pb-6 border-b border-white/10">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5 group">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary-soft flex items-center justify-center shadow-lg shadow-primary/20">
                  <Waves className="w-5 h-5 text-primary-contrast" aria-hidden="true" />
                </div>
                <div className="leading-none">
                  <div className="text-base font-extrabold tracking-tight text-ink">MedGuard</div>
                <div className="text-[10px] font-mono text-secondary mt-0.5 tracking-widest uppercase">
                  Research Lab
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="md:hidden p-1.5 -mr-1.5 rounded-lg hover:bg-surface-lift hover:text-primary-muted text-secondary"
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 text-[10px] font-mono text-secondary">Educational research prototype</div>

          {/* The mode switcher lives in the header at every width, so the
              panel does not carry a second copy of it. */}
        </div>

        {/* Navigation groups */}
        <nav
          className="flex-1 overflow-y-auto px-3 py-3 space-y-3 mg-scroll-dark"
          aria-label="Research navigation"
        >
          {RESEARCH_NAV.map((group) => (
            <section key={group.label}>
              <h3 className="px-5 py-1.5 text-[9px] font-mono text-secondary uppercase tracking-widest font-semibold">
                {group.label}
              </h3>
              <ul className="space-y-0.5">
                {group.items.map(({ label, path: itemPath, icon: Icon, end }) => (
                  <li key={itemPath}>
                  <NavLink
                      to={itemPath}
                      end={end}
                      onClick={onClose}
                      className={({ isActive: active }) =>
                        [
                          'flex items-center gap-3 px-4 py-2 rounded-lg text-[13px] font-medium transition',
                          active
                            ? 'bg-primary text-primary-contrast shadow-sm shadow-primary/20'
                            : 'text-secondary hover:text-primary-contrast hover:bg-surface-lift',
                        ].join(' ')
                      }
                      aria-current={isActive(itemPath) ? 'page' : undefined}
                    >
                      <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                      <span className="truncate">{label}</span>
                      {isActive(itemPath) && <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60 shrink-0" />}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </nav>

        {/* API Status */}
        <div className="mx-3 mb-4 p-3 rounded-xl bg-surface/[0.04] border border-white/10">
          <div className="flex items-center gap-2 text-[10px] font-medium text-ink mb-2">
            <Shield className="w-3 h-3.5 text-primary-muted" aria-hidden="true" />
            API Status
          </div>
          <StatusBadge />
        </div>

        {/* Footer */}
        <div className="px-5 py-5 border-t border-border text-[10px] text-secondary leading-relaxed font-mono">
          Not clinically validated.<br />
          Educational research only.<br />
          ESI labels preserved: 1–5.
        </div>
      </aside>
    </>
  );
}

function StatusBadge() {
  // Shared across modes: polled once per session, so switching modes does
  // not re-issue the health request.
  const { apiStatus, modelStatus } = useModelStatus();

  let label = 'Checking…';
  let dot = 'bg-warning/50';
  let tone = 'text-white/80';

  if (apiStatus === 'ok') {
    label = modelStatus === 'ready' ? 'API online · model ready' : 'API online';
    dot = modelStatus === 'ready' ? 'bg-primary' : 'bg-warning/60';
    tone = 'text-white/90';
  } else if (apiStatus === 'error') {
    label = 'API unavailable';
    dot = 'bg-error/60';
    tone = 'text-rose-300';
  }

  return (
    <div className="flex items-center gap-2 text-xs font-medium">
      <span className={`w-2 h-2 rounded-full ${dot} shadow-sm`} />
      <span className={tone}>{label}</span>
    </div>
  );
}
