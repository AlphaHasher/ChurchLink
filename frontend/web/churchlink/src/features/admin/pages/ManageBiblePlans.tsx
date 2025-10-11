import { useEffect, useState, useRef } from 'react';
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
import { Switch } from '@/shared/components/ui/switch';
import { MoreHorizontal, Pencil, Copy, Download, Trash, RefreshCcw } from 'lucide-react';
import { Skeleton } from '@/shared/components/ui/skeleton';

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
    handleEdit,
    handleDuplicate,
    handleExport,
    setRenameTarget,
    setConfirmDeleteIds
  } = context;

  return (
    <div className="flex items-center justify-start gap-2 h-full">
      <Button size="sm" variant="outline" onClick={() => handleEdit(data.id)}>
        <Pencil className="h-4 w-4 mr-2" /> Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => handleDuplicate(data.id)}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRenameTarget({ id: data.id, name: data.name })}><Pencil className="h-4 w-4 mr-2" /> Rename</DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleExport(data.id)}><Download className="h-4 w-4 mr-2" /> Export JSON</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600" onClick={() => setConfirmDeleteIds([data.id])}><Trash className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

const ManageBiblePlans = () => {
  const navigate = useNavigate();
  const gridRef = useRef<AgGridReact>(null);
  const [allPlans, setAllPlans] = useState<any[]>([]);
  const [searchName, setSearchName] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState('');

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      setLoading(true);
  const resp = await api.get('/v1/bible-plans/');
      setAllPlans(resp.data || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load bible plans', err);
      setLoading(false);
      setStatus('Failed to load plans');
    }
  };

  const handleEdit = (planId: string) => {
    navigate(`/admin/bible-plans/plan-builder?id=${planId}`);
  };

  const handleToggleVisible = async (planId: string, visible: boolean) => {
    try {
      await api.patch(`/v1/bible-plans/${planId}`, { visible });
      setAllPlans((prev) => prev.map((p) => (p.id === planId ? { ...p, visible } : p)));
      setStatus('Visibility updated');
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error('Failed to toggle visibility', err);
      setStatus('Failed to update visibility');
    }
  };

  const handleDuplicate = async (planId: string) => {
    try {
      setStatus('Duplicating...');
      const resp = await api.post(`/v1/bible-plans/${planId}/duplicate`);
      const newPlan = resp.data;
      setAllPlans((prev) => [newPlan, ...prev]);
      setStatus(`Duplicated as "${newPlan.name}"`);
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error('Failed to duplicate plan', err);
      setStatus('Failed to duplicate');
    }
  };

  const handleExport = async (planId: string) => {
    try {
      const plan = allPlans.find((p) => p.id === planId);
      if (!plan) return;
      
      // Exclude user_id and other sensitive fields from export
      const { user_id, id, created_at, updated_at, ...exportData } = plan;
      
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${plan.name || 'bible-plan'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setStatus('Exported successfully');
      setTimeout(() => setStatus(null), 3000);
    } catch (err) {
      console.error('Failed to export plan', err);
      setStatus('Failed to export');
    }
  };

  const handleRename = async () => {
    if (!renameTarget || !newName.trim()) return;

    try {
      await api.patch(`/v1/bible-plans/${renameTarget.id}`, { name: newName.trim() });
      setAllPlans((prev) => prev.map((p) => (p.id === renameTarget.id ? { ...p, name: newName.trim() } : p)));
      setStatus('Renamed successfully');
      setTimeout(() => setStatus(null), 3000);
      setRenameTarget(null);
      setNewName('');
    } catch (err) {
      console.error('Failed to rename plan', err);
      setStatus('Failed to rename');
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteIds || confirmDeleteIds.length === 0) return;

    try {
      setStatus('Deleting...');
      for (const id of confirmDeleteIds) {
        await api.delete(`/v1/bible-plans/${id}`);
      }
      setAllPlans((prev) => prev.filter((p) => !confirmDeleteIds.includes(p.id)));
      setStatus(`Deleted ${confirmDeleteIds.length} plan(s)`);
      setTimeout(() => setStatus(null), 3000);
      setConfirmDeleteIds(null);
    } catch (err) {
      console.error('Failed to delete plans', err);
      setStatus('Failed to delete');
    }
  };

  const filteredPlans = allPlans.filter((plan) => {
    if (searchName && !plan.name?.toLowerCase().includes(searchName.toLowerCase())) return false;
    return true;
  });

  const columnDefs: ColDef[] = [
    {
      field: 'name',
      headerName: 'Plan Name',
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
      field: 'visible',
      headerName: 'Visible',
      flex: 1,
      cellRenderer: VisibleCellRenderer,
    },
    {
      headerName: 'Actions',
      flex: 2,
      cellRenderer: ActionsCellRenderer,
      sortable: false,
      filter: false,
    },
  ];

  const gridContext = {
    handleEdit,
    handleToggleVisible,
    handleDuplicate,
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
        <h1 className="text-2xl font-semibold">Manage Bible Plans</h1>
        <div className="flex items-center gap-2">
          <Button onClick={loadPlans} variant="outline" size="sm">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => navigate('/admin/bible-plans/plan-builder')}>
            Create New Plan
          </Button>
        </div>
      </div>

      {status && (
        <div className="mb-4 p-3 rounded-md bg-muted text-sm">
          {status}
        </div>
      )}

      <div className="mb-4">
        <Input
          placeholder="Search by plan name..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
          className="max-w-md"
        />
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
            rowData={filteredPlans}
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
            <DialogTitle>Rename Bible Plan</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="New plan name"
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
            <AlertDialogTitle>Delete Bible Plan(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {confirmDeleteIds?.length} plan(s)? This action cannot be undone.
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

export default ManageBiblePlans;
