import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import AdminLayout from "@/layouts/AdminLayout";


// Lazy load admin components
const AdminDashboard = lazy(() => import("@/pages/admin/AdminDashboard"));
const Permissions = lazy(() => import("@/pages/admin/Permissions"));
const Notification = lazy(() => import("@/pages/admin/Notification"));
const Finance = lazy(() => import("@/pages/admin/Finance"));
const WebBuilder = lazy(() => import("@/pages/admin/WebBuilder"));
const AddPage = lazy(() => import("@/components/AdminDashboard/WebBuilder/AddPage"));
const EditPage = lazy(() => import("@/components/AdminDashboard/WebBuilder/EditPage"));
const Users = lazy(() => import("@/pages/admin/Users"));



export const PrivateRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<AdminLayout></AdminLayout>}>
        <Route index element={<AdminDashboard />} />
        <Route path="/webbuilder" element={<WebBuilder />} />
        <Route path="/users" element={<Users />} />
        <Route path="/permissions" element={<Permissions />} />
        <Route path="/notifications" element={<Notification />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/webbuilder/add" element={<AddPage />} />
        <Route path="/webbuilder/edit/:slug" element={<EditPage />} />
      </Route>
    </Routes>
  );
};
