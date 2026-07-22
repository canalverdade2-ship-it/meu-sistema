import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './lib/clientFacingMessageGuard';
import './index.css';
import { captureAffiliateReferralFromLocation } from './features/affiliates/attribution';

captureAffiliateReferralFromLocation();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
