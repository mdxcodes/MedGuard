import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useMode } from './ModeProvider';
import ModeTransition from '../components/mode-switcher/ModeTransition';
import ResearchSidebar from '../components/research/ResearchSidebar';
import Header from '../components/Header';
import Footer from '../components/Footer';
import PatientLayout from '../components/patient/PatientLayout';
import ErrorBoundary from '../components/ErrorBoundary';

import PatientHomePage from '../pages/patient/PatientHomePage';
import PatientAssessmentPage from '../pages/patient/PatientAssessmentPage';
import PatientResultPage from '../pages/patient/PatientResultPage';
import PatientAboutPage from '../pages/patient/PatientAboutPage';
import PatientHistoryPage from '../pages/patient/PatientHistoryPage';

import OverviewPage from '../pages/OverviewPage';
import AssessmentPage from '../pages/AssessmentPage';
import PredictionPage from '../pages/PredictionPage';
import PerformancePage from '../pages/PerformancePage';
import MethodologyPage from '../pages/MethodologyPage';
import DatasetExplorerPage from '../pages/DatasetExplorerPage';
import ScenarioComparisonPage from '../pages/ScenarioComparisonPage';
import ErrorAnalysisPage from '../pages/ErrorAnalysisPage';
import ExplainabilityPage from '../pages/ExplainabilityPage';
import ModelRegistryPage from '../pages/ModelRegistryPage';
import ExperimentPage from '../pages/ExperimentPage';
import DriftPage from '../pages/DriftPage';
import SyntheticBenchmarkPage from '../pages/SyntheticBenchmarkPage';
import NotFoundPage from '../pages/NotFoundPage';

import { MODE_RESEARCH } from '../lib/modeStorage';
import { LEGACY_REDIRECTS, destinationForMode, modeForPath } from '../lib/modeRoutes';

const wrap = (Component) => function Wrapped() {
  return (
    <ErrorBoundary>
      <Component />
    </ErrorBoundary>
  );
};

const WrappedOverview = wrap(OverviewPage);
const WrappedAssessment = wrap(AssessmentPage);
const WrappedPrediction = wrap(PredictionPage);
const WrappedPerformance = wrap(PerformancePage);
const WrappedMethodology = wrap(MethodologyPage);
const WrappedDataset = wrap(DatasetExplorerPage);
const WrappedScenario = wrap(ScenarioComparisonPage);
const WrappedErrorAnalysis = wrap(ErrorAnalysisPage);
const WrappedExplainability = wrap(ExplainabilityPage);
const WrappedModelRegistry = wrap(ModelRegistryPage);
const WrappedExperiments = wrap(ExperimentPage);
const WrappedDrift = wrap(DriftPage);
const WrappedSyntheticBenchmark = wrap(SyntheticBenchmarkPage);

const WrappedPatientHome = wrap(PatientHomePage);
const WrappedPatientAssessment = wrap(PatientAssessmentPage);
const WrappedPatientResult = wrap(PatientResultPage);
const WrappedPatientAbout = wrap(PatientAboutPage);
const WrappedPatientHistory = wrap(PatientHistoryPage);
const WrappedNotFound = wrap(NotFoundPage);

/**
 * The application shell.
 *
 * One shell, two presentations. The mode decides which chrome is rendered —
 * a narrow, calm column for Patient Mode, the full research workspace with
 * its sidebar for Research Lab — while the routes, the API client and the
 * prediction service stay exactly the same.
 */
