import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth-context";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Home from "./pages/Home";
import ArticlePage from "./pages/ArticlePage";
import ArticlesListPage from "./pages/ArticlesListPage";

import PublicLayout from "./layouts/PublicLayout";
import PrivateLayout from "./layouts/PrivateLayout";

//admin dashboard
import AdminLayout from "./layouts/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import Permissions from "./pages/admin/Permissions";
import Users from "./pages/admin/Users";
import Notification from "./pages/admin/Notification";
import ContentManagement from "./pages/admin/ContentManagement";
import Finance from "./pages/admin/Finance";

function App() {
  const { currentUser, role } = useAuth(); // Get auth state

  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/articles" element={<ArticlesListPage />} />
          <Route path="/articles/:id" element={<ArticlePage />} />        
          <Route path="/" element={currentUser ? <PrivateLayout><Home /></PrivateLayout> : <PublicLayout><Home /></PublicLayout>} />

          {/* ✅ Ensure Admin Route is Included */}
          {/* <Route path="/admin" element={role === "admin" ? <AdminLayout /> : <Navigate to="/" />} >
            <Route index element={<AdminDashboard />} />
            <Route path="/admin/permissions" element={role === "admin" ? <Permissions /> : <Navigate to="/" />} />
            <Route path="/admin/users" element={role === "admin" ? <Users /> : <Navigate to="/" />} />
            <Route path="/admin/content" element={role === "admin" ? <ContentManagement /> : <Navigate to="/" />} />
            <Route path="/admin/notifications" element={role === "admin" ? <Notification /> : <Navigate to="/" />} />
            <Route path="/admin/finance" element={role === "admin" || role === "finance" ? <Finance /> : <Navigate to="/" />} />
          </Route> */}

          <Route path="/admin" element={<AdminLayout />} >
            <Route index element={<AdminDashboard />} />
            <Route path="/admin/users" element={<Users />} />
            <Route path="/admin/permissions" element={<Permissions />} />
            <Route path="/admin/content" element={<ContentManagement />} />
            <Route path="/admin/notifications" element={<Notification />} />
            <Route path="/admin/finance" element={<Finance />} />
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;