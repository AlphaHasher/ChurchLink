import AdminLayout from "@/layouts/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import Permissions from "@/pages/admin/Permissions";
import ContentManagement from "@/pages/admin/ContentManagement";
import Notification from "@/pages/admin/Notification";
import Finance from "@/pages/admin/Finance";
import Users from "@/pages/admin/Users";
import { Route, Routes } from "react-router-dom";


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
