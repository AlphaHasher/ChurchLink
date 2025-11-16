import { BrowserRouter } from "react-router-dom";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider } from "./features/auth/hooks/auth-context";
import { AppRouter } from "./router/AppRouter";
import { ThemeProvider, useThemeRouteSync } from "./provider/ThemeProvider";
import { useWebsiteConfig } from "./hooks/useWebsiteConfig";
import { LanguageProvider } from "./provider/LanguageProvider";

function AppContentInner() {
  useThemeRouteSync()

  return (
    <AppRouter />
  );
}

function AppContent() {
  useWebsiteConfig();

  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppContentInner />
          <ToastContainer
            position="top-right"
            autoClose={5000}
            hideProgressBar={false}
            newestOnTop={false}
            closeOnClick
            rtl={false}
            pauseOnFocusLoss
            draggable
            pauseOnHover
            theme="light"
          />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;
