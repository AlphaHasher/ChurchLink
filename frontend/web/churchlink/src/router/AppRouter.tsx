// import { LoginPage } from '../features/auth';
import { Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { PublicRoute } from "../features/auth/guards/PublicRoute";
import { PublicRoutes } from "./PublicRoutes";
import PrivateRoute from "../features/auth/guards/PrivateRoute";
import { PrivateRoutes } from "./PrivateRoutes";
import DynamicPage from "../shared/components/DynamicPage";
import ProfilePage from "@/pages/ProfilePage";

// Lazy load components
const Login = lazy(() => import("../features/auth/pages/Login"));
const Signup = lazy(() => import("../features/auth/pages/Signup"));

export const AppRouter = () => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route
          path="/auth/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/auth/signup"
          element={
            <PublicRoute>
              <Signup />
            </PublicRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <PublicRoute>
              <ProfilePage />
            </PublicRoute>
          }
        />


        <Route
          path="/"
          element={
            <PublicRoute>
              <DynamicPage />
            </PublicRoute>
          }
        />
        {/* Dynamic page route for any URL */}
        <Route
          path="/:slug/*" // Catch all routes. Apparently works with slashes compared to "/:slug", though functionality does not work at the moment.
          element={
            <PublicRoute>
              <DynamicPage />
            </PublicRoute>
          }
        />

        <Route
          path="/pages/*"
          element={
            <PublicRoute>
              <PublicRoutes />
            </PublicRoute>
          }
        />

        <Route
          path="/admin/*"
          element={
            <PrivateRoute>
              <PrivateRoutes />
            </PrivateRoute>
          }
        />
      </Routes>
    </Suspense>
  );
};
