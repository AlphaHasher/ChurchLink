import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/api/api";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const AddPage = () => {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const generateSlug = (text: string) => {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-");
  };

  const checkSlugExists = async (slug: string): Promise<boolean> => {
    try {
      const response = await api.get(`/v1/pages/check-slug?slug=${slug}`);
      return !response.data.available;
    } catch (err) {
      console.error("Error checking slug:", err);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSlug = generateSlug(title);
    setLoading(true);

    try {
      const slugExists = await checkSlugExists(newSlug);
      if (slugExists) {
        toast.error("Slug already exists. Please choose a different title.");
        setLoading(false);
        return;
      }

      const res = await api.post("/v1/pages", {
        title,
        slug: newSlug,
        visible: true,
        sections: [],
      });

      if (res.data._id) {
        navigate("/admin/webbuilder");
        toast.success("Page created successfully!");
      }
    } catch (err: any) {
      console.error(err);
      const message =
        err?.response?.data?.detail ||
        err?.response?.data?.error ||
        err?.message ||
        "Failed to create page. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto bg-white shadow-md p-6 rounded">
      <h2 className="text-xl font-semibold mb-4">Create New Page</h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Page Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="border rounded px-3 py-2"
          required
        />

        <button
          type="submit"
          disabled={loading}
          className={`${loading ? "bg-blue-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
            } text-white px-4 py-2 rounded`}
        >
          {loading ? "Creating..." : "Create Page"}
        </button>

        {error && <p className="text-red-500 text-sm">{error}</p>}
      </form>
    </div>
  );
};

export default AddPage;
