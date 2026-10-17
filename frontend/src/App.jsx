import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import OverviewPage from './pages/OverviewPage';
import AssessmentPage from './pages/AssessmentPage';
import PredictionPage from './pages/PredictionPage';
import PerformancePage from './pages/PerformancePage';
import MethodologyPage from './pages/MethodologyPage';
import { useState } from 'react';

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-surface flex">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 md:ml-[260px] min-w-0">
          <Header onMenu={() => setSidebarOpen(o => !o)} />
          <main role="main" className="max-w-7xl mx-auto px-5 md:px-8 py-8 md:py-10">
            <Routes>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/assessment" element={<AssessmentPage />} />
              <Route path="/prediction" element={<PredictionPage />} />
              <Route path="/performance" element={<PerformancePage />} />
              <Route path="/methodology" element={<MethodologyPage />} />
            </Routes>
          </main>

          {/* Minimal footer */}
          <footer className="max-w-7xl mx-auto px-5 md:px-8 py-6 border-t border-border-subtle mt-auto">
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-text-muted font-mono">
              <span>MedGuard · Triage One</span>
              <span>·</span>
              <span>v0.2.0-demo</span>
              <span>·</span>
              <span>Educational research prototype</span>
              <span>·</span>
              <span>Not clinically validated</span>
            </div>
          </footer>
        </div>
      </div>
    </BrowserRouter>
  );
}
