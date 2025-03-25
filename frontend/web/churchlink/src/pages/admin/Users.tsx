import { useEffect, useState } from "react";
import { Trash2, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

import LogicalUserPermsTable from "@/components/AdminDashboard/Users/LogicalUserOverview/LogicalUserPermsTable"

import { MockPermData } from "@/TEMPORARY/MockPermData";
import { MockUserData } from "@/TEMPORARY/MockUserData";

import { applyBaseUserMask, applyUserPermLogicMask } from "@/helpers/DataFunctions";
import UsersTable from "@/components/AdminDashboard/Users/BaseUserTable/UsersTable";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user" | "editor" | "finance" | "media" | "mod";
}

const Users = () => {
  const { currentUser, role } = useAuth();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch users from API or Firebase
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await fetch("/api/users"); // Replace with actual API URL
        const data = await response.json();
        setUsers(data);
      } catch (error) {
        console.error("Error fetching users:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleRoleChange = async (id: string, newRole: UserData["role"]) => {
    if (role !== "admin") return; // Only allow admins to update roles

    try {
      await fetch(`/api/users/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole }),
      });

      setUsers((prev) =>
        prev.map((user) => (user.id === id ? { ...user, role: newRole } : user))
      );
    } catch (error) {
      console.error("Error updating role:", error);
    }
  };

  if (loading) return <p>Loading users...</p>;

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold mb-4">Users Overview</h1>
      <UsersTable data={applyBaseUserMask(MockUserData)} permData={MockPermData}></UsersTable>
      <h1 className="text-xl font-bold mb-4">User Permissions Logical Overview</h1>
      <LogicalUserPermsTable data={applyUserPermLogicMask(MockUserData, MockPermData)} />

    </div>
  );
};

export default Users;