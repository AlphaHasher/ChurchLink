// import { LoginPage } from '../features/auth';
import { Route, Routes } from "react-router-dom";
import { PublicRoute } from "./guard/PublicRoute";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import { PublicRoutes } from "./PublicRoutes";
import PrivateRoute from "./guard/PrivateRoute";
import { PrivateRoutes } from "./PrivateRoutes";

export const AppRouter = () => {
  return (
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
  );
};
