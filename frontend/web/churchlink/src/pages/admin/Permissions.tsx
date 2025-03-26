import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import PermissionsTable from "@/components/ui/AdminDashboard/Permissions/RoleTable/PermissionsTable";

import { MockPermData } from "@/TEMPORARY/MockPermData";
import { MockUserData } from "@/TEMPORARY/MockUserData";



const Permissions = () => {
  const { role } = useAuth();
  //   if (role !== "admin") return <p>Access Denied</p>; // Restrict non-admins



  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Permission Roles Management</h1>
      <PermissionsTable data={MockPermData} userData={MockUserData} />
    </div>
  );
};

export default Permissions;