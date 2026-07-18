import { createRoot } from 'react-dom/client';

import App from './App';
import { setBaseUrl } from './api-client/custom-fetch';

import './index.css';

// When the frontend is deployed on a different origin than the API (e.g.
// frontend on Vercel, API on Railway), set VITE_API_BASE_URL to the API's
// full URL so relative "/api/..." calls are routed there instead of to the
// frontend's own origin. Leave unset for same-origin deployments.
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
if (apiBaseUrl) {
  setBaseUrl(apiBaseUrl);
}

createRoot(document.getElementById('root')!).render(<App />);
