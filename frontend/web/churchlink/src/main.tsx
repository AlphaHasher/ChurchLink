import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { AuthProvider } from './lib/auth-context'; // Ensure AuthProvider is wrapped around App

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider> {/* ✅ Wrap the entire app with AuthProvider */}
      <App />
    </AuthProvider>
  </StrictMode>,
);
