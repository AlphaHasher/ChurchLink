import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./features/auth/hooks/auth-context";
import { AppRouter } from "./router/AppRouter";
import { ThemeProvider } from "./provider/ThemeProvider";
import { useWebsiteConfig } from "./hooks/useWebsiteConfig";

function App() {
  // Load and apply website configuration (title, favicon) on app start
  // This runs non-blocking and won't prevent the app from loading
  try {
    useWebsiteConfig();
  } catch (error) {
    console.warn('Website config hook failed, continuing with defaults:', error);
  }

  return (
    <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
