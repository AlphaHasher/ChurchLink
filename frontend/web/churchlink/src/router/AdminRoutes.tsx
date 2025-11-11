
import { lazy } from "react";
import { Route, Routes } from "react-router-dom";
import AdminLayout from "../shared/layouts/AdminLayout";
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
        <Route path="/webbuilder" element={<WebBuilder />} />
        <Route path="/users/manage-users" element={<Users />} />
        <Route path="/users/membership-requests" element={<MembershipRequests />} />
        <Route path="/permissions" element={<Permissions />} />
        <Route path="/notifications" element={<Notification />} />
        <Route path="/ministries" element={<Ministries />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/discount-codes" element={<DiscountCodes />} />
        <Route path="/events/:eventId" element={<EventInstances />} />
        <Route path="/events/:eventId/instance_details/:instanceId" element={<EventInstancesDetails />} />
        <Route path="/events/:eventId/instance_details/:instanceId/user_registrations/:userId" element={<ViewUserRegistration />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/finance/refunds" element={<RefundManagement />} />
        <Route path="/sermons" element={<Sermons />} />
        <Route path="/bible-plans/manage-plans" element={<ManageBiblePlans />} />
        <Route path="/bible-plans/plan-builder" element={<BiblePlanBuilder />} />
        <Route path="/bulletins" element={<Bulletins />} />
        <Route path="/mobile-ui-tab" element={<MobileUITab />} />
        <Route path="/mobile-ui-pages" element={<MobileUIPages />} />
        <Route path="forms/form-builder" element={<FormBuilder />} />
        <Route path="forms/manage-forms" element={<ManageForms />} />
        <Route path="forms/responses" element={<FormResponses />} />
        <Route path="webbuilder/edit/:slug" element={<EditPage />} />
        <Route path="webbuilder/preview/:slug" element={<AdminPagePreview />} />
        <Route path="webbuilder/header" element={<WebBuilderLayout type="header"><EditHeader /></WebBuilderLayout>} />
        <Route path="webbuilder/footer" element={<WebBuilderLayout type="footer"><EditFooter /></WebBuilderLayout>} />
        <Route path="/media-library" element={<MediaLibrary />} />
      </Route>
    </Routes>
  );
};
