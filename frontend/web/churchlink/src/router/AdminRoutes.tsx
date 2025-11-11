
import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import AdminLayout from "../shared/layouts/AdminLayout";
import WebBuilderLayout from "../features/admin/components/WebBuilder/layout/WebBuilderLayout";
import PermissionGuard from "../features/auth/guards/PermissionGuard";

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
const MembershipRequests = lazy(() => import("../features/admin/pages/ManageMemberships"));
const Events = lazy(() => import("../features/admin/pages/EventsV2"));
const EventInstances = lazy(() => import("../features/admin/pages/EventInstances"));
const EventInstancesDetails = lazy(() => import("../features/admin/pages/EventInstanceDetails"));
const DiscountCodes = lazy(() => import("../features/admin/pages/DiscountCodes"));
const ViewUserRegistration = lazy(() => import("../features/admin/pages/ViewUserRegistrationDetails"));
const Sermons = lazy(() => import("../features/admin/pages/Sermons"));
const Bulletins = lazy(() => import("../features/admin/pages/Bulletins"));
const BiblePlanBuilder = lazy(() => import("../features/admin/pages/BiblePlanBuilder"));
const ManageBiblePlans = lazy(() => import("../features/admin/pages/ManageBiblePlans"));
const FormBuilder = lazy(() => import("../features/admin/pages/FormBuilder"));
const ManageForms = lazy(() => import("../features/admin/pages/ManageForms"));
const FormResponses = lazy(() => import("../features/admin/pages/FormResponses"));
const Ministries = lazy(() => import("../features/admin/pages/Ministries"));
const RefundManagement = lazy(() => import("../features/admin/pages/RefundManagement"));

const MobileUITab = lazy(() => import("../features/admin/pages/MobileUITab"));
const MobileUIPages = lazy(() => import("../features/admin/pages/MobileUIPages"));
const MediaLibrary = lazy(() => import("../features/admin/pages/MediaLibrary"));

export const AdminRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<AdminLayout></AdminLayout>}>
        <Route index element={<AdminDashboard />} />
        <Route path="/webbuilder" element={<PermissionGuard requiredPermission="web_builder_management">
          <WebBuilder />
        </PermissionGuard>} />
        <Route path="/users/manage-users" element={<PermissionGuard requiredPermission="permissions_management">
          <Users />
        </PermissionGuard>} />
        <Route path="/users/membership-requests" element={<PermissionGuard requiredPermission="permissions_management">
          <MembershipRequests />
        </PermissionGuard>} />
        <Route path="/permissions" element={<PermissionGuard requiredPermission="permissions_management">
          <Permissions />
        </PermissionGuard>} />
        <Route path="/notifications" element={<PermissionGuard requiredPermission="notification_management">
          <Notification />
        </PermissionGuard>} />
        <Route path="/ministries" element={<PermissionGuard requiredPermission="ministries_management">
          <Ministries />
        </PermissionGuard>} />
        <Route path="/events" element={<PermissionGuard requiredPermission={["event_management", "event_editing"]}>
          <Events />
        </PermissionGuard>} />
        <Route path="/events/discount-codes" element={<PermissionGuard requiredPermission={["event_management", "event_editing"]}>
          <DiscountCodes />
        </PermissionGuard>} />
        <Route path="/events/:eventId" element={<PermissionGuard requiredPermission={["event_management", "event_editing"]}>
          <EventInstances />
        </PermissionGuard>} />
        <Route path="/events/:eventId/instance_details/:instanceId" element={<PermissionGuard requiredPermission={["event_management", "event_editing"]}>
          <EventInstancesDetails />
        </PermissionGuard>} />
        <Route path="/events/:eventId/instance_details/:instanceId/user_registrations/:userId" element={<PermissionGuard requiredPermission={["event_management", "event_editing"]}>
          <ViewUserRegistration />
        </PermissionGuard>} />
        <Route path="/finance" element={<PermissionGuard requiredPermission="finance">
          <Finance />
        </PermissionGuard>} />
        <Route path="/finance/refunds" element={<PermissionGuard requiredPermission="finance">
          <RefundManagement />
        </PermissionGuard>} />
        <Route path="/sermons" element={<PermissionGuard requiredPermission="sermon_editing">
          <Sermons />
        </PermissionGuard>} />
        <Route path="/bible-plans/manage-plans" element={<PermissionGuard requiredPermission="bible_plan_management">
          <ManageBiblePlans />
        </PermissionGuard>} />
        <Route path="/bible-plans/plan-builder" element={<PermissionGuard requiredPermission="bible_plan_management">
          <BiblePlanBuilder />
        </PermissionGuard>} />
        <Route path="/bulletins" element={<PermissionGuard requiredPermission="bulletin_editing">
          <Bulletins />
        </PermissionGuard>} />
        <Route path="/mobile-ui-tab" element={<PermissionGuard requiredPermission="mobile_ui_management">
          <MobileUITab />
        </PermissionGuard>} />
        <Route path="/mobile-ui-pages" element={<PermissionGuard requiredPermission="mobile_ui_management">
          <MobileUIPages />
        </PermissionGuard>} />
        <Route path="forms/form-builder" element={<PermissionGuard requiredPermission="forms_management">
          <FormBuilder />
        </PermissionGuard>} />
        <Route path="forms/manage-forms" element={<PermissionGuard requiredPermission="forms_management">
          <ManageForms />
        </PermissionGuard>} />
        <Route path="forms/responses" element={<PermissionGuard requiredPermission="forms_management">
          <FormResponses />
        </PermissionGuard>} />
        <Route path="webbuilder/edit/:slug" element={<PermissionGuard requiredPermission="web_builder_management">
          <EditPage />
        </PermissionGuard>} />
        <Route path="webbuilder/preview/:slug" element={<PermissionGuard requiredPermission="web_builder_management">
          <AdminPagePreview />
        </PermissionGuard>} />
        <Route path="webbuilder/header" element={<PermissionGuard requiredPermission="web_builder_management">
          <WebBuilderLayout type="header"><EditHeader /></WebBuilderLayout>
        </PermissionGuard>} />
        <Route path="webbuilder/footer" element={<PermissionGuard requiredPermission="web_builder_management">
          <WebBuilderLayout type="footer"><EditFooter /></WebBuilderLayout>
        </PermissionGuard>} />
        <Route path="/media-library" element={<MediaLibrary />} />
      </Route>
    </Routes>
  );
};
