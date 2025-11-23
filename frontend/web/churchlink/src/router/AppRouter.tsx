import { Route, Routes } from "react-router-dom";
import { Suspense, lazy } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { PublicRoute } from "../features/auth/guards/PublicRoute";
import { PublicRoutes } from "./PublicRoutes";
import PrivateRoute from "../features/auth/guards/PrivateRoute";
import { AdminRoutes } from "./AdminRoutes";
import InitRoute from "@/features/auth/guards/InitRoute";
import { ProfileRoutes } from "./ProfileRoutes";
import { MyTransactionRoutes } from "./MyTransactionRoutes";
import AdminRoute from "@/features/auth/guards/AdminRoute";
import VerificationRoute from "@/features/auth/guards/VerificationRoute";
import PaypalThankYouPage from "../features/paypal/pages/thank-you";

const Login = lazy(() => import("../features/auth/pages/Login"));
const Signup = lazy(() => import("../features/auth/pages/Signup"));
const WebEditor = lazy(() => import("@/features/webeditor/pages/WebEditor"));
const ProfileInit = lazy(() => import("../features/users/pages/InitProfilePage"));
const VerifyEmail = lazy(() => import("../features/users/pages/VerifyEmailPage"));

export const AppRouter = () => {
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-8 w-1/3" /><Skeleton className="h-6 w-full mt-2" /></div>}>
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
          path="/my-transactions/*"
          element={
            <PrivateRoute>
              <MyTransactionRoutes />
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
        {/* Standalone Web Editor (admin-guarded, no AdminLayout) */}
        <Route
          path="/web-editor/:slug"
          element={
            <AdminRoute>
              <WebEditor />
            </AdminRoute>
          }
        />

        {/* Catch-all route for public pages - MUST be last */}
        <Route
          path="/*"
          element={
            <PublicRoute>
              <PublicRoutes />
            </PublicRoute>
          }
        />
      </Routes>
    </Suspense>
  );
};
