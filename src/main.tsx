import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SiteCampaignBootstrap } from './components/campaigns/SiteCampaignBootstrap';
import './lib/clientFacingMessageGuard';
import './index.css';
import './careers.css';
import './gsa-store.css';
import './supplier-portal.css';
import { captureAffiliateReferralFromLocation } from './features/affiliates/attribution';

captureAffiliateReferralFromLocation();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <SiteCampaignBootstrap />
    </ErrorBoundary>
  </StrictMode>,
);
