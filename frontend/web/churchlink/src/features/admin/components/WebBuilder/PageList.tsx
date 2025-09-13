import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/api";

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
    const fetchPages = async () => {
      try {
        const response = await api.get("/pages");
        setPages(response.data);
      } catch (error) {
        console.error("Error fetching pages:", error);
      }
    };
    fetchPages();
  }, []);

  const toggleVisibility = async (id: string, current: boolean) => {
    try {
      await api.put(`/pages/${id}`, { visible: !current });
      setPages((prev) =>
        prev.map((p) => (p._id === id ? { ...p, visible: !current } : p))
      );
    } catch (error) {
      console.error("Error updating page visibility:", error);
    }
  };

  const toggleLock = async (id: string, current: boolean) => {
    try {
      await api.put(`/pages/${id}`, { locked: !current });
      setPages((prev) =>
        prev.map((p) => (p._id === id ? { ...p, locked: !current } : p))
      );
    } catch (error) {
      console.error("Error updating page lock status:", error);
    }
  };

  const deletePage = async (id: string) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this page?");
    if (!confirmDelete) return;

    try {
      await api.delete(`/pages/${id}`);
      setPages((prev) => prev.filter((p) => p._id !== id));
    } catch (error) {
      console.error("Error deleting page:", error);
    }
  };

  return (
    <div className="p-4">
        <div className="flex justify-between items-center mb-4">
            <h1 className="text-2xl font-semibold">Website Pages</h1>
            <button
                onClick={() => navigate("/admin/webbuilder/add")}
                className="px-4 py-2 rounded bg-gray-900 text-white border border-transparent hover:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-colors flex items-center"
            >
                <span className="mr-1">+</span> Add Page
            </button>
        </div>
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
