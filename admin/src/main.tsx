import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { router } from './router';
import './index.css';
import './lib/storageTester';
import './lib/partnersTester';
import './lib/followUpsTester';
import './lib/stockEntryTester';

// Auto-reload se um chunk lazy falhar após novo deploy no Vercel
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
