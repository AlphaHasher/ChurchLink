import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
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
import { EventMinistryDropdown } from '@/features/admin/components/Events/EventMinistryDropdown';
import { MinistryCards } from '@/shared/components/MinistryCards';
import { VisibilityToggleCellRenderer } from '@/shared/components/VisibilityToggle';
import api from '@/api/api';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { MoreHorizontal, Pencil, FileEdit, Copy, Download, Trash, RefreshCcw, AlertTriangle } from 'lucide-react';
import { slugify } from '@/shared/utils/slugify';
import { fetchResponsesAndDownloadCsv } from '@/shared/utils/csvExport';
import { Skeleton } from '@/shared/components/ui/skeleton';

type MinistryOption = {
  id: string;
  name: string;
};

// Cell renderer for ministry column
const MinistriesCellRenderer = (props: ICellRendererParams) => {
  const { data, context } = props;
  if (!data) return null;

  const ministries: string[] = Array.isArray(data.ministries) ? data.ministries : [];
  const { openMinistryAssignment, availableMinistries } = context;

  // Map ministry IDs to names
  const getMinistryName = (id: string): string => {
    const ministry = availableMinistries?.find((m: { id: string; name: string }) => m.id === id);
    return ministry?.name || id;
  };

  if (!ministries.length) {
    return (
      <div className="flex h-full w-full items-center gap-1" title="No ministries assigned">
        <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0 self-center" />
        <Button
          size="sm"
          variant="ghost"
          onClick={() => openMinistryAssignment([data.id], ministries)}
          className="text-xs text-muted-foreground h-6 px-2"
        >
          Assign ministries
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 w-full min-w-0">
      <MinistryCards 
        ministryIds={ministries}
        availableMinistries={availableMinistries || []}
        className="flex-1"
      />
      <Button
        size="icon"
        variant="ghost"
        onClick={() => openMinistryAssignment([data.id], ministries)}
        className="flex-shrink-0"
        title="Edit ministries"
      >
        <Pencil className="h-4 w-4" />
      </Button>
    </div>
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
    <div className={`flex items-center gap-2 w-full min-w-0 ${!data.visible ? 'text-muted-foreground' : ''}`}>
      <a
        href={`/forms/${data.slug}`}
        target="_blank"
        rel="noreferrer"
        className={`${!data.visible ? 'pointer-events-none' : ''} truncate flex-1 min-w-0`}
        title={`/forms/${data.slug}`}
      >
        {`/forms/${data.slug}`}
      </a>
      <div className={`inline-flex items-center gap-1 flex-shrink-0 ml-auto ${!data.visible ? 'text-muted-foreground' : ''}`}>
        <Button size="icon" variant="ghost" onClick={() => openCreateSlug(data.id, data.slug, true)} title="Edit slug"><Pencil className="h-4 w-4" /></Button>
        <Button size="icon" variant="ghost" onClick={() => handleRemoveSlug(data.id)} title="Remove slug"><Trash className="h-4 w-4" /></Button>
      </div>
    </div>
  ) : (
    <Button size="sm" variant="ghost" onClick={() => openCreateSlug(data.id, context?.slugify ? context.slugify(data.title || '') : '', false)} className="text-muted-foreground">Create Link</Button>
  );
};

const VisibleCellRenderer = VisibilityToggleCellRenderer;

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
    setConfirmDeleteIds
  } = context;

  return (
    <div className="flex items-center h-full gap-2">
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
          <DropdownMenuItem onClick={() => handleExportCsv(data.id)}><Download className="h-4 w-4 mr-2" /> Download Responses</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRenameTarget({ id: data.id, title: data.title })}><Pencil className="h-4 w-4 mr-2" /> Rename</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600" onClick={() => setConfirmDeleteIds([data.id])}><Trash className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// Cell renderer for expired column
const ExpiredCellRenderer = (props: ICellRendererParams) => {
  const { data } = props;
  if (!data) return null;
  const expiresAt = data.expires_at || data.expiresAt || null;
  if (!expiresAt) return <span className="text-sm text-muted-foreground">—</span>;
  try {
    const d = new Date(expiresAt);
    const now = new Date();
    if (isNaN(d.getTime())) return <span className="text-sm text-muted-foreground">Invalid</span>;
    if (d.getTime() <= now.getTime()) {
      return <span className="text-sm text-red-600">Expired</span>;
    }
    return <span className="text-sm text-green-600">Active</span>;
  } catch (e) {
    return <span className="text-sm text-muted-foreground">—</span>;
  }
};

