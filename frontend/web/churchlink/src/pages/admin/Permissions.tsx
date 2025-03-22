import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

interface Permission {
  feature: string;
  allowedRoles: string[];
}

const Permissions = () => {
  const { role } = useAuth();
//   if (role !== "admin") return <p>Access Denied</p>; // Restrict non-admins

  const [permissions, setPermissions] = useState<Permission[]>([
    { feature: "Admin Dashboard", allowedRoles: ["admin", "finance", "media", "mod"] },
    { feature: "User Management", allowedRoles: ["admin"] },
    { feature: "Finance Reports", allowedRoles: ["admin", "finance"] },
    { feature: "Media Library", allowedRoles: ["admin", "media"] },
  ]);

  const handleRoleChange = (feature: string, role: string) => {
    setPermissions((prev) =>
      prev.map((perm) =>
        perm.feature === feature
          ? {
              ...perm,
              allowedRoles: perm.allowedRoles.includes(role)
                ? perm.allowedRoles.filter((r) => r !== role)
                : [...perm.allowedRoles, role],
            }
          : perm
      )
    );
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Permissions Management</h1>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Feature</th>
            <th className="border p-2">Allowed Roles</th>
          </tr>
        </thead>
        <tbody>
          {permissions.map((perm) => (
            <tr key={perm.feature} className="border">
              <td className="p-2 border">{perm.feature}</td>
              <td className="p-2 border">
                {["admin", "user", "editor", "finance", "media", "mod"].map((r) => (
                  <label key={r} className="mr-2">
                    <input
                      type="checkbox"
                      checked={perm.allowedRoles.includes(r)}
                      onChange={() => handleRoleChange(perm.feature, r)}
                    />
                    {r}
                  </label>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Permissions;