import { Outlet } from "react-router-dom";
import Sidebar from "@/features/admin/components/AdminDashboardSideBar";
import { ReactNode } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/shared/components/ui/sidebar";
import { ModeToggle } from "@/shared/components/ModeToggle";

interface AdminLayoutProps {
  children?: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  

  const renderedSidebar = <Sidebar />;

  return (
    <SidebarProvider
      defaultOpen={true}
      style={{ ["--sidebar-width" as any]: "18rem", ["--sidebar-width-icon" as any]: "3.25rem" }}
    >
      {renderedSidebar}
      <SidebarInset>
        <div className="relative flex h-screen flex-col overflow-hidden">
          <div className="absolute right-4 top-4 z-50">
            <ModeToggle />
          </div>
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
