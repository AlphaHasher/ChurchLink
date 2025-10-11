import { useEffect, useState } from "react";
import PermissionsTable from "@/features/admin/components/Permissions/RoleTable/PermissionsTable";

import { AccountPermissions } from "@/shared/types/AccountPermissions";
import { fetchPermissions } from "@/helpers/PermissionsHelper";

const Permissions = () => {
  const [perms, setPerms] = useState<AccountPermissions[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPerms = async () => {
    const permsFromAPI = await fetchPermissions();
    setPerms(permsFromAPI);
    setLoading(false);
  };

  useEffect(() => {
    loadPerms();
  }, []);

  if (loading) return <p>Loading permissions...</p>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Permission Roles Management</h1>
      <PermissionsTable data={perms} onSave={loadPerms} />
    </div>
  );
};

export default Permissions;
