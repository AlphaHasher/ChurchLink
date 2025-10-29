import { BrowserRouter } from "react-router-dom";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
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
    </ThemeProvider>
  );
}

export default App;
