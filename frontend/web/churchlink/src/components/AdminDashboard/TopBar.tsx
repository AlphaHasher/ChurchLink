import { Bell, Search, User } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

const TopBar = () => {
  const { user } = useAuth();

  return (
    <div className="w-full bg-white shadow-md p-4 flex justify-between items-center">
      <div className="flex items-center gap-2 border px-2 py-1 rounded-md">
        <Search />
        <input type="text" placeholder="Search..." className="outline-none" />
      </div>
      <div className="flex items-center gap-4">
        <Bell className="text-xl cursor-pointer" />
        {user && (
          <div className="flex items-center gap-2">
            <User className="text-xl" />
            <span>{user.email}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopBar;