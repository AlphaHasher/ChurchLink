import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "@/components/AdminDashboard/AdminDashboardSideBar";
import TopBar from "@/components/AdminDashboard/AdminDashboardTopBar";
import WebBuilderSidebar from "@/components/AdminDashboard/WebBuilder/WebBuilderSidebar";
import WebBuilderTopBar from "@/components/AdminDashboard/WebBuilder/WebBuilderTopBar";
import { ReactNode } from "react";

interface AdminLayoutProps {
  customSidebar?: ReactNode;
  children?: ReactNode;
}

const AdminLayout = ({ customSidebar, children }: AdminLayoutProps) => {
  const location = useLocation();
  const isWebBuilderRoute = location.pathname.includes("/webbuilder");

  const renderedSidebar = customSidebar 
    ?? (isWebBuilderRoute ? <WebBuilderSidebar /> : <Sidebar />);

  return (
    <div className="flex h-screen">
      {renderedSidebar}
      <div className="flex-1 flex flex-col">
        {isWebBuilderRoute ? (
          <WebBuilderTopBar
            hasChanges={false} // optionally connect to context later
            onSave={() => {}}   // optionally pass from context later
          />
        ) : (
          <TopBar />
        )}
        <div className="flex-1 overflow-y-auto p-4">
          {children || <Outlet />}
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;
