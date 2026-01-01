import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { AgGridReact } from "ag-grid-react";
import { ColDef, ICellRendererParams, ModuleRegistry, AllCommunityModule } from "ag-grid-community";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { Edit, Trash2, RefreshCcw, MoreHorizontal, Copy, Edit2, Download, Lock, Unlock } from "lucide-react";
import api from "@/api/api";
import { VisibilityToggleCellRenderer } from "@/shared/components/VisibilityToggle";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/shared/components/ui/Dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu";
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

  // Rename dialog state
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string; slug: string } | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [renameSlug, setRenameSlug] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [renameSaving, setRenameSaving] = useState(false);

  const fetchPages = async () => {
    try {
      const response = await api.get("/v1/pages/");
      setPages(response.data);
    } catch (error) {
      console.error("Error fetching pages:", error);
    }
  };

  useEffect(() => {
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

  const openEditor = (slug: string) => {
    const encoded = encodeURIComponent(slug);
    navigate(`/admin/webbuilder/${encoded}`);
  };

  // Duplicate page
  const duplicatePage = async (page: Page) => {
    try {
      const response = await api.post(`/v1/pages/${page._id}/duplicate`);
      const newPage = response.data;
      // Fetch the full page data
      const fullPage = await api.get(`/v1/pages/preview/${newPage.slug}`);
      setPages((prev) => [fullPage.data, ...prev]);
    } catch (error) {
      console.error("Error duplicating page:", error);
      alert("Failed to duplicate page");
    }
  };

  // Open rename dialog
  const openRenameDialog = (page: Page) => {
    setRenameTarget({ id: page._id, title: page.title, slug: page.slug });
    setRenameTitle(page.title);
    setRenameSlug(page.slug);
    setRenameError(null);
    setRenameDialogOpen(true);
  };

  // Handle rename
  const handleRename = async () => {
    if (!renameTarget) return;
    if (!renameTitle.trim() || !renameSlug.trim()) {
      setRenameError("Title and slug are required");
      return;
    }
    setRenameSaving(true);
    setRenameError(null);
    try {
      await api.put(`/v1/pages/${renameTarget.id}`, {
        title: renameTitle.trim(),
        slug: renameSlug.trim(),
      });
      setPages((prev) =>
        prev.map((p) =>
          p._id === renameTarget.id
            ? { ...p, title: renameTitle.trim(), slug: renameSlug.trim() }
            : p
        )
      );
      setRenameDialogOpen(false);
    } catch (error: any) {
      const detail = error?.response?.data?.detail || "Failed to rename page";
      setRenameError(typeof detail === "string" ? detail : "Failed to rename page");
    } finally {
      setRenameSaving(false);
    }
  };

  // Export page as JSON
  const exportPage = async (page: Page) => {
    try {
      const response = await api.get(`/v1/pages/preview/${page.slug}`);
      const pageData = response.data;

      // Remove sensitive fields
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { _id, created_at, updated_at, ...exportData } = pageData;

      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `page-${page.slug}-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting page:", error);
      alert("Failed to export page");
    }
  };

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      headerName: "Title",
      field: "title",
      sortable: true,
      filter: true,
      flex: 2,
    },
    {
      headerName: "Slug",
      field: "slug",
      sortable: true,
      filter: true,
      flex: 1,
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
      headerName: "Actions",
      field: "actions",
      width: 110,
      cellRenderer: (params: any) => {
        const page = params.data;
        return (
          <div className="flex items-center gap-2">
            {/* Edit button */}
            <button
              onClick={() => openEditor(page.slug)}
              className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
              title="Edit page"
            >
              <Edit size={16} />
            </button>

            {/* Dropdown menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded transition-colors">
                  <MoreHorizontal size={16} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => duplicatePage(page)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => openRenameDialog(page)}>
                  <Edit2 className="mr-2 h-4 w-4" />
                  Rename/Change Slug
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportPage(page)}>
                  <Download className="mr-2 h-4 w-4" />
                  Export JSON
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => toggleLock(page._id, page.locked ?? false)}>
                  {page.locked ? (
                    <>
                      <Unlock className="mr-2 h-4 w-4" />
                      Unlock
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Lock
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => deletePage(page._id)}
                  disabled={page.locked}
                  className="text-red-600 focus:text-red-600"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
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
    return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
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
      <div className="flex justify-end items-center mb-4 gap-2">
        <Button variant="outline" size="sm" onClick={fetchPages} title="Refresh">
          <RefreshCcw className="h-4 w-4" />
        </Button>
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

      {/* Rename Page Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Page</DialogTitle>
            <DialogDescription>
              Update the title and slug for this page. The slug is used in the URL.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Title</label>
              <Input
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                placeholder="Page title"
                disabled={renameSaving}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Slug</label>
              <Input
                value={renameSlug}
                onChange={(e) => setRenameSlug(e.target.value)}
                placeholder="page-slug"
                disabled={renameSaving}
                className="mt-1"
              />
            </div>
            {renameError && (
              <div className="text-sm text-destructive">{renameError}</div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setRenameDialogOpen(false)}
              disabled={renameSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRename}
              disabled={renameSaving || !renameTitle.trim() || !renameSlug.trim()}
            >
              {renameSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WebBuilderPageList;
