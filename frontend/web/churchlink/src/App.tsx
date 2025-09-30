import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./features/auth/hooks/auth-context";
import { AppRouter } from "./router/AppRouter";
import { ThemeProvider } from "./provider/ThemeProvider";

function App() {
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
