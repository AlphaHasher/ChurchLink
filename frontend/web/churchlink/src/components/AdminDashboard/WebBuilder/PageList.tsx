import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Page {
  _id: string;
  title: string;
  slug: string;
  visible: boolean;
  locked?: boolean;
}

const WebBuilderPageList = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/api/pages")
      .then((res) => res.json())
      .then((data) => {
        setPages(data);
      });
  }, []);

  const toggleVisibility = async (id: string, current: boolean) => {
    await fetch(`/api/pages/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visible: !current }),
    });

    setPages((prev) =>
      prev.map((p) => (p._id === id ? { ...p, visible: !current } : p))
    );
  };

  const toggleLock = async (id: string, current: boolean) => {
    await fetch(`/api/pages/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locked: !current }),
    });

    setPages((prev) =>
      prev.map((p) => (p._id === id ? { ...p, locked: !current } : p))
    );
  };

  const deletePage = async (id: string) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this page?");
    if (!confirmDelete) return;

    await fetch(`/api/pages/${id}`, { method: "DELETE" });
    setPages((prev) => prev.filter((p) => p._id !== id));
  };

  return (
    <div className="p-4">
      <h1 className="text-2xl font-semibold mb-4">Website Pages</h1>
      <div className="bg-white rounded shadow-md overflow-hidden">
        <table className="min-w-full table-auto text-left">
          <thead className="bg-gray-100 text-gray-700 text-sm">
            <tr>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Visibility</th>
              <th className="px-4 py-3">Lock Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((page) => (
              <tr
                key={page._id}
                className="border-t hover:bg-gray-50 transition"
              >
                <td className="px-4 py-3 font-medium">{page.title}</td>
                <td className="px-4 py-3 text-blue-600">{page.slug}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                      page.visible ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                    }`}
                  >
                    {page.visible ? "Visible" : "Hidden"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => toggleLock(page._id, page.locked ?? false)}
                    className="text-sm text-gray-600 hover:underline"
                  >
                    {page.locked ? "Unlock" : "Lock"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => navigate(`/admin/webbuilder/edit/${page.slug}`)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => toggleVisibility(page._id, page.visible)}
                    className="text-sm text-yellow-600 hover:underline"
                  >
                    {page.visible ? "Hide" : "Show"}
                  </button>
                  <button
                    onClick={() => deletePage(page._id)}
                    className="text-sm text-red-600 hover:underline disabled:opacity-50"
                    disabled={page.locked}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WebBuilderPageList;
