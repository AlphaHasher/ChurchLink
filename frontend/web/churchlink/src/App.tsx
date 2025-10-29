import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./features/auth/hooks/auth-context";
import { AppRouter } from "./router/AppRouter";
import { ThemeProvider } from "./provider/ThemeProvider";
import { useWebsiteConfig } from "./hooks/useWebsiteConfig";
import { LanguageProvider } from "./provider/LanguageProvider";

function App() {
  // Load and apply website configuration (title, favicon) on app start.
  useWebsiteConfig();

  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRouter />
          </BrowserRouter>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;
