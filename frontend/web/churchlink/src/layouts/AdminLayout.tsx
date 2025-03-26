import { Outlet } from "react-router-dom";
import Sidebar from "@/components/AdminDashboard/AdminDashboardSideBar";
import TopBar from "@/components/AdminDashboard/AdminDashboardTopBar";

const AdminLayout = () => {


  //only remove comment out when role and auth is setup
  //Restore this to use role admin later
  // const { currentUser, role } = useAuth();

  // if (!currentUser || role !== "admin") {
  //   return <Navigate to="/" />;
  // }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar />
        <div className="flex-1 overflow-y-auto p-4">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;