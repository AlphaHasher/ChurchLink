
// import { useAuth } from "@/lib/auth-context";\
import { useEffect, useState } from "react";
import PermissionsTable from "@/features/admin/components/Permissions/RoleTable/PermissionsTable";

import { UserInfo } from "@/shared/types/UserInfo";
import { AccountPermissions } from "@/shared/types/AccountPermissions";
import { fetchUsers } from "@/helpers/UserHelper";
import { fetchPermissions } from "@/helpers/PermissionsHelper";




const Permissions = () => {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [perms, setPerms] = useState<AccountPermissions[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = async () => {
    const usersFromAPI = await fetchUsers();
    setUsers(usersFromAPI);
    const permsFromAPI = await fetchPermissions();
    setPerms(permsFromAPI);
    setLoading(false);
  }

  useEffect(() => {
    loadData();
  }, []);



  if (loading) return <p>Loading permissions...</p>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Permission Roles Management</h1>
      <PermissionsTable data={perms} userData={users} onSave={loadData} />
    </div>
  );
};

export default Permissions;