import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/report.css';
import './styles/admin.css';

// The condition is a build-time constant, so the hosted build never
// contains the demonstration data (and the demo build never needs a server).
const boot = import.meta.env.VITE_DEMO === '1' ? import('./boot/demo') : import('./boot/hosted');

boot.then(({ Root }) => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  );
});
