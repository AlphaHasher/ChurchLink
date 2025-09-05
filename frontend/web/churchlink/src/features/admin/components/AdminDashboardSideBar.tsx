import { useState } from "react";
import { Link } from "react-router-dom";
import { BarChart2, Settings, LogOut, Home, Shield, User, Folder, Loader2, CalendarFold, BookOpen } from "lucide-react"; // ← Add Loader2 icon
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { processStrapiRedirect } from "@/helpers/StrapiInteraction";

const Sidebar = () => {
  const [loading, setLoading] = useState(false);

  const handleMediaRedirect = async (e: React.MouseEvent) => {
    e.preventDefault();
    setLoading(true);
    await processStrapiRedirect();
    setLoading(false);
  };

  return (
    <div className="w-64 h-screen bg-gray-800 text-white flex flex-col p-4">
      <h2 className="text-2xl font-bold mb-6">Admin Dashboard</h2>
      <nav className="flex flex-col gap-4">
        <Link to="/pages/home" className="flex items-center gap-2 text-white no-underline hover:text-gray-300"><Home /> Home</Link>
        <Link to="/admin" className="flex items-center gap-2 text-white no-underline hover:text-gray-300"><BarChart2 /> Dashboard</Link>
        <Link to="/admin/users" className="flex items-center gap-2 text-white no-underline hover:text-gray-300"><User /> Manage Users</Link>
        <Link to="/admin/permissions" className="flex items-center gap-2 text-white no-underline hover:text-gray-300"><Shield /> Permissions</Link>

        {/* Media Library, wrapped in a Link for style consistency*/}
        <Link
          to="#"
          onClick={handleMediaRedirect}
          className={`flex items-center gap-2 no-underline ${loading ? "text-gray-400 cursor-wait" : "text-white hover:text-gray-300"
            }`}
        >
          {loading ? (
            <Loader2 className="animate-spin" />
          ) : (
            <Folder />
          )}
          {loading ? "Loading..." : "Media Library"}
        </Link>
        <Link to="/admin/events" className="flex items-center gap-2 text-white no-underline hover:text-gray-300"><CalendarFold /> Events</Link>
        <Link to="/admin/bible-plan-manager" className="flex items-center gap-2 text-white no-underline hover:text-gray-300"><BookOpen /> Bible Plan Manager</Link>
        <Link to="/admin/webbuilder" className="flex items-center gap-2 text-white no-underline hover:text-gray-300">🧱 Web Builder</Link>
        <Link to="/admin/finance" className="flex items-center gap-2 text-white no-underline hover:text-gray-300">💰 Finance</Link>
        <Link to="/admin/notifications" className="flex items-center gap-2 text-white no-underline hover:text-gray-300">📢 Notifications</Link>
        <Link to="/admin/settings" className="flex items-center gap-2 text-white no-underline hover:text-gray-300"><Settings /> Settings</Link>
        <div onClick={() => signOut(auth)} className="flex items-center gap-2 text-white hover:text-gray-300 cursor-pointer"><LogOut /> Logout</div>
      </nav>
    </div>
  );
};

export default Sidebar;