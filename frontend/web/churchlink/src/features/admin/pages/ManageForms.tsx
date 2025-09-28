import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AgGridReact } from 'ag-grid-react';
import {
  ColDef,
  ICellRendererParams,
  ModuleRegistry,
  ClientSideRowModelModule,
  PaginationModule,
  RowSelectionModule
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

// Register only the modules we need
ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  PaginationModule,
  RowSelectionModule
]);

import FormsTabs from '@/features/admin/components/Forms/FormsTabs';
import api from '@/api/api';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { Switch } from '@/shared/components/ui/switch';
import { MoreHorizontal, Pencil, FileEdit, Copy, Download, Trash, MoveRight, RefreshCcw } from 'lucide-react';
import { fetchResponsesAndDownloadCsv } from '@/shared/utils/csvExport';
import { Skeleton } from '@/shared/components/ui/skeleton';

// Cell renderer for folder column
const FolderCellRenderer = (props: ICellRendererParams) => {
  const { data } = props;
  if (!data) return null;

  const folders = props.context.folders as { _id: string; name: string }[];

  const folderName = (id?: string) => folders.find((f) => f._id === id)?.name || '';

  return folderName(data.folder) ? (
    <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs bg-muted/40">
      {folderName(data.folder)}
    </span>
  ) : (
    <span className="text-muted-foreground">—</span>
  );
};

// Cell renderer for links column
const LinksCellRenderer = (props: ICellRendererParams) => {
  const { data, context } = props;
  if (!data) return null;

  const {
    openCreateSlug,
    handleRemoveSlug
  } = context;

  return data.slug ? (
    <div className={`inline-flex items-center gap-2 ${!data.visible ? 'text-muted-foreground' : ''}`}>
      <a href={`/forms/${data.slug}`} target="_blank" rel="noreferrer" className={`${!data.visible ? 'pointer-events-none' : ''}`}>{`/forms/${data.slug}`}</a>
      <div className={`inline-flex items-center ${!data.visible ? 'text-muted-foreground' : ''}`}>
        <Button size="icon" variant="ghost" onClick={() => openCreateSlug(data.id, data.slug)} title="Edit slug"><Pencil className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={() => handleRemoveSlug(data.id)} title="Remove slug"><Trash className="h-4 w-4" /></Button>
      </div>
    </div>
  ) : (
    <Button size="sm" variant="ghost" onClick={() => openCreateSlug(data.id)} className="text-muted-foreground">Create Link</Button>
  );
};

// Cell renderer for visible column (switch)
const VisibleCellRenderer = (props: ICellRendererParams) => {
  const { data, context } = props;
  if (!data) return null;

  const { handleToggleVisible } = context;

  return (
    <Switch
      checked={!!data.visible}
      onCheckedChange={(c) => handleToggleVisible(data.id, !!c)}
      aria-label="Toggle visibility"
    />
  );
};

