import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/features/admin/components/AdminDashboardSideBar";
import WebBuilderSidebar from "@/features/admin/components/WebBuilder/WebBuilderSidebar";
import { ReactNode } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/shared/components/ui/sidebar";

interface AdminLayoutProps {
  customSidebar?: ReactNode;
  children?: ReactNode;
}

const AdminLayout = ({ customSidebar, children }: AdminLayoutProps) => {
  const location = useLocation();
  const isWebBuilderRoute = location.pathname.includes("/webbuilder");

  const renderedSidebar =
    customSidebar ?? (isWebBuilderRoute ? <WebBuilderSidebar /> : <Sidebar />);

  return (
    <SidebarProvider>
      {renderedSidebar}
      <SidebarInset>
        <div className="flex h-screen flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
            <div className="mb-3">
              <SidebarTrigger />
            </div>
            {children || <Outlet />}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
};

export default AdminLayout;
