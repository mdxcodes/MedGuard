/**
 * Route registry.
 *
 * One table maps a URL path to the page that renders it in each mode. Keeping
 * this in a single place avoids scattering `if (mode === 'patient')` checks
 * through unrelated components, and it lets the shell resolve a destination
 * when the user switches modes.
 *
 * Rules encoded here:
 *  - A route may be shared (rendered differently per mode) or mode-specific.
 *  - A mode-specific route always activates its own mode, so a direct URL
 *    never lands a research page inside the patient shell.
 *  - Every route declares a label used by the page header and the nav.
 */

import { MODE_PATIENT, MODE_RESEARCH } from './modeStorage';

export const ROUTES = [
  {
    path: '/',
    label: 'Home',
    patient: { page: 'PatientHomePage' },
    research: { page: 'OverviewPage' },
  },
  {
    path: '/assessment',
    label: 'New Assessment',
    patient: { page: 'PatientAssessmentPage' },
    research: { page: 'AssessmentPage' },
  },
  {
    path: '/result',
    label: 'Assessment Result',
    patient: { page: 'PatientResultPage' },
    research: { page: 'PredictionPage' },
  },
  {
    path: '/about',
    label: 'About MedGuard',
    patient: { page: 'PatientAboutPage' },
    research: { page: 'MethodologyPage' },
  },

  /* ── Research Lab only ───────────────────────────────────────────────── */
  { path: '/performance', label: 'Model Performance', research: { page: 'PerformancePage' } },
  { path: '/dataset', label: 'Dataset Explorer', research: { page: 'DatasetExplorerPage' } },
  { path: '/compare', label: 'Scenario Comparison', research: { page: 'ScenarioComparisonPage' } },
  { path: '/errors', label: 'Error Analysis', research: { page: 'ErrorAnalysisPage' } },
  { path: '/explain', label: 'Explainability', research: { page: 'ExplainabilityPage' } },
  { path: '/registry', label: 'Model Registry', research: { page: 'ModelRegistryPage' } },
  { path: '/experiments', label: 'Experiments', research: { page: 'ExperimentPage' } },
  { path: '/drift', label: 'Dataset Drift', research: { page: 'DriftPage' } },
  { path: '/triagegeist', label: 'Triagegeist Benchmark', research: { page: 'SyntheticBenchmarkPage' } },
  { path: '/methodology', label: 'Methodology', research: { page: 'MethodologyPage' } },
];

/** Legacy path kept working: the old research result URL redirects to /result. */
export const LEGACY_REDIRECTS = {
  '/prediction': '/result',
};

export function findRoute(pathname) {
  return ROUTES.find((route) => route.path === pathname) || null;
}

/**
 * The mode a given path belongs to.
 *
 * A shared path belongs to whichever mode the visitor is currently in. A
 * research-only path always belongs to Research Lab, so a direct URL such as
 * `/explain` activates Research Lab rather than rendering a technical page
 * inside the patient shell.
 */
export function modeForPath(pathname) {
  const route = findRoute(pathname);
  if (!route) return null;
  if (route.patient && route.research) return null; // shared — mode decides
  if (route.research) return MODE_RESEARCH;
  if (route.patient) return MODE_PATIENT;
  return null;
}

/** The page key that renders `pathname` in `mode`, or null when unavailable. */
export function pageForPath(pathname, mode) {
  const route = findRoute(pathname);
  if (!route) return null;
  const entry = mode === MODE_RESEARCH ? route.research : route.patient;
  return entry?.page || null;
}

/**
 * Where a path should send the visitor when the mode changes.
 *
 * Shared paths stay put. A research-only path has no patient equivalent, so
 * the visitor is returned to the patient home rather than being dropped on a
 * page that does not exist in the other mode.
 */
export function destinationForMode(pathname, mode) {
  const route = findRoute(pathname);
  if (!route) return mode === MODE_RESEARCH ? '/' : '/';
  if (mode === MODE_RESEARCH) {
    if (route.research) return route.path;
    return '/';
  }
  if (route.patient) return route.path;
  return '/';
}

/** Routes reachable in a given mode, in registry order. */
export function routesForMode(mode) {
  return ROUTES.filter((route) => Boolean(mode === MODE_RESEARCH ? route.research : route.patient));
}
