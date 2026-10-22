import { BrowserRouter } from 'react-router-dom';
import { ModeProvider } from './app/ModeProvider';
import { AssessmentProvider } from './app/AssessmentProvider';
import { ModelStatusProvider } from './app/ModelStatusProvider';
import AppShell from './app/AppShell';

/**
 * MedGuard — one application, two presentation modes.
 *
 * Patient Mode is the default for a new visitor. Research Lab exposes the
 * full technical workspace. Both modes share the same backend, the same
 * prediction service and the same assessment store; the mode only changes
 * what is rendered.
 */
export default function App() {
  return (
    <BrowserRouter>
      <ModeProvider>
        <AssessmentProvider>
          <ModelStatusProvider>
            {/* Shared nebula background layer, painted behind the app shell so
                every route inherits the same atmospheric texture. */}
            <div className="app-background" />
            <AppShell />
          </ModelStatusProvider>
        </AssessmentProvider>
      </ModeProvider>
    </BrowserRouter>
  );
}
