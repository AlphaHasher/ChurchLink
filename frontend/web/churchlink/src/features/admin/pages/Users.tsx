import { useEffect, useState } from "react";
// import { useAuth } from "@/lib/auth-context";

import LogicalUserPermsTable from "@/features/admin/components/Users/LogicalUserOverview/LogicalUserPermsTable";
import UsersTable from "@/features/admin/components/Users/BaseUserTable/UsersTable";

import { applyBaseUserMask, applyUserPermLogicMask } from "@/helpers/DataFunctions";

import { fetchUsers } from "@/helpers/UserHelper";
import { fetchPermissions } from "@/helpers/PermissionsHelper";

import { UserInfo } from "@/shared/types/UserInfo";
import { AccountPermissions } from "@/shared/types/AccountPermissions";

const Users = () => {
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

  if (loading) return <p>Loading users...</p>;

  return (
    <div className="p-6 overflow-x-hidden">
      <h1 className="text-xl font-bold mb-4">Users Overview</h1>

      <UsersTable data={applyBaseUserMask(users, perms)} permData={perms} onSave={loadData} />

      <h1 className="text-xl font-bold mb-4 mt-8">User Permissions Logical Overview</h1>
      <LogicalUserPermsTable data={applyUserPermLogicMask(users, perms)} />
    </div>
  );
};

export default Users;
