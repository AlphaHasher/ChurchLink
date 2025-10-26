import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, Save, ArrowUp, ArrowDown, Image } from "lucide-react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  getDashboardPages,
  saveDashboardPageConfiguration,
  DashboardPage,
  updateDashboardPage,
  deleteDashboardPage
} from "../../../helpers/PagesHelper";

interface EditingPage extends DashboardPage {
  isNew?: boolean;
}

const ALLOWED_PAGES = [
  { pageName: "join live", displayName: "Join Live" },
  { pageName: "events", displayName: "Events" },
  { pageName: "ministries", displayName: "Ministries" },
  { pageName: "sermons", displayName: "Sermons" },
  { pageName: "giving", displayName: "Giving" },
  { pageName: "contact us", displayName: "Contact Us" },
];

const DashboardPagesManager = () => {
  const [pages, setPages] = useState<DashboardPage[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingPage, setEditingPage] = useState<EditingPage | null>(null);
  const [selectedPageToAdd, setSelectedPageToAdd] = useState<string>("");

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    setLoading(true);
    setError(null);
    try {
      const pageData = await getDashboardPages();
      const processedPages = [...pageData];
      processedPages.forEach((page, index) => (page.index = index));
      setPages(processedPages);
    } catch (err) {
      setError("Failed to load dashboard pages");
      setPages([]);
    } finally {
      setLoading(false);
    }
  };

  const savePages = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const success = await saveDashboardPageConfiguration(pages);
      if (success) {
        setSuccess("Dashboard configuration saved successfully!");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error("Failed to save dashboard pages");
      }
    } catch (err: any) {
      setError(err.message || "Failed to save dashboard pages");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPage = (pageName: string) => {
    const allowedPage = ALLOWED_PAGES.find((p) => p.pageName === pageName);
    if (!allowedPage) {
      setError("Invalid page selection");
      return;
    }
    const exists = pages.some(
      (page) => page.pageName.toLowerCase() === pageName.toLowerCase()
    );
    if (exists) {
      setError("Page already exists");
      return;
    }
    const newIndex = pages.length;
    setEditingPage({
      index: newIndex,
      pageName: allowedPage.pageName,
      displayName: allowedPage.displayName,
      imageId: "",
      enabled: true,
      isNew: true,
    });
    setSelectedPageToAdd("");
  };

  const getAvailablePagesToAdd = () => {
    return ALLOWED_PAGES.filter(
      (allowedPage) =>
        !pages.some(
          (page) =>
            page.pageName.toLowerCase() === allowedPage.pageName.toLowerCase()
        )
    );
  };

  const handleEditPage = (page: DashboardPage) => {
    setEditingPage({ ...page });
  };

  const handleDeletePage = async (index: number) => {
    if (!confirm("Are you sure you want to delete this page?")) return;

    try {
      setError(null);
      setSuccess(null);

      const success = await deleteDashboardPage(index);

      if (success) {
        const newPages = pages.filter((page) => page.index !== index);
        newPages.forEach((page, idx) => (page.index = idx));
        setPages(newPages);

        setSuccess(`Page ${index} deleted successfully`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        throw new Error(`Failed to delete page ${index}`);
      }
    } catch (err: any) {
      console.error("Failed to delete page:", err);
      setError(err.message || "Failed to delete page");
    }
  };


  const handleMovePage = (index: number, direction: "up" | "down") => {
    const pageIndex = pages.findIndex((p) => p.index === index);
    const newPages = [...pages];
    if (direction === "up" && pageIndex > 0) {
      [newPages[pageIndex], newPages[pageIndex - 1]] = [
        newPages[pageIndex - 1],
        newPages[pageIndex],
      ];
    } else if (direction === "down" && pageIndex < newPages.length - 1) {
      [newPages[pageIndex], newPages[pageIndex + 1]] = [
        newPages[pageIndex + 1],
        newPages[pageIndex],
      ];
    }
    newPages.forEach((p, idx) => (p.index = idx));
    setPages(newPages);
  };

    const handleSaveEdit = async () => {
      if (!editingPage || !editingPage.pageName || !editingPage.displayName) {
        setError("Page name and Display Name are required");
        return;
      }

      try {
        let newPages;
        if (editingPage.isNew) {
        const exists = pages.some(
          (p) =>
            p.pageName.toLowerCase() === editingPage.pageName.toLowerCase() ||
            p.index === editingPage.index
        );
        if (exists) {
          setError("Page name or index already exists");
          return;
        }

        newPages = [...pages, { ...editingPage, isNew: undefined }].sort(
          (a, b) => a.index - b.index
        );
        setPages(newPages);
        const success = await saveDashboardPageConfiguration(newPages);
        if (!success) throw new Error("Failed to create new page");

      } else {
        newPages = pages.map((p) =>
          p.index === editingPage.index
            ? { ...editingPage, isNew: undefined }
             : p
        );
        setPages(newPages);

        const success = await updateDashboardPage(editingPage.index, editingPage);
        if (!success) throw new Error("Failed to update page");
      }

      setSuccess("Changes saved successfully!");
      setTimeout(() => setSuccess(null), 3000);
      setEditingPage(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to save changes");
    }
  };


  const handleCancelEdit = () => {
    setEditingPage(null);
    setError(null);
  };

  if (loading) {
    return (
      <div className="p-6 bg-background text-foreground">
        <h1 className="text-3xl font-bold mb-6">Dashboard Pages Configuration</h1>
        <div className="text-center py-8">
          <Skeleton className="h-8 w-1/3 mx-auto" />
          <Skeleton className="h-48 w-full mt-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-background text-foreground">
      <h1 className="text-3xl font-bold mb-6">Dashboard Pages Configuration</h1>

      {/* Page Management Section */}
      <div className="bg-card border border-border rounded-lg shadow-sm p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Manage Dashboard Pages</h2>
          <div className="flex gap-2 items-center">
            <div className="relative">
              <select
                value={selectedPageToAdd}
                onChange={(e) => setSelectedPageToAdd(e.target.value)}
                disabled={!!editingPage}
                className="w-[260px] appearance-none bg-background border border-input rounded-md px-3 py-2 pr-10"
              >
                <option value="">Select page to add...</option>
                {getAvailablePagesToAdd().map((page) => (
                  <option key={page.pageName} value={page.pageName}>
                    {page.displayName}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => {
                if (selectedPageToAdd) handleAddPage(selectedPageToAdd);
              }}
              className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 flex items-center gap-2"
              disabled={!!editingPage}
            >
              <Plus size={16} />
              Add Page
            </button>
            <button
              onClick={savePages}
              className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 flex items-center gap-2"
              disabled={saving || !!editingPage}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-destructive/10 border border-destructive/50 text-destructive px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-primary/10 border border-primary/50 text-foreground px-4 py-3 rounded mb-4">
            {success}
          </div>
        )}

        {/* Editing Form */}
        {editingPage && (
          <div className="bg-muted border border-border rounded-md p-4 mb-4">
            <h3 className="text-lg font-medium mb-3">
              {editingPage.isNew ? "Add New Page" : "Edit Page"}
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Index</label>
                <input
                  type="number"
                  value={editingPage.index}
                  disabled
                  className="border border-input bg-muted text-foreground rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Page Name</label>
                <input
                  type="text"
                  value={editingPage.pageName}
                  disabled
                  className="border border-input bg-muted text-foreground rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  value={editingPage.displayName}
                  onChange={(e) =>
                    setEditingPage({ ...editingPage, displayName: e.target.value })
                  }
                  className="border border-input bg-background rounded px-3 py-2 w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Image ID</label>
                <input
                  type="text"
                  value={editingPage.imageId || ""}
                  onChange={(e) =>
                    setEditingPage({ ...editingPage, imageId: e.target.value })
                  }
                  placeholder="Enter image _id from image_data collection"
                  className="border border-input bg-background rounded px-3 py-2 w-full"
                />
                <small className="text-muted-foreground">Must match a valid image _id</small>
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <button
                onClick={handleSaveEdit}
                className="bg-primary text-primary-foreground px-4 py-2 rounded hover:bg-primary/90"
              >
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="bg-secondary text-secondary-foreground px-4 py-2 rounded hover:bg-secondary/90"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Pages List */}
        <div className="space-y-2">
          {pages.map((page, idx) => (
            <div
              key={page.index}
              className="flex items-center gap-4 p-3 border border-border rounded-md bg-muted/20"
            >
              <div className="flex flex-col">
                <button
                  onClick={() => handleMovePage(page.index, "up")}
                  disabled={idx === 0}
                  className="text-gray-500 hover:text-gray-700 disabled:opacity-30"
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  onClick={() => handleMovePage(page.index, "down")}
                  disabled={idx === pages.length - 1}
                  className="text-gray-500 hover:text-gray-700 disabled:opacity-30"
                >
                  <ArrowDown size={16} />
                </button>
              </div>

              <div className="flex-1 grid grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Index</div>
                  <div className="font-medium">{page.index}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Page Name</div>
                  <div className="font-medium">{page.pageName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">Display Name</div>
                  <div className="font-medium">{page.displayName}</div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground flex items-center gap-1">
                    <Image size={14} /> Image ID
                  </div>
                  <div className="font-medium">{page.imageId || "—"}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleEditPage(page)}
                  className="text-primary hover:opacity-90"
                  disabled={!!editingPage}
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={() => handleDeletePage(page.index)}
                  className="text-destructive hover:opacity-90"
                  disabled={!!editingPage}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {pages.length === 0 && !editingPage && (
          <div className="text-center py-8 text-muted-foreground">
            No pages configured. Click “Add Page” to create your first dashboard page.
          </div>
        )}
      </div>
    </div>
  );
};

export default DashboardPagesManager;

