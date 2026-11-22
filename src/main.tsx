import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { migrateAndSanitizeStorage } from './api/client.ts';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import './index.css';

migrateAndSanitizeStorage();

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);
