import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Footer from './components/Footer';
import ErrorBoundary from './components/ErrorBoundary';
import OverviewPage from './pages/OverviewPage';
import AssessmentPage from './pages/AssessmentPage';
import PredictionPage from './pages/PredictionPage';
import PerformancePage from './pages/PerformancePage';
import MethodologyPage from './pages/MethodologyPage';
import DatasetExplorerPage from './pages/DatasetExplorerPage';
import ScenarioComparisonPage from './pages/ScenarioComparisonPage';
import ErrorAnalysisPage from './pages/ErrorAnalysisPage';
import ExplainabilityPage from './pages/ExplainabilityPage';
import ModelRegistryPage from './pages/ModelRegistryPage';
import ExperimentPage from './pages/ExperimentPage';
import DriftPage from './pages/DriftPage';
import SyntheticBenchmarkPage from './pages/SyntheticBenchmarkPage';
import { useState } from 'react';

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

const wrap = (Component) => () => (
  <ErrorBoundary>
    <Component />
  </ErrorBoundary>
);

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

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-page flex flex-col">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 flex flex-col md:ml-[260px]">
          <Header onMenu={() => setSidebarOpen(o => !o)} />
          <main role="main" className="flex-1 max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10 w-full">
            <Routes>
              <Route path="/" element={<WrappedOverview />} />
              <Route path="/assessment" element={<WrappedAssessment />} />
              <Route path="/prediction" element={<WrappedPrediction />} />
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
            </Routes>
          </main>
          <Footer />
        </div>
      </div>
    </BrowserRouter>
  );
}
