import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth-context";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Home from "./pages/Home";
import ArticlePage from "./pages/ArticlePage";
import ArticlesListPage from "./pages/ArticlesListPage";

import PublicLayout from "./layouts/PublicLayout";
import PrivateLayout from "./layouts/PrivateLayout";

function App() {
  const { currentUser } = useAuth();

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/articles" element={<ArticlesListPage />} />
          <Route path="/articles/:id" element={<ArticlePage />} />        
          <Route
            path="/"
            element={
              currentUser ? (
                <PrivateLayout>
                  <Home />
                </PrivateLayout>
              ) : (
                <PublicLayout>
                  <Home />
                </PublicLayout>
              )
            }
          />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
