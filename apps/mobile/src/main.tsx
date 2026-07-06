import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fabxpert/shared/styles/tokens.css';
import './api-client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
