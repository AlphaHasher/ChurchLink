import { ReactNode } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import WebBuilderSidebar from "@/features/admin/components/WebBuilder/WebBuilderSidebar";

type WebBuilderLayoutProps = {
  children?: ReactNode;
};

const WebBuilderLayout = ({ children }: WebBuilderLayoutProps) => {
  const navigate = useNavigate();

  return (
    <div className="flex h-screen">
      <nav className="w-64 bg-gray-100 p-4">
        <button
          className="text-sm font-medium text-blue-600 hover:underline mb-4"
          onClick={() => navigate(-1)}
        >
          ← Back to Admin
        </button>
        <WebBuilderSidebar />
      </nav>
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          {children ?? <Outlet />}
        </div>
      </div>
    </div>
  );
};

export default WebBuilderLayout;