const ManageForms = () => {
  const navigate = useNavigate();
  const gridRef = useRef<AgGridReact>(null);
  const [allForms, setAllForms] = useState<any[]>([]);
  const [availableMinistries, setAvailableMinistries] = useState<MinistryOption[]>([]);
  const [searchName, setSearchName] = useState('');
  const [searchMinistry, setSearchMinistry] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<any[]>([]);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [assignmentTarget, setAssignmentTarget] = useState<{ formIds: string[]; selected: string[] } | null>(null);
  const [slugDialog, setSlugDialog] = useState<{ id: string; slug: string; isExisting?: boolean; autoEnableVisibility?: boolean } | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);
  const [duplicateNameDialog, setDuplicateNameDialog] = useState<{
    formId: string;
    newTitle: string;
    existingId: string;
  } | null>(null);
  const [viewDescription, setViewDescription] = useState<string | null>(null);

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
          <div className="flex items-center gap-2 w-full min-w-0">
            <span className="font-medium flex-shrink-0 max-w-[40%] truncate" title={data.title}>{data.title}</span>
            {data.description ? (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setViewDescription(data.description); }}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline truncate text-left flex-1 min-w-0"
                title="View full description"
              >
                {data.description}
              </button>
            ) : null}
            <div className={`ml-auto inline-flex items-center flex-shrink-0 ${!data.visible ? 'text-muted-foreground' : ''}`}>
              <Button size="icon" variant="ghost" onClick={() => setRenameTarget({ id: data.id, title: data.title })} title="Edit Title"><Pencil className="h-4 w-4" /></Button>
            </div>
          </div>
        );
      },
    },
    {
      headerName: 'Ministries',
      field: 'ministries',
      flex: 1,
      minWidth: 160,
      cellRenderer: MinistriesCellRenderer,
      cellStyle: { display: 'flex', alignItems: 'center', height: '100%' },
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
      minWidth: 120,
      cellRenderer: VisibleCellRenderer,
      cellStyle: { display: 'grid', placeItems: 'center', padding: 0 },
    },
    {
      headerName: 'Expired',
      field: 'expires_at',
      flex: 1,
      minWidth: 100,
      cellRenderer: ExpiredCellRenderer,
    },
    {
      headerName: 'Actions',
      field: 'actions',
      flex: 3,
      minWidth: 300,
      cellRenderer: ActionsCellRenderer,
      cellStyle: { display: 'flex', alignItems: 'center', height: '100%' },
      pinned: 'right',
    },
  ];

  const defaultColDef: ColDef = {
    resizable: true,
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

    // Filter by ministry
    if (searchMinistry && searchMinistry !== 'all') {
      filtered = filtered.filter(form =>
        Array.isArray(form.ministries) && form.ministries.includes(searchMinistry)
      );
    }

    return filtered;
  }, [allForms, searchName, searchMinistry]);

  const refreshFormsAndMinistries = useCallback(
    async (options?: { showSpinner?: boolean }) => {
      const showSpinner = options?.showSpinner ?? false;
      if (showSpinner) {
        setLoading(true);
      }
      try {
        const [formsResp, ministriesResp] = await Promise.all([
          api.get('/v1/forms/'),
          api.get('/v1/ministries'),
        ]);
        setAllForms(formsResp.data || []);
        setAvailableMinistries(ministriesResp.data || []);
      } catch (e) {
        console.error('Failed to refresh forms/ministries', e);
      } finally {
        if (showSpinner) {
          setLoading(false);
        }
      }
    },
    []
  );

  useEffect(() => { void refreshFormsAndMinistries({ showSpinner: true }); }, [refreshFormsAndMinistries]);

  // Client-side filtering is handled by the filteredForms useMemo, no API calls needed


  const handleDelete = async (ids: string[]) => {
    setStatus('Deleting...');
    try {
      await Promise.all(ids.map((id) => api.delete(`/v1/forms/${id}`)));
      setAllForms((prev) => prev.filter((f) => !ids.includes(f.id)));
      setSelectedRows((prev) => prev.filter((row) => !ids.includes(row.id)));
      await refreshFormsAndMinistries();
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
        ministries: form.ministries || [],
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
            ministries: form.ministries || [],
            visible: !!form.visible,
            data: form.data?.data || form.data || [],
          });
          await refreshFormsAndMinistries();
          setStatus('Duplicated');
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
      // If trying to enable visibility, ensure the form has a slug AND ministries first
      if (visible) {
        const form = allForms.find((f) => f.id === id);
        const hasSlug = !!(form && (form.slug || form.slug === 0));
        const hasMinistries = !!(form && Array.isArray(form.ministries) && form.ministries.length > 0);

        if (!hasSlug) {
          setStatus('Please create a link/slug before making the form visible');
          openCreateSlug(id, slugify((form && form.title) || ''), false, true);
          return;
        }

        if (!hasMinistries) {
          setStatus('Please assign ministries before making the form visible');
          setAssignmentTarget({ formIds: [id], selected: [] });
          return;
        }
      }

      await api.put(`/v1/forms/${id}`, { visible });
      setAllForms((prev) => prev.map((f) => (f.id === id ? { ...f, visible } : f)));
      await refreshFormsAndMinistries();
    } catch (e) {
      console.error('Visibility update failed', e);
      setStatus('Visibility update failed');
    }
  };

  const openCreateSlug = (id: string, currentSlug?: string, isExisting: boolean = false, autoEnableVisibility: boolean = false) => {
    setSlugError(null);
    setSlugDialog({ id, slug: currentSlug || '', isExisting, autoEnableVisibility });
  };

  const saveSlug = async () => {
    if (!slugDialog) return;
    const { id, slug, autoEnableVisibility } = slugDialog;
    const cleaned = slugify(slug);
    if (!cleaned) {
      setSlugError('Slug cannot be empty');
      return;
    }

    try {
      const form = allForms.find((f) => f.id === id);
      const hasMinistries = !!(form && Array.isArray(form.ministries) && form.ministries.length > 0);
      const shouldEnableVisibility = autoEnableVisibility && hasMinistries;

      const updates: { slug: string; visible?: boolean } = { slug: cleaned };
      if (shouldEnableVisibility) {
        updates.visible = true;
      }

      await api.put(`/v1/forms/${id}`, updates);

      setAllForms((prev) => prev.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ));

      await refreshFormsAndMinistries();
      setSlugDialog(null);

      if (autoEnableVisibility && !hasMinistries) {
        setStatus('Slug created. Please assign ministries before making the form visible');
        setAssignmentTarget({ formIds: [id], selected: [] });
      }
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
      await refreshFormsAndMinistries();
    } catch (err) {
      setStatus('Failed to remove slug');
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    try {
      await api.put(`/v1/forms/${renameTarget.id}`, { title: renameTarget.title });
      setAllForms((prev) => prev.map((f) => (f.id === renameTarget.id ? { ...f, title: renameTarget.title } : f)));
      await refreshFormsAndMinistries();
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
      await refreshFormsAndMinistries();

      setDuplicateNameDialog(null);
      setRenameTarget(null);
      setStatus('Form overridden successfully');

      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      console.error('Override failed', e);
      setStatus('Override failed');
    }
  };

  const handleAssignMinistries = async () => {
    if (!assignmentTarget || assignmentTarget.selected.length === 0) return;

    const formIds = assignmentTarget.formIds;
    const selectedMinistries = assignmentTarget.selected;

    setAssignmentTarget(null);

    try {
      await Promise.all(
        formIds.map((id) =>
          api.put(`/v1/forms/${id}`, { ministries: selectedMinistries })
        )
      );
      setAllForms((prev) =>
        prev.map((f) =>
          formIds.includes(f.id) ? { ...f, ministries: selectedMinistries } : f
        )
      );
      await refreshFormsAndMinistries();
      setStatus('Ministries assigned successfully');
      setTimeout(() => setStatus(null), 3000);
    } catch (e) {
      console.error('Failed to assign ministries', e);
      setStatus('Failed to assign ministries');
    }
  };

  const openMinistryAssignment = (formIds: string[], currentMinistries: string[] = []) => {
    setAssignmentTarget({
      formIds,
      selected: currentMinistries,
    });
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-4">Forms</h1>

      <FormsTabs />

      <div className="mt-4 p-4 border rounded bg-card text-card-foreground">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center mb-4 justify-between">
          <div className="flex flex-wrap gap-2 items-center">
            <Input
              placeholder="Search by name"
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="w-64 h-9 bg-background"
            />
            <Select value={searchMinistry} onValueChange={(v) => setSearchMinistry(v)}>
              <SelectTrigger className="w-56 h-9 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All ministries</SelectItem>
                {availableMinistries.length > 0 && availableMinistries.map((m: any) => (
                  <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="h-9"
              onClick={() => { setSearchName(''); setSearchMinistry('all'); refreshFormsAndMinistries(); }}
            >
              Clear
            </Button>
            {status && <div className="text-sm text-muted-foreground ml-2">{status}</div>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refreshFormsAndMinistries({ showSpinner: true })} title="Refresh"><RefreshCcw className="h-4 w-4" /></Button>
            <Button onClick={() => navigate('/admin/forms/form-builder?new=1')}>
              <Pencil className="h-4 w-4 mr-2" /> New Form
            </Button>
          </div>
        </div>
        {/* Bulk actions */}
        {selectedRows.length > 0 && (
          <div className="flex items-center justify-between p-2 border rounded mb-3 bg-muted/30">
            <div className="text-sm">{selectedRows.length} selected</div>
            <div className="flex items-center gap-2">
              <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteIds(selectedRows.map(row => row.id))}><Trash className="h-4 w-4 mr-1" /> Delete</Button>
              <Button size="sm" variant="outline" onClick={() => setAssignmentTarget({ formIds: selectedRows.map(row => row.id), selected: [] })}><FileEdit className="h-4 w-4 mr-1" /> Assign ministries</Button>
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
                openCreateSlug,
                handleRemoveSlug,
                navigate,
                handleDuplicate,
                handleExport,
                handleExportCsv,
                setRenameTarget,
                setConfirmDeleteIds,
                handleToggleVisible,
                onToggleVisibility: async (id: string, newVisibility: boolean) => {
                  await handleToggleVisible(id, newVisibility);
                },
                slugify,
                setAssignmentTarget,
                openMinistryAssignment,
                availableMinistries,
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
            <DialogTitle>{slugDialog?.isExisting ? 'Edit link' : 'Create link'}</DialogTitle>
          </DialogHeader>
          <Input value={slugDialog?.slug || ''} onChange={(e) => setSlugDialog((s) => s ? ({ ...s, slug: e.target.value }) : s)} placeholder="Enter slug (letters, numbers, dashes)" />
          {slugError && <div className="text-xs text-destructive mt-2">{slugError}</div>}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSlugDialog(null)}>Cancel</Button>
            <Button onClick={saveSlug}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Description view dialog */}
      <AlertDialog open={!!viewDescription} onOpenChange={(open) => { if (!open) setViewDescription(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Description</AlertDialogTitle>
          </AlertDialogHeader>
          <div className="p-2 text-sm text-muted-foreground">{viewDescription}</div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setViewDescription(null)}>Ok</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {/* Ministry assignment dialog */}
      <Dialog open={!!assignmentTarget} onOpenChange={(open) => { if (!open) setAssignmentTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign ministries to {assignmentTarget?.formIds.length === 1 ? 'form' : `${assignmentTarget?.formIds.length} forms`}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {availableMinistries.length > 0 ? (
              <EventMinistryDropdown
                selected={assignmentTarget?.selected || []}
                onChange={(updated) => {
                  if (assignmentTarget) {
                    setAssignmentTarget({ ...assignmentTarget, selected: updated });
                  }
                }}
                ministries={availableMinistries.map((m: any) => m.name)}
              />
            ) : (
              <div className="text-sm text-muted-foreground">No ministries available. Create one from Admin &gt; Ministries first.</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignmentTarget(null)}>Cancel</Button>
            <Button disabled={!assignmentTarget || assignmentTarget.selected.length === 0} onClick={handleAssignMinistries}>Assign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageForms;
