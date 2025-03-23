// import { Navigate, Outlet } from "react-router-dom";
// import Sidebar from "@/components/ui/sidebar";
import TopBar from "@/components/ui/TopBar";
// import { useAuth } from "@/lib/auth-context";

const AdminLayout = () => {

  //Restore this to use role admin later
  // const { currentUser, role } = useAuth();

  // if (!currentUser || role !== "admin") {
  //   return <Navigate to="/" />;
  // }

  return (
    <div className="flex">
      {/* <Sidebar /> */}
      <div className="flex-1">
        <TopBar />
        {/* <Outlet /> */}
      </div>
    </div>
  );
};

export default AdminLayout;