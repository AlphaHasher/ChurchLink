import React from "react";
import { Link, useLocation } from "react-router-dom";

const WebBuilderSidebar: React.FC = () => {
  const { pathname } = useLocation();

  const links = [
      { name: "Pages", to: "/admin/webbuilder" },
      { name: "Header", to: "/admin/webbuilder/header" },
      { name: "Footer", to: "/admin/webbuilder/footer" },
      { name: "Media", to: "/admin/webbuilder/media" },
  ];

  return (
    <aside className="w-64 h-screen bg-sidebar shadow-md p-4 text-sidebar-foreground">
    <h2 className="text-2xl font-bold mb-6">Web Builder</h2>
      <Link to="/admin" className="flex items-center text-sidebar-primary hover:underline mb-6" aria-label="Back to Admin Dashboard">
        ← Back to Admin
      </Link>
      <nav className="flex flex-col gap-4" role="navigation">
        {links.map(({ name, to }) => (
          <Link
            key={name}
            to={to}
            className={`text-lg font-medium hover:text-sidebar-primary ${
              pathname === to ? "text-sidebar-primary" : "text-sidebar-foreground/70"
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
