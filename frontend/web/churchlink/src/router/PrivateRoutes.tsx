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
const EditHeader = lazy(() => import("@/components/AdminDashboard/WebBuilder/EditHeader"));
const EditHeaderItem = lazy(() => import("@/components/AdminDashboard/WebBuilder/EditHeaderItem"));
const AddHeaderItem = lazy(() => import("@/components/AdminDashboard/WebBuilder/AddHeaderItem"));
const EditFooter = lazy(() => import("@/components/AdminDashboard/WebBuilder/EditFooter"));
const EditFooterSection = lazy(() => import("@/components/AdminDashboard/WebBuilder/EditFooterSection.tsx"));
const AddFooterSection = lazy(() => import("@/components/AdminDashboard/WebBuilder/AddFooterSection"));
const Users = lazy(() => import("@/pages/admin/Users"));
const Events = lazy(() => import("@/pages/admin/Events"));

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
        <Route path="/events" element={<Events />} />
        <Route path="/webbuilder/add" element={<AddPage />} />
        <Route path="/webbuilder/edit/:slug" element={<EditPage />} />
        <Route path="/webbuilder/header" element={<EditHeader />} />
        <Route path="/webbuilder/header/edit/:title" element={<EditHeaderItem />} />
        <Route path="/webbuilder/header/add" element={<AddHeaderItem />} />
        <Route path="/webbuilder/footer" element={<EditFooter />} />
        <Route path="/webbuilder/footer/edit/:title" element={<EditFooterSection />} />
        <Route path="/webbuilder/footer/add" element={<AddFooterSection />} />
      </Route>
    </Routes>
  );
};
