// import { LoginPage } from '../features/auth';
import { Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { PublicRoute } from "./guard/PublicRoute";
import { PublicRoutes } from "./PublicRoutes";
import PrivateRoute from "./guard/PrivateRoute";
import { PrivateRoutes } from "./PrivateRoutes";

// Lazy load components
const Login = lazy(() => import("@/pages/Login"));
const Signup = lazy(() => import("@/pages/Signup"));

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
          path="/pages/*"
          element={
            <PublicRoute>
              <PublicRoutes />
            </PublicRoute>
          }
        />

        <Route
          path="/*"
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
