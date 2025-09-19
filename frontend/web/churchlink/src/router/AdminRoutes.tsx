import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import AdminLayout from "../shared/layouts/AdminLayout";


// Lazy load admin components
const AdminDashboard = lazy(() => import("../features/admin/pages/AdminDashboard"));
const Permissions = lazy(() => import("../features/admin/pages/Permissions"));
const Notification = lazy(() => import("../features/admin/pages/Notification"));
const Finance = lazy(() => import("../features/admin/pages/Finance"));
const WebBuilder = lazy(() => import("../features/admin/pages/WebBuilder"));
const AddPage = lazy(() => import("../features/admin/components/WebBuilder/AddPage"));
const EditPage = lazy(() => import("../features/admin/components/WebBuilder/EditPage"));
const AdminPagePreview = lazy(() => import("../features/admin/components/WebBuilder/AdminPagePreview"));
const EditHeader = lazy(() => import("../features/admin/components/WebBuilder/EditHeader"));
const EditHeaderItem = lazy(() => import("../features/admin/components/WebBuilder/EditHeaderItem"));
const AddHeaderItem = lazy(() => import("../features/admin/components/WebBuilder/AddHeaderItem"));
const EditFooter = lazy(() => import("../features/admin/components/WebBuilder/EditFooter"));
const EditFooterSection = lazy(() => import("../features/admin/components/WebBuilder/EditFooterSection"));
const AddFooterSection = lazy(() => import("../features/admin/components/WebBuilder/AddFooterSection"));
const Users = lazy(() => import("../features/admin/pages/Users"));
const Events = lazy(() => import("../features/admin/pages/Events"));
const BiblePlanManager = lazy(() => import("../features/admin/pages/BiblePlanManager"));
const FormBuilder = lazy(() => import("../features/admin/pages/FormBuilder"));

export const AdminRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<AdminLayout></AdminLayout>}>
        <Route index element={<AdminDashboard />} />
        <Route path="/webbuilder" element={<WebBuilder />} />
        <Route path="/users" element={<Users />} />
        <Route path="/permissions" element={<Permissions />} />
        <Route path="/notifications" element={<Notification />} />
        <Route path="/form-builder" element={<FormBuilder />} />
        <Route path="/events" element={<Events />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/bible-plan-manager" element={<BiblePlanManager />} />
        <Route path="/webbuilder/add" element={<AddPage />} />
        <Route path="/webbuilder/edit/:slug" element={<EditPage />} />
        <Route path="/webbuilder/preview/:slug" element={<AdminPagePreview />} />
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