export default function AppShell() {
  const { mode, setModeImmediately, transitioning } = useMode();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const mainRef = useRef(null);

  // The mode as of the previous render, so a change can be detected without
  // reacting to unrelated re-renders.
  const modeRef = useRef(mode);
  const previousModeRef = useRef(mode);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  /**
   * A direct URL that belongs to Research Lab must never render inside the
   * patient shell. When the *path* changes to a research-only route, the
   * mode is switched to match.
   *
   * This deliberately keys on the pathname only: a mode the visitor chose
   * themselves must not be undone by this effect.
   */
  useEffect(() => {
    const required = modeForPath(location.pathname);
    if (required && required !== modeRef.current) {
      setModeImmediately(required);
    }
  }, [location.pathname, setModeImmediately]);

  /**
   * When the mode changes, move to the destination that exists in the new
   * mode. A research-only page has no patient equivalent, so the visitor is
   * returned to the patient home rather than dropped on a page that does not
   * exist there.
   */
  useEffect(() => {
    if (previousModeRef.current === mode) return;
    previousModeRef.current = mode;
    const destination = destinationForMode(location.pathname, mode);
    if (destination !== location.pathname) {
      navigate(destination, { replace: true });
    }
  }, [mode, location.pathname, navigate]);

  // Close the mobile sidebar whenever the route changes.
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  /**
   * Move focus to the main region after a route change so a keyboard user
   * starts the new page rather than continuing from the previous one.
   */
  useEffect(() => {
    const main = mainRef.current;
    if (main) main.focus({ preventScroll: true });
  }, [location.pathname, location.hash]);

  const isResearch = mode === MODE_RESEARCH;

  return (
    <>
      {isResearch ? (
        <div className="min-h-screen bg-page flex flex-col">
          <ResearchSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 flex flex-col md:ml-[268px]">
            <Header onMenu={() => setSidebarOpen((open) => !open)} />
            <main
              ref={mainRef}
              role="main"
              tabIndex={-1}
              className={`flex-1 max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10 w-full ${
                transitioning ? '' : 'mg-shell-enter'
              }`}
            >
              <ResearchRoutes />
            </main>
            <Footer />
          </div>
        </div>
      ) : (
        <PatientLayout mainRef={mainRef}>
          <div className={transitioning ? '' : 'mg-shell-enter'}>
            <PatientRoutes />
          </div>
        </PatientLayout>
      )}

      {/* The transition layer is presentation only. Wrapped in its own error
          boundary so a failure in the animation can never stop the mode from
          switching. */}
      <ErrorBoundary>
        <ModeTransition />
      </ErrorBoundary>
    </>
  );
}

/** Routes available in Research Lab. */
function ResearchRoutes() {
  const location = useLocation();
  const legacy = LEGACY_REDIRECTS[location.pathname];
  if (legacy) return <Navigate to={legacy} replace />;

  return (
    <Routes>
      <Route path="/" element={<WrappedOverview />} />
      <Route path="/assessment" element={<WrappedAssessment />} />
      <Route path="/result" element={<WrappedPrediction />} />
      <Route path="/performance" element={<WrappedPerformance />} />
      <Route path="/methodology" element={<WrappedMethodology />} />
      <Route path="/dataset" element={<WrappedDataset />} />
      <Route path="/compare" element={<WrappedScenario />} />
      <Route path="/errors" element={<WrappedErrorAnalysis />} />
      <Route path="/explain" element={<WrappedExplainability />} />
      <Route path="/registry" element={<WrappedModelRegistry />} />
      <Route path="/experiments" element={<WrappedExperiments />} />
      <Route path="/drift" element={<WrappedDrift />} />
      <Route path="/triagegeist" element={<WrappedSyntheticBenchmark />} />
      <Route path="/about" element={<Navigate to="/methodology" replace />} />
      <Route path="*" element={<WrappedNotFound />} />
    </Routes>
  );
}

/** Routes available in Patient Mode. */
function PatientRoutes() {
  const location = useLocation();
  const legacy = LEGACY_REDIRECTS[location.pathname];
  if (legacy) return <Navigate to={legacy} replace />;

  return (
    <Routes>
      <Route path="/" element={<WrappedPatientHome />} />
      <Route path="/assessment" element={<WrappedPatientAssessment />} />
      <Route path="/result" element={<WrappedPatientResult />} />
      <Route path="/about" element={<WrappedPatientAbout />} />
      <Route path="/history" element={<WrappedPatientHistory />} />
      <Route path="*" element={<WrappedNotFound />} />
    </Routes>
  );
}
