
import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import AdminLayout from "../shared/layouts/AdminLayout";
import Settings from "../features/admin/pages/Settings";
import WebBuilderLayout from "../features/admin/components/WebBuilder/layout/WebBuilderLayout";


// Lazy load admin components
const AdminDashboard = lazy(() => import("../features/admin/pages/AdminDashboard"));
const Permissions = lazy(() => import("../features/admin/pages/Permissions"));
const Notification = lazy(() => import("../features/admin/pages/Notification"));
const Finance = lazy(() => import("../features/admin/pages/Finance"));
const WebBuilder = lazy(() => import("../features/admin/pages/WebBuilder"));
const EditPage = lazy(() => import("../features/admin/components/WebBuilder/sub_pages/EditPage"));
const AdminPagePreview = lazy(() => import("../features/admin/components/WebBuilder/sub_pages/AdminPagePreview"));
const EditHeader = lazy(() => import("../features/admin/components/WebBuilder/sub_pages/EditHeader"));
const EditFooter = lazy(() => import("../features/admin/components/WebBuilder/sub_pages/EditFooter"));
const Users = lazy(() => import("../features/admin/pages/Users"));
const Events = lazy(() => import("../features/admin/pages/Events"));
const Sermons = lazy(() => import("../features/admin/pages/Sermons"));
const BiblePlanManager = lazy(() => import("../features/admin/pages/BiblePlanManager"));
const ManageBiblePlans = lazy(() => import("../features/admin/pages/ManageBiblePlans"));
const FormBuilder = lazy(() => import("../features/admin/pages/FormBuilder"));
const ManageForms = lazy(() => import("../features/admin/pages/ManageForms"));
const FormResponses = lazy(() => import("../features/admin/pages/FormResponses"));

const MobileUITab = lazy(() => import("../features/admin/pages/MobileUITab"));

export const AdminRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<AdminLayout></AdminLayout>}>
        <Route index element={<AdminDashboard />} />
        <Route path="/webbuilder" element={<WebBuilder />} />
        <Route path="/users" element={<Users />} />
        <Route path="/permissions" element={<Permissions />} />
        <Route path="/notifications" element={<Notification />} />
        <Route path="/events" element={<Events />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/sermons" element={<Sermons />} />
        <Route path="/bible-plans/manage-plans" element={<ManageBiblePlans />} />
        <Route path="/bible-plans/plan-builder" element={<BiblePlanManager />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/mobile-ui-tab" element={<MobileUITab />} />
        <Route path="/forms/form-builder" element={<FormBuilder />} />
        <Route path="/forms/manage-forms" element={<ManageForms />} />
        <Route path="/forms/responses" element={<FormResponses />} />
        <Route path="/webbuilder/edit/:slug" element={<EditPage />} />
        <Route path="/webbuilder/preview/:slug" element={<AdminPagePreview />} />
        <Route path="/webbuilder/header" element={<WebBuilderLayout type="header"><EditHeader /></WebBuilderLayout>} />
        <Route path="/webbuilder/footer" element={<WebBuilderLayout type="footer"><EditFooter /></WebBuilderLayout>} />
      </Route>
    </Routes>
  );
};
