import { useEffect, useState } from "react";
import { Trash2, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

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
      <h1 className="text-2xl font-bold mb-4">Manage Users</h1>
      <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2">Name</th>
            <th className="border p-2">Email</th>
            <th className="border p-2">Role</th>
            {role === "admin" && <th className="border p-2">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border">
              <td className="p-2 border">{user.name}</td>
              <td className="p-2 border">{user.email}</td>
              <td className="p-2 border">
                {role === "admin" ? (
                  <select
                    value={user.role}
                    onChange={(e) => handleRoleChange(user.id, e.target.value as UserData["role"])}
                    className="border p-1"
                  >
                    <option value="admin">Admin</option>
                    <option value="user">User</option>
                    <option value="editor">Editor</option>
                    <option value="finance">Finance</option>
                    <option value="media">Media</option>
                    <option value="mod">Moderator</option>
                  </select>
                ) : (
                  user.role
                )}
              </td>
              {role === "admin" && (
                <td className="p-2 border">
                  <button
                    className="bg-red-500 text-white px-3 py-1 rounded flex items-center gap-1"
                    onClick={() => console.log("Remove user", user.id)}
                  >
                    <Trash2 size={16} /> Remove
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Users;