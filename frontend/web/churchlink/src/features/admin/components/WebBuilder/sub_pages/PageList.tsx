import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ICellRendererParams, ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { Edit, Trash2 } from "lucide-react";
import api from "@/api/api";
import MultiStateBadge from "@/shared/components/MultiStageBadge";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/shared/components/ui/Dialog";

// Register AG Grid modules
ModuleRegistry.registerModules([AllCommunityModule]);

interface Page {
  _id: string;
  title: string;
  slug: string;
  visible: boolean;
  locked?: boolean;
}

// Cell renderer component for visibility column
const VisibilityCellRendererComponent: React.FC<{ data: Page; value: boolean; setPages: React.Dispatch<React.SetStateAction<Page[]>> }> = ({ data, value, setPages }) => {
  const [badgeState, setBadgeState] = useState<"custom" | "processing" | "success" | "error">("custom");

  const handleToggleVisibility = async () => {
    if (badgeState !== "custom") return;
    const newVisibility = !value;
    setBadgeState("processing");

    try {
      await api.put(`/v1/pages/${data._id}`, { visible: newVisibility });
      setBadgeState("success");
      setTimeout(() => {
        setPages((prev: Page[]) =>
          prev.map((p) => (p._id === data._id ? { ...p, visible: newVisibility } : p))
        );
        setBadgeState("custom");
      }, 900);
    } catch (error) {
      console.error("Error updating page visibility:", error);
      setBadgeState("error");
      setTimeout(() => setBadgeState("custom"), 1200);
    }
  };

  return (
    <div className="flex items-center justify-center h-full w-full overflow-visible">
      <MultiStateBadge
        state={badgeState}
        onClick={handleToggleVisibility}
        customComponent={
          <span
            className={`inline-block px-2 py-1 text-xs rounded-full font-medium cursor-pointer ${
              value
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {value ? "Visible" : "Hidden"}
          </span>
        }
      />
    </div>
  );
};

// Cell renderer function for visibility column
const VisibilityCellRenderer = (props: ICellRendererParams<Page>) => {
  const { data, value, context } = props;
  if (!data) return null;

  const { setPages } = context as { setPages: React.Dispatch<React.SetStateAction<Page[]>> };

  return <VisibilityCellRendererComponent data={data} value={value} setPages={setPages} />;
};

const WebBuilderPageList = () => {
  const [pages, setPages] = useState<Page[]>([]);
  const navigate = useNavigate();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newSlug, setNewSlug] = useState("");
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
            onClick={() => navigate(`/admin/webbuilder/edit/${encodeURIComponent(params.data.slug)}`)}
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

  const slugify = (s: string) => {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  };

  const openAddDialog = () => {
    setNewTitle("");
    setNewSlug("");
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
          context={{ setPages }}
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
                  if (!newSlug) setNewSlug(slugify(e.target.value));
                }}
                placeholder="Home, About, Contact..."
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm">Slug</label>
              <Input
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="about-us or / for home page"
                className="mt-1"
              />
            </div>
            {error && <div className="text-xs text-destructive">{error}</div>}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsAddOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={saveNewPage} disabled={saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WebBuilderPageList;
