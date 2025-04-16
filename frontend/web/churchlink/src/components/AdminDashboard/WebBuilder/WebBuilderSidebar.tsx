import React from "react";
import { Link, useLocation } from "react-router-dom";

const WebBuilderSidebar: React.FC = () => {
  const { pathname } = useLocation();

  const links = [
    { name: "Pages", to: "/admin/webbuilder" },
    { name: "Media", to: "/admin/webbuilder/media" },
    { name: "Settings", to: "/admin/webbuilder/settings" },
  ];

  return (
    <aside className="w-64 h-screen bg-gray-900 shadow-md p-4 text-white">
    <h2 className="text-2xl font-bold mb-6">Web Builder</h2>
      <Link to="/admin" className="flex items-center text-indigo-400 hover:underline mb-6" aria-label="Back to Admin Dashboard">
        ← Back to Admin
      </Link>
      <nav className="flex flex-col gap-4" role="navigation">
        {links.map(({ name, to }) => (
          <Link
            key={name}
            to={to}
            className={`text-lg font-medium hover:text-indigo-400 ${
              pathname === to ? "text-indigo-400" : "text-gray-300"
            }`}
          >
            {name}
          </Link>
        ))}
      </nav>
    </aside>
  );
};

export default WebBuilderSidebar;
