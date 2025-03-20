import { BrowserRouter as Router, Routes, Route, useParams } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth-context";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import PublicLayout from "./layouts/PublicLayout";
import PrivateLayout from "./layouts/PrivateLayout";
import General from "./pages/General";

function GeneralWrapper() {
  const { name } = useParams();
  return <General name={name || "Home"} />;
}

function App() {
  const { currentUser } = useAuth();

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route
            path="/:name?"
            element={
              currentUser ? (
                <PrivateLayout>
                  <GeneralWrapper />
                </PrivateLayout>
              ) : (
                <PublicLayout>
                  <GeneralWrapper />
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
