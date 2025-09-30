import { Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { PublicRoute } from "../features/auth/guards/PublicRoute";
import { PublicRoutes } from "./PublicRoutes";
import PrivateRoute from "../features/auth/guards/PrivateRoute";
import { AdminRoutes } from "./AdminRoutes";
import InitRoute from "@/features/auth/guards/InitRoute";
import { ProfileRoutes } from "./ProfileRoutes";
import AdminRoute from "@/features/auth/guards/AdminRoute";
import VerificationRoute from "@/features/auth/guards/VerificationRoute";
import PaypalThankYouPage from "../features/paypal/pages/thank-you";

const Login = lazy(() => import("../features/auth/pages/Login"));
const Signup = lazy(() => import("../features/auth/pages/Signup"));
const ProfileInit = lazy(() => import("../features/users/pages/InitProfilePage"));
const VerifyEmail = lazy(() => import("../features/users/pages/VerifyEmailPage"));

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
          path="/auth/init"
          element={
            <InitRoute>
              <ProfileInit />
            </InitRoute>
          }
        />

        <Route
          path="/auth/verify-email"
          element={
            <VerificationRoute>
              <VerifyEmail />
            </VerificationRoute>
          }
        />

        <Route
          path="/*"
          element={
            <PublicRoute>
              <PublicRoutes />
            </PublicRoute>
          }
        />
        <Route
          path="/thank-you"
          element={
            <PublicRoute>
              <PaypalThankYouPage />
            </PublicRoute>
          }
        />

        <Route
          path="/profile/*"
          element={
            <PrivateRoute>
              <ProfileRoutes />
            </PrivateRoute>
          }
        />
        <Route
          path="/admin/*"
          element={
            <AdminRoute>
              <AdminRoutes />
            </AdminRoute>
          }
        />
      </Routes>
    </Suspense>
  );
};
