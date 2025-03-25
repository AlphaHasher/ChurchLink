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
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="/admin/users" element={<Users />} />
          <Route path="/admin/permissions" element={<Permissions />} />
          <Route path="/admin/content" element={<ContentManagement />} />
          <Route path="/admin/notifications" element={<Notification />} />
          <Route path="/admin/finance" element={<Finance />} />
        </Route>
      </Routes>
    </>
  );
};