// Cell renderer for actions column
const ActionsCellRenderer = (props: ICellRendererParams) => {
  const { data, context } = props;
  if (!data) return null;

  const {
    navigate,
    handleDuplicate,
    handleExport,
    handleExportCsv,
    setRenameTarget,
    setMoveTargetIds,
    setConfirmDeleteIds
  } = context;

  return (
    <div className="flex items-center gap-2">
      <Button size="sm" variant="outline" onClick={() => navigate(`/admin/forms/form-builder?load=${data.id}`)}><FileEdit className="h-4 w-4 mr-1" /> Edit</Button>
      <Button size="sm" variant="outline" onClick={() => navigate(`/admin/forms/responses?formId=${data.id}`)}>View responses</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleDuplicate(data.id)}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport(data.id)}><Download className="h-4 w-4 mr-2" /> Export JSON</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExportCsv(data.id)}><Download className="h-4 w-4 mr-2" /> Export CSV</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRenameTarget({ id: data.id, title: data.title })}><Pencil className="h-4 w-4 mr-2" /> Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={() => { setMoveTargetIds([data.id]); context.setMoveToFolderId(); }}><MoveRight className="h-4 w-4 mr-2" /> Move to...</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600" onClick={() => setConfirmDeleteIds([data.id])}><Trash className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const ManageForms = () => {
  const navigate = useNavigate();
  const gridRef = useRef<AgGridReact>(null);
  const [allForms, setAllForms] = useState<any[]>([]);
  const [folders, setFolders] = useState<{ _id: string; name: string }[]>([]);
  const [searchName, setSearchName] = useState('');
  const [searchFolder, setSearchFolder] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [moveTargetIds, setMoveTargetIds] = useState<string[] | null>(null);
  const [moveToFolderId, setMoveToFolderId] = useState<string>('');
  const [slugDialog, setSlugDialog] = useState<{ id: string; slug: string } | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [duplicateNameDialog, setDuplicateNameDialog] = useState<{
    formId: string;
    newTitle: string;
    existingId: string;
  } | null>(null);

  // Grid options
  const gridOptions = {};

  // Column definitions for ag-grid
  const columnDefs: ColDef[] = [
    {
      headerName: 'Title',
      field: 'title',
      flex: 2,
      minWidth: 200,
      cellRenderer: (props: ICellRendererParams) => {
        const { data } = props;
        if (!data) return null;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium">{data.title}</span>
            {data.description ? <span className="text-xs text-muted-foreground">{data.description}</span> : null}
          </div>
        );
      },
    },
    {
      headerName: 'Folder',
      field: 'folder',
      flex: 1,
      minWidth: 120,
      cellRenderer: FolderCellRenderer,
    },
    {
      headerName: 'Links',
      field: 'slug',
      flex: 2,
      minWidth: 200,
      cellRenderer: LinksCellRenderer,
    },
    {
      headerName: 'Visible',
      field: 'visible',
      flex: 1,
      minWidth: 80,
      cellRenderer: VisibleCellRenderer,
    },
    {
      headerName: 'Actions',
      field: 'actions',
      flex: 3,
      minWidth: 300,
      cellRenderer: ActionsCellRenderer,
      pinned: 'right',
    },
  ];

  const defaultColDef: ColDef = {
    resizable: true,
  };

  const fetchForms = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/v1/forms/');
      setAllForms(resp.data || []);
    } catch (e) {
      console.error('Failed to fetch forms', e);
    } finally {
      setLoading(false);
    }
  };

  // Client-side filtering based on search criteria
  const filteredForms = useMemo(() => {
    if (!allForms.length) return [];

    let filtered = allForms;

    // Filter by name (substring match on title)
    if (searchName && searchName.trim()) {
      const searchTerm = searchName.toLowerCase().trim();
      filtered = filtered.filter(form =>
        form.title && form.title.toLowerCase().includes(searchTerm)
      );
    }

    // Filter by folder
    if (searchFolder && searchFolder !== 'all') {
      filtered = filtered.filter(form => form.folder === searchFolder);
    }

    return filtered;
  }, [allForms, searchName, searchFolder]);

  const fetchFolders = async () => {
    try {
      const resp = await api.get('/v1/forms/folders');
      setFolders(resp.data || []);
    } catch (e) {
      console.error('Failed to fetch folders', e);
    }
  };

  useEffect(() => { fetchForms(); fetchFolders(); }, []);

  // Client-side filtering is handled by the filteredForms useMemo, no API calls needed


  const handleDelete = async (ids: string[]) => {
    setStatus('Deleting...');
    try {
      await Promise.all(ids.map((id) => api.delete(`/v1/forms/${id}`)));
      setAllForms((prev) => prev.filter((f) => !ids.includes(f.id)));
      setSelectedRows((prev) => prev.filter((row) => !ids.includes(row.id)));
      setStatus('Deleted');
    } catch (e) {
      console.error('Delete failed', e);
      setStatus('Delete failed');
    } finally {
      setConfirmDeleteIds(null);
    }
  };

  const downloadJson = (obj: any, filename: string) => {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportCsv = async (id: string) => {
    try {
      const resp = await api.get(`/v1/forms/${id}`);
      const form = resp.data;
      await fetchResponsesAndDownloadCsv(id, { existingColumns: [], limit: 500, filename: `${form.title || 'responses'}.csv` });
    } catch (e) {
      console.error('Export CSV failed', e);
      setStatus('Export CSV failed');
    }
  };

  const handleExport = async (id: string) => {
    try {
      const resp = await api.get(`/v1/forms/${id}`);
      const form = resp.data;
      const exportObj = {
        title: form.title || 'Untitled Form',
        description: form.description || '',
        folder: form.folder || null,
        data: form.data?.data || form.data || [],
      };
      downloadJson(exportObj, `${exportObj.title || 'form'}.json`);
    } catch (e) {
      console.error('Export failed', e);
      setStatus('Export failed');
    }
  };

  const handleDuplicate = async (id: string) => {
    setStatus('Duplicating...');
    try {
      const resp = await api.get(`/v1/forms/${id}`);
      const form = resp.data;
      const originalTitle = form.title || 'Untitled Form';
      let attempt = 1;
      let newTitle = `${originalTitle} (copy)`;
      while (attempt <= 5) {
        try {
          await api.post('/v1/forms/', {
            title: newTitle,
            description: form.description || '',
            folder: form.folder || null,
            visible: !!form.visible,
            data: form.data?.data || form.data || [],
          });
          setStatus('Duplicated');
          await fetchForms();
          return;
        } catch (err: any) {
          if (err?.response?.status === 409) {
            attempt += 1;
            newTitle = `${originalTitle} (copy ${attempt})`;
            continue;
          }
          throw err;
        }
      }
      setStatus('Duplicate failed: too many name conflicts');
    } catch (e) {
      console.error('Duplicate failed', e);
      setStatus('Duplicate failed');
    }
  };

  const handleToggleVisible = async (id: string, visible: boolean) => {
    try {
      await api.put(`/v1/forms/${id}`, { visible });
      setAllForms((prev) => prev.map((f) => (f.id === id ? { ...f, visible } : f)));
    } catch (e) {
      console.error('Visibility update failed', e);
      setStatus('Visibility update failed');
    }
  };

  const slugify = (s: string) => {
    return s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  };

  const openCreateSlug = (id: string, currentSlug?: string) => {
    setSlugError(null);
    setSlugDialog({ id, slug: currentSlug || '' });
  };

  const saveSlug = async () => {
    if (!slugDialog) return;
    const { id, slug } = slugDialog;
    const cleaned = slugify(slug);
    if (!cleaned) { setSlugError('Slug cannot be empty'); return; }
    try {
      await api.put(`/v1/forms/${id}`, { slug: cleaned });
      setAllForms((prev) => prev.map((f) => (f.id === id ? { ...f, slug: cleaned } : f)));
      setSlugDialog(null);
    } catch (err: any) {
      if (err?.response?.status === 409) {
        setSlugError('Slug already exists. Pick a different value.');
      } else {
        setSlugError('Failed to save slug');
      }
    }
  };

  const handleRemoveSlug = async (id: string) => {
    try {
      await api.put(`/v1/forms/${id}`, { slug: null });
      setAllForms((prev) => prev.map((f) => (f.id === id ? { ...f, slug: undefined } : f)));
    } catch (err) {
      setStatus('Failed to remove slug');
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    try {
      await api.put(`/v1/forms/${renameTarget.id}`, { title: renameTarget.title });
      setAllForms((prev) => prev.map((f) => (f.id === renameTarget.id ? { ...f, title: renameTarget.title } : f)));
      setRenameTarget(null);
    } catch (e: any) {
      console.error('Rename failed', e);
      if (e?.response?.status === 409) {
        const payload = e.response?.data || e.response?.data?.detail || {};
        const existingId = payload?.existing_id || payload?.existingId || (payload?.detail && payload.detail.existing_id) || null;
        if (existingId) {
          // Show duplicate name dialog
          setDuplicateNameDialog({
            formId: renameTarget.id,
            newTitle: renameTarget.title,
            existingId: existingId
          });
          return;
        }
      }
      setStatus('Rename failed');
    }
  };

  const handleOverrideDuplicate = async () => {
    if (!duplicateNameDialog || !renameTarget) return;
    try {
      setStatus('Overriding form...');
      await api.delete(`/v1/forms/${duplicateNameDialog.formId}`);
      await api.put(`/v1/forms/${duplicateNameDialog.existingId}`, { 
        title: duplicateNameDialog.newTitle
      });
      setAllForms((prev) => prev.filter((f) => f.id !== duplicateNameDialog.formId));
      setAllForms((prev) => prev.map((f) =>
        f.id === duplicateNameDialog.existingId ? { ...f, title: duplicateNameDialog.newTitle } : f
      ));
      
      setDuplicateNameDialog(null);
      setRenameTarget(null);
      setStatus('Form overridden successfully');
      
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      console.error('Override failed', e);
      setStatus('Override failed');
    }
  };

  const handleMove = async () => {
    if (!moveTargetIds || !moveToFolderId) return;
    try {
      await Promise.all(moveTargetIds.map((id) => api.put(`/v1/forms/${id}`, { folder: moveToFolderId })));
      setAllForms((prev) => prev.map((f) => (moveTargetIds.includes(f.id) ? { ...f, folder: moveToFolderId } : f)));
      setMoveTargetIds(null);
      setMoveToFolderId('');
    } catch (e) {
      console.error('Move failed', e);
      setStatus('Move failed');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold mb-4">Forms</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchForms} title="Refresh"><RefreshCcw className="h-4 w-4" /></Button>
          <Button onClick={() => navigate('/admin/forms/form-builder?new=1')}>
            <Pencil className="h-4 w-4 mr-2" /> New Form
          </Button>
        </div>
      </div>

      <FormsTabs />

      <div className="mt-4 p-4 bg-white border rounded">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center mb-4">
          <Input placeholder="Search by name" value={searchName} onChange={(e) => setSearchName(e.target.value)} className="w-56" />
          <Select value={searchFolder} onValueChange={(v) => setSearchFolder(v)}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Filter by folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All folders</SelectItem>
              {folders.map((f) => (
                <SelectItem key={f._id} value={f._id}>{f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => { setSearchName(''); setSearchFolder('all'); fetchForms(); }}>Clear</Button>
          {status && <div className="text-sm text-muted-foreground ml-2">{status}</div>}    
        </div>
        {/* Bulk actions */}
        {selectedRows.length > 0 && (
          <div className="flex items-center justify-between p-2 border rounded mb-3 bg-muted/30">
            <div className="text-sm">{selectedRows.length} selected</div>
            <div className="flex items-center gap-2">
              <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteIds(selectedRows.map(row => row.id))}><Trash className="h-4 w-4 mr-1" /> Delete</Button>
              <Button size="sm" variant="outline" onClick={() => setMoveTargetIds(selectedRows.map(row => row.id))}><MoveRight className="h-4 w-4 mr-1" /> Move to...</Button>
              <Button size="sm" variant="outline" onClick={async () => { for (const row of selectedRows) await handleExport(row.id); }}><Download className="h-4 w-4 mr-1" /> Export</Button>
            </div>
          </div>
        )}

        {/* Ag-Grid Table */}
        <div className="ag-theme-quartz" style={{ height: 500, width: '100%' }}>
          {loading ? (
            <div className="p-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <div className="grid grid-cols-5 gap-3">
                  <Skeleton className="h-8 col-span-2" />
                  <Skeleton className="h-8 col-span-1" />
                  <Skeleton className="h-8 col-span-1" />
                  <Skeleton className="h-8 col-span-1" />
                </div>
              </div>
            </div>
          ) : filteredForms.length === 0 ? (
            <div className="p-4 text-muted-foreground">No forms found</div>
          ) : (
            <AgGridReact
              ref={gridRef}
              rowData={filteredForms}
              columnDefs={columnDefs}
              defaultColDef={defaultColDef}
              rowSelection={{ mode: 'multiRow' }}
              gridOptions={gridOptions}
              onSelectionChanged={(event) => {
                const selectedNodes = event.api.getSelectedNodes();
                setSelectedRows(selectedNodes.map(node => node.data));
              }}
              context={{
                folders,
                openCreateSlug,
                handleRemoveSlug,
                navigate,
                handleDuplicate,
                handleExport,
                handleExportCsv,
                setRenameTarget,
                setMoveTargetIds,
                setMoveToFolderId: () => setMoveToFolderId(''),
                setConfirmDeleteIds,
                handleToggleVisible,
              }}
              pagination={true}
              paginationPageSizeSelector={[10, 20, 50]}
              animateRows={true}
              enableCellTextSelection={true}
            />
          )}
        </div>

      </div>

      {/* Delete confirm dialog */}
      <AlertDialog open={!!confirmDeleteIds} onOpenChange={(open) => { if (!open) setConfirmDeleteIds(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {confirmDeleteIds && confirmDeleteIds.length > 1 ? `${confirmDeleteIds.length} forms` : 'form'}?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDeleteIds(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDeleteIds && handleDelete(confirmDeleteIds)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Duplicate name dialog */}
      <AlertDialog open={!!duplicateNameDialog} onOpenChange={(open) => { if (!open) { setDuplicateNameDialog(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Form name already exists</AlertDialogTitle>
            <AlertDialogDescription>
              A form named "{duplicateNameDialog?.newTitle}" already exists. This will delete the current form and rename the existing one. Do you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setDuplicateNameDialog(null); }}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverrideDuplicate} className="bg-red-600 hover:bg-red-700">Override</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Slug create/edit dialog */}
      <Dialog open={!!slugDialog} onOpenChange={(open) => { if (!open) setSlugDialog(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{slugDialog?.slug ? 'Edit link' : 'Create link'}</DialogTitle>
          </DialogHeader>
          <Input value={slugDialog?.slug || ''} onChange={(e) => setSlugDialog((s) => s ? ({ ...s, slug: e.target.value }) : s)} placeholder="Enter slug (letters, numbers, dashes)" />
          {slugError && <div className="text-xs text-destructive mt-2">{slugError}</div>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSlugDialog(null)}>Cancel</Button>
            <Button onClick={saveSlug}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Rename dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => { if (!open) setRenameTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename form</DialogTitle>
          </DialogHeader>
          <Input value={renameTarget?.title || ''} onChange={(e) => setRenameTarget((prev) => prev ? ({ ...prev, title: e.target.value }) : prev)} placeholder="New title" />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameTarget(null)}>Cancel</Button>
            <Button onClick={handleRename}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Move dialog */}
      <Dialog open={!!moveTargetIds} onOpenChange={(open) => { if (!open) { setMoveTargetIds(null); setMoveToFolderId(''); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Move {moveTargetIds && moveTargetIds.length > 1 ? `${moveTargetIds.length} forms` : 'form'} to folder</DialogTitle>
          </DialogHeader>
          {folders.length > 0 ? (
            <Select value={moveToFolderId} onValueChange={(v) => setMoveToFolderId(v)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose folder" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((f) => (
                  <SelectItem key={f._id} value={f._id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="text-sm text-muted-foreground">No folders created</div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setMoveTargetIds(null); setMoveToFolderId(''); }}>Cancel</Button>
            <Button disabled={!moveToFolderId} onClick={handleMove}>Move</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageForms;
