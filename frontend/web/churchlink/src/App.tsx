import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./features/auth/hooks/auth-context";
import { AppRouter } from "./router/AppRouter";
import { ThemeProvider } from "./provider/ThemeProvider";
import { LanguageProvider } from "./provider/LanguageProvider";

function App() {
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
