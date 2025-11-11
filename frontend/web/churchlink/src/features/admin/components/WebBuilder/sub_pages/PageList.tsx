import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ICellRendererParams, ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { Edit, Trash2 } from "lucide-react";
import api from "@/api/api";
import { VisibilityToggleCellRenderer } from "@/shared/components/VisibilityToggle";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/Dialog";
import { slugify } from "@/shared/utils/slugify";

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface Page {
  _id: string;
  title: string;
  slug: string;
  visible: boolean;
  locked?: boolean;
}

// Cell renderer function for visibility column
const VisibilityCellRenderer = VisibilityToggleCellRenderer;

const WebBuilderPageList = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const navigate = useNavigate();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPages = async () => {
      try {
        const response = await api.get("/v1/pages/");
        setPages(response.data);
      } catch (error) {
        console.error("Error fetching pages:", error);
      }
    };
    fetchPages();
  }, []);


  const toggleLock = async (id: string, current: boolean) => {
    try {
      await api.put(`/v1/pages/${id}`, { locked: !current });
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
      await api.delete(`/v1/pages/${id}`);
      setPages((prev) => prev.filter((p) => p._id !== id));
    } catch (error) {
      console.error("Error deleting page:", error);
    }
  };

  const openEditor = async (slug: string) => {
    const encoded = encodeURIComponent(slug);
    const goNew = () => navigate(`/web-editor/${encoded}`);
    const goOld = () => navigate(`/admin/webbuilder/edit/${encoded}`);
    try {
      // Prefer staging draft if exists
      try {
        const s = await api.get(`/v1/pages/staging/${encoded}`);
        const data = s.data || {};
        const isV2 = data?.version === 2;
        const isEmpty = !Array.isArray(data?.sections) || data.sections.length === 0;
        return (isV2 || isEmpty) ? goNew() : goOld();
      } catch (e: any) {
        if (e?.response?.status !== 404) throw e;
      }
      // Fallback to preview/live
      const p = await api.get(`/v1/pages/preview/${encoded}`);
      const pdata = p.data || {};
      const isV2 = pdata?.version === 2;
      const isEmpty = !Array.isArray(pdata?.sections) || pdata.sections.length === 0;
      return (isV2 || isEmpty) ? goNew() : goOld();
    } catch (err) {
      console.error("Failed to decide editor route, defaulting to old editor", err);
      return goOld();
    }
  };

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: "Title",
      field: "title",
      sortable: true,
      filter: true,
    },
    {
      headerName: "Slug",
      field: "slug",
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <button
          onClick={() => navigate(params.value === '/' ? '/' : `/${params.value}`)}
          className="w-full h-full text-left text-blue-600 hover:text-blue-800 cursor-pointer bg-transparent border-none p-0"
          title={`Navigate to ${params.value}`}
        >
          {params.value}
        </button>
      ),
    },
    {
      headerName: "Visibility",
      field: "visible",
      sortable: true,
      filter: true,
      width: 120,
      cellClass: 'visibility-cell',
      cellStyle: { display: 'grid', placeItems: 'center', padding: 0 },
      cellRenderer: (props: ICellRendererParams<Page>) => VisibilityCellRenderer(props),
    },
    {
      headerName: "Lock Status",
      field: "locked",
      sortable: true,
      filter: true,
      cellRenderer: (params: any) => (
        <button
          onClick={() => toggleLock(params.data._id, params.value ?? false)}
          className="text-sm text-gray-600 hover:underline"
        >
          {params.value ? "Unlock" : "Lock"}
        </button>
      ),
    },
    {
      headerName: "Actions",
      field: "actions",
      cellRenderer: (params: any) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => openEditor(params.data.slug)}
            className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
            title="Edit page"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => deletePage(params.data._id)}
            className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={params.data.locked}
            title="Delete page"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ], [navigate]);

  const defaultColDef = useMemo(() => ({
    resizable: true,
    sortable: true,
    filter: true,
  }), []);

  // Validate slug
  const validateSlug = (slug: string): boolean => {
    if (slug === "/") return true; // Special case for home page
    return /^[a-z0-9-]+$/.test(slug);
  };

  const openAddDialog = () => {
    setNewTitle("");
    setNewSlug("");
    setSlugManuallyEdited(false);
    setSlugError(null);
    setError(null);
    setIsAddOpen(true);
  };

  const saveNewPage = async () => {
    if (!newTitle.trim() || !newSlug.trim()) {
      setError("Title and slug are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // Allow "/" as a special case for home page
      const processedSlug = newSlug === "/" ? "/" : slugify(newSlug);
      const payload = { title: newTitle.trim(), slug: processedSlug } as any;
      await api.post("/v1/pages/", payload);
      // Fetch the created page to append to the table
      const created = await api.get(`/v1/pages/preview/${payload.slug}`);
      setPages((prev) => [created.data, ...prev]);
      setIsAddOpen(false);
    } catch (e: any) {
      const detail = e?.response?.data?.detail || "Failed to create page";
      setError(typeof detail === "string" ? detail : "Failed to create page");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Website Pages</h1>
        <Button onClick={openAddDialog} className="h-9">
          + Add Page
        </Button>
      </div>
      <div className="ag-theme-quartz" style={{ height: 600, width: "100%" }}>
        <AgGridReact
          rowData={pages}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          context={{
            setPages,
            onToggleVisibility: async (id: string, newVisibility: boolean) => {
              await api.put(`/v1/pages/${id}`, { visible: newVisibility });
              setPages((prev) => prev.map((p) => (p._id === id ? { ...p, visible: newVisibility } : p)));
            }
          }}
          pagination={true}
          paginationPageSize={20}
          paginationPageSizeSelector={[10, 20, 50]}
        />
      </div>

      {/* Add Page Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Page</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Title</label>
              <Input
                value={newTitle}
                onChange={(e) => {
                  setNewTitle(e.target.value);
                  if (!slugManuallyEdited) {
                    const titleValue = e.target.value;
                    if (titleValue.trim().toLowerCase() === 'home') {
                      setNewSlug('/');
                    } else {
                      setNewSlug(slugify(titleValue));
                    }
                  }
                }}
                placeholder="Home, About, Contact..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm">Slug</label>
              <Input
                value={newSlug}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewSlug(value);

                  // If slug is cleared, restore auto-slugification
                  if (value.trim() === "") {
                    setSlugManuallyEdited(false);
                    setSlugError(null);
                    // Auto-generate from current title
                    if (newTitle.trim().toLowerCase() === 'home') {
                      setNewSlug('/');
                    } else {
                      setNewSlug(slugify(newTitle));
                    }
                  } else {
                    setSlugManuallyEdited(true);
                    // Validate slug
                    if (!validateSlug(value)) {
                      setSlugError("Only lowercase letters, numbers, and hyphens allowed");
                    } else {
                      setSlugError(null);
                    }
                  }
                }}
                placeholder="about-us or / for home page"
                className="mt-1"
              />
              {slugError && <div className="text-xs text-orange-600 mt-1">{slugError}</div>}
            </div>
            {error && <div className="text-xs text-destructive">{error}</div>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveNewPage} disabled={saving || !!slugError || !newTitle.trim() || !newSlug.trim()}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WebBuilderPageList;
