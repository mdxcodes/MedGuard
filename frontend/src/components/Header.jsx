import { useState } from 'react';
import { Menu, Waves } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES = {
  '/': 'Overview',
  '/assessment': 'New Assessment',
  '/prediction': 'Prediction Results',
  '/performance': 'Model Performance',
  '/methodology': 'Methodology',
  '/dataset': 'Dataset Explorer',
  '/compare': 'Scenario Comparison',
  '/errors': 'Error Analysis',
  '/explain': 'Explainability',
  '/registry': 'Model Registry',
  '/experiments': 'Experiments',
  '/drift': 'Dataset Drift',
  '/triagegeist': 'Synthetic Benchmark',
};

export default function Header({ onMenu }) {
  const loc = useLocation();
  const pageTitle = PAGE_TITLES[loc.pathname] || '';
  const [hover, setHover] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-surface/90 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onMenu}
            className="md:hidden p-2 -ml-2 rounded-lg hover:bg-surface-soft transition text-secondary"
            aria-label="Open navigation"
            title="Menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-primary-soft flex items-center justify-center shadow-md shadow-primary/20">
            <Waves className="w-4 h-4 text-white" />
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-extrabold tracking-tight text-primary leading-none">MedGuard</div>
            <div className="text-[10px] font-mono text-muted tracking-widest uppercase leading-none mt-0.5">Triage Research</div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {pageTitle && (
            <div className="hidden md:flex items-center gap-1 px-3 py-2 rounded-xl bg-surface-soft border border-border text-xs font-medium text-secondary">
              <span className="text-muted">{pageTitle}</span>
            </div>
          )}
          <div className="h-4 w-px border" />
          <div className="flex items-center gap-2 text-[10px] font-mono text-muted bg-surface-soft px-2.5 py-1 rounded-full border border-border">
            <span className="w-1.5 h-1.5 rounded-full bg-success shadow-sm" />
            <span>Model ready · v0.2.0-demo</span>
          </div>
        </div>
      </div>
    </header>
  );
}
