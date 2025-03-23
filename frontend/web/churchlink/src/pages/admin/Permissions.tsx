import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import DataTableDemo from "@/components/ui/AdminDashboard/Test";



const Permissions = () => {
  const { role } = useAuth();
//   if (role !== "admin") return <p>Access Denied</p>; // Restrict non-admins



  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Permissions Management</h1>
      <DataTableDemo/>
    </div>
  );
};

export default Permissions;