import { Link } from "react-router-dom";
import { Users, BarChart2, Settings, LogOut, Home, Shield, User } from "lucide-react";

const Sidebar = () => {
  return (
    <div className="w-64 h-screen bg-gray-800 text-white flex flex-col p-4">
      <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>
      <nav className="flex flex-col gap-4">
        <Link to="/" className="flex items-center gap-2 hover:text-gray-300"><Home /> Home</Link>
        <Link to="/admin" className="flex items-center gap-2 hover:text-gray-300"><BarChart2 /> Dashboard</Link>
        <Link to="/admin/users" className="flex items-center gap-2 hover:text-gray-300">
          <User /> Manage Users
        </Link>
        <Link to="/admin/permissions" className="flex items-center gap-2 hover:text-gray-300">
          <Shield /> Permissions
        </Link>
        <Link to="/admin/content" className="flex items-center gap-2 hover:text-gray-300">
          📝 Content
        </Link>
        <Link to="/admin/finance" className="flex items-center gap-2 hover:text-gray-300">
          💰 Finance
        </Link>
        <Link to="/admin/notifications" className="flex items-center gap-2 hover:text-gray-300">
          📢 Notifications
        </Link>
        <Link to="/admin/settings" className="flex items-center gap-2 hover:text-gray-300"><Settings /> Settings</Link>
        <Link to="/logout" className="flex items-center gap-2 hover:text-gray-300"><LogOut /> Logout</Link>
      </nav>
    </div>
  );
};

export default Sidebar;