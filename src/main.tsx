import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/report.css';
import './styles/admin.css';
import { ErrorBoundary, FailurePanel, reportClientError } from './report/Failure';

// The condition is a build-time constant, so the hosted build never
// contains the demonstration data (and the demo build never needs a server).
const boot = import.meta.env.VITE_DEMO === '1' ? import('./boot/demo') : import('./boot/hosted');

boot.then(
  ({ Root }) => {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <ErrorBoundary>
          <Root />
        </ErrorBoundary>
      </StrictMode>,
    );
  },
  (error) => {
    // Usually an outdated page after an update: a reload fetches the new files.
    reportClientError(error, 'boot');
    createRoot(document.getElementById('root')!).render(<FailurePanel error={error} />);
  },
);

window.addEventListener('error', (e) => reportClientError(e.error ?? e.message, 'window'));
window.addEventListener('unhandledrejection', (e) => reportClientError(e.reason, 'promise'));
