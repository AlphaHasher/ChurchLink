import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import AdminLayout from "@/layouts/AdminLayout";

// Lazy load admin components
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const Permissions = lazy(() => import("@/pages/admin/Permissions"));
const ContentManagement = lazy(() => import("@/pages/admin/ContentManagement"));
const Notification = lazy(() => import("@/pages/admin/Notification"));
const Finance = lazy(() => import("@/pages/admin/Finance"));
const Users = lazy(() => import("@/pages/admin/Users"));

export const PrivateRoutes = () => {
  return (
    <>
      <Routes>
        <Route path="/" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="/users" element={<Users />} />
          <Route path="/permissions" element={<Permissions />} />
          <Route path="/content" element={<ContentManagement />} />
          <Route path="/notifications" element={<Notification />} />
          <Route path="/finance" element={<Finance />} />
        </Route>
      </Routes>
    </>
  );
};
