import { useEffect, useState, useRef } from 'react';
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

ModuleRegistry.registerModules([
  ClientSideRowModelModule,
  PaginationModule,
  RowSelectionModule
]);

import BiblePlansTabs from '@/features/admin/components/BiblePlanManager/BiblePlansTabs';
import api from '@/api/api';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { MoreHorizontal, Pencil, Download, Trash, RefreshCcw } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';

// Cell renderer for actions column
const ActionsCellRenderer = (props: ICellRendererParams) => {
  const { data, context } = props;
  if (!data) return null;

  const {
    handleExport,
    setRenameTarget,
    setConfirmDeleteIds
  } = context;

  return (
    <div className="flex items-center justify-start gap-2 h-full">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => setRenameTarget({ id: data.id, name: data.name })}><Pencil className="h-4 w-4 mr-2" /> Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport(data.id)}><Download className="h-4 w-4 mr-2" /> Export JSON</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600" onClick={() => setConfirmDeleteIds([data.id])}><Trash className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const ManageBiblePlanTemplates = () => {
  const gridRef = useRef<AgGridReact>(null);
  const [allTemplates, setAllTemplates] = useState<any[]>([]);
  const [searchName, setSearchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/v1/bible-plans/templates');
      setAllTemplates(resp.data || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load bible plan templates', err);
      setLoading(false);
      setStatus('Failed to load templates');
    }
  };

  const handleExport = async (templateId: string) => {
    try {
      const template = allTemplates.find((t) => t.id === templateId);
      if (!template) return;
      
      // Exclude id from export
      const { id, ...exportData } = template;
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${template.name || 'bible-plan-template'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Exported successfully');
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error('Failed to export template', err);
      setStatus('Failed to export');
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !newName.trim()) return;

    try {
      await api.patch(`/v1/bible-plans/templates/${renameTarget.id}?name=${encodeURIComponent(newName.trim())}`);
      setAllTemplates((prev) => prev.map((t) => (t.id === renameTarget.id ? { ...t, name: newName.trim() } : t)));
      setStatus('Renamed successfully');
      setTimeout(() => setStatus(null), 3000);
      setRenameTarget(null);
      setNewName('');
    } catch (err: any) {
      console.error('Failed to rename template', err);
      const errorMsg = err.response?.data?.detail || 'Failed to rename';
      setStatus(errorMsg);
      setTimeout(() => setStatus(null), 5000);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteIds || confirmDeleteIds.length === 0) return;

    try {
      setStatus('Deleting...');
      for (const id of confirmDeleteIds) {
        await api.delete(`/v1/bible-plans/templates/${id}`);
      }
      setAllTemplates((prev) => prev.filter((t) => !confirmDeleteIds.includes(t.id)));
      setStatus(`Deleted ${confirmDeleteIds.length} template(s)`);
      setTimeout(() => setStatus(null), 3000);
      setConfirmDeleteIds(null);
    } catch (err) {
      console.error('Failed to delete templates', err);
      setStatus('Failed to delete');
    }
  };

  const filteredTemplates = allTemplates.filter((template) => {
    if (searchName && !template.name?.toLowerCase().includes(searchName.toLowerCase())) return false;
    return true;
  });

  const columnDefs: ColDef[] = [
    {
      field: 'name',
      headerName: 'Template Name',
      flex: 2,
      sortable: true,
      filter: true,
    },
    {
      field: 'duration',
      headerName: 'Plan Length (days)',
      flex: 1,
      sortable: true,
      filter: 'agNumberColumnFilter',
    },
    {
      headerName: 'Actions',
      flex: 1,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
    },
  ];

  const gridContext = {
    handleExport,
    setRenameTarget,
    setConfirmDeleteIds,
  };

  return (
    <div className="p-6">
      <div className="mb-4">
        <BiblePlansTabs />
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold">Manage Bible Plan Templates</h1>
        <div className="flex items-center gap-2">
          <Button onClick={loadTemplates} variant="outline" size="sm">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search by template name..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="max-w-md"
        />
        {status && <div className="text-sm text-muted-foreground">{status}</div>}
      </div>

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="ag-theme-quartz" style={{ height: 600 }}>
          <AgGridReact
            ref={gridRef}
            rowData={filteredTemplates}
            columnDefs={columnDefs}
            context={gridContext}
            pagination={true}
            paginationPageSize={20}
            rowSelection="multiple"
            animateRows={true}
            defaultColDef={{
              resizable: true,
              sortable: false,
              filter: false,
            }}
          />
        </div>
      )}

      {/* Rename Dialog */}
      <Dialog open={!!renameTarget} onOpenChange={(open) => !open && setRenameTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename Bible Plan Template</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="New template name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRenameTarget(null); setNewName(''); }}>
              Cancel
            </Button>
            <Button onClick={handleRename} disabled={!newName.trim()}>
              Rename
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!confirmDeleteIds} onOpenChange={(open) => !open && setConfirmDeleteIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Bible Plan Template(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {confirmDeleteIds?.length} template(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmDeleteIds(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ManageBiblePlanTemplates;
