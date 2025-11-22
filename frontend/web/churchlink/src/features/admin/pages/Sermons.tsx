import { useCallback, useEffect, useState, useRef, useMemo } from 'react';
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

import { fetchSermons } from '@/features/sermons/api/sermonsApi';
import { fetchMinistries } from '@/helpers/MinistriesHelper';
import { ChurchSermon } from '@/shared/types/ChurchSermon';
import { Ministry } from '@/shared/types/Ministry';
import { MinistryCards } from '@/shared/components/MinistryCards';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { MoreHorizontal, Pencil, AlertTriangle, Trash } from 'lucide-react';
import { format } from 'date-fns';
import CreateSermonDialog from '@/features/admin/components/Sermons/CreateSermonDialog';
import EditSermonDialog from '@/features/admin/components/Sermons/EditSermonDialog';
import { Skeleton } from '@/shared/components/ui/skeleton';
import api from '@/api/api';

// Cell renderer for ministry column
const MinistriesCellRenderer = (props: ICellRendererParams) => {
  const { data, context } = props;
  if (!data) return null;

  const ministries: string[] = Array.isArray(data.ministry) ? data.ministry : [];
  const { openMinistryAssignment, availableMinistries } = context;

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

// Cell renderer for actions column
const ActionsCellRenderer = (props: ICellRendererParams) => {
  const { data, context } = props;
  if (!data) return null;

  const {
    handleEdit,
    setConfirmDeleteIds
  } = context;

  return (
    <div className="flex items-center h-full gap-2">
      <Button size="sm" variant="outline" onClick={() => handleEdit(data)}>
        <Pencil className="h-4 w-4 mr-1" /> Edit
      </Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-red-600" onClick={() => setConfirmDeleteIds([data.id])}>
            <Trash className="h-4 w-4 mr-2" /> Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// Cell renderer for published status
const PublishedCellRenderer = (props: ICellRendererParams) => {
  const { data } = props;
  if (!data) return null;
  
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${
        data.published
          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-400/15 dark:text-emerald-200 dark:hover:bg-emerald-400/25'
          : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-400/10 dark:text-amber-200 dark:hover:bg-amber-400/20'
      }`}
    >
      {data.published ? 'Published' : 'Draft'}
    </span>
  );
};

const Sermons = () => {
    const gridRef = useRef<AgGridReact>(null);
    const [sermons, setSermons] = useState<ChurchSermon[]>([]);
    const [availableMinistries, setAvailableMinistries] = useState<Ministry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchName, setSearchName] = useState('');
    const [searchMinistry, setSearchMinistry] = useState<string>('all');
    const [selectedRows, setSelectedRows] = useState<any[]>([]);
    const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
    const [editTarget, setEditTarget] = useState<ChurchSermon | null>(null);
    const [assignmentTarget, setAssignmentTarget] = useState<{ sermonIds: string[]; selected: string[] } | null>(null);

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
              <span className="font-medium truncate" title={data.title}>{data.title}</span>
            </div>
          );
        },
      },
      {
        headerName: 'Speaker',
        field: 'speaker',
        flex: 1,
        minWidth: 150,
      },
      {
        headerName: 'Date Posted',
        field: 'date_posted',
        flex: 1,
        minWidth: 120,
        cellRenderer: (props: ICellRendererParams) => {
          const { data } = props;
          if (!data || !data.date_posted) return null;
          return format(new Date(data.date_posted), 'MMM dd, yyyy');
        },
      },
      {
        headerName: 'Ministries',
        field: 'ministry',
        flex: 1,
        minWidth: 160,
        cellRenderer: MinistriesCellRenderer,
        cellStyle: { display: 'flex', alignItems: 'center', height: '100%' },
      },
      {
        headerName: 'Published',
        field: 'published',
        flex: 1,
        minWidth: 120,
        cellRenderer: PublishedCellRenderer,
        cellStyle: { display: 'flex', alignItems: 'center', height: '100%' },
      },
      {
        headerName: 'Actions',
        field: 'actions',
        flex: 2,
        minWidth: 200,
        cellRenderer: ActionsCellRenderer,
        cellStyle: { display: 'flex', alignItems: 'center', height: '100%' },
        pinned: 'right',
      },
    ];

    const defaultColDef: ColDef = {
      resizable: true,
    };

    // Client-side filtering based on search criteria
    const filteredSermons = useMemo(() => {
      if (!sermons.length) return [];

      let filtered = sermons;

      // Filter by name (substring match on title)
      if (searchName && searchName.trim()) {
        const searchTerm = searchName.toLowerCase().trim();
        filtered = filtered.filter(sermon =>
          sermon.title && sermon.title.toLowerCase().includes(searchTerm)
        );
      }

      // Filter by ministry
      if (searchMinistry && searchMinistry !== 'all') {
        filtered = filtered.filter(sermon =>
          Array.isArray(sermon.ministry) && sermon.ministry.includes(searchMinistry)
        );
      }

      return filtered;
    }, [sermons, searchName, searchMinistry]);

    const loadData = useCallback(async () => {
      setLoading(true);
      try {
        const [publishedSermons, draftSermons, ministriesData] = await Promise.all([
          fetchSermons({ published: true }),
          fetchSermons({ published: false }),
          fetchMinistries()
        ]);

        const merged = new Map<string, ChurchSermon>();
        [...publishedSermons, ...draftSermons].forEach((entry) => {
          merged.set(entry.id, entry);
        });

        const sorted = Array.from(merged.values()).sort((a, b) => {
          const aTime = a.date_posted ? new Date(a.date_posted).getTime() : 0;
          const bTime = b.date_posted ? new Date(b.date_posted).getTime() : 0;
          return bTime - aTime;
        });

        setSermons(sorted);
        setAvailableMinistries(ministriesData);
      } catch (err) {
        console.error('Failed to load sermons management data:', err);
        setSermons([]);
      } finally {
        setLoading(false);
      }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    const handleDelete = async (ids: string[]) => {
      try {
        await Promise.all(ids.map((id) => api.delete(`/v1/sermons/${id}`)));
        setSermons((prev) => prev.filter((s) => !ids.includes(s.id)));
        setSelectedRows((prev) => prev.filter((row) => !ids.includes(row.id)));
        await loadData();
      } catch (e) {
        console.error('Delete failed', e);
      } finally {
        setConfirmDeleteIds(null);
      }
    };

    const handleEdit = (sermon: ChurchSermon) => {
      setEditTarget(sermon);
    };

    const handleMinistryAssignment = async (sermonIds: string[], newMinistries: string[]) => {
      try {
        await Promise.all(
          sermonIds.map((id) => 
            api.patch(`/v1/sermons/${id}`, { ministry: newMinistries })
          )
        );
        await loadData();
      } catch (e) {
        console.error('Ministry assignment failed', e);
      } finally {
        setAssignmentTarget(null);
      }
    };

    const openMinistryAssignment = (sermonIds: string[], currentMinistries: string[]) => {
      setAssignmentTarget({ sermonIds, selected: currentMinistries });
    };

    const handleBulkDelete = () => {
      if (selectedRows.length) {
        setConfirmDeleteIds(selectedRows.map(r => r.id));
      }
    };

    const onSelectionChanged = useCallback(() => {
      const selected = gridRef.current?.api?.getSelectedRows() || [];
      setSelectedRows(selected);
    }, []);

    const contextValue = {
      handleEdit,
      setConfirmDeleteIds,
      openMinistryAssignment,
      availableMinistries,
    };

    if (loading) {
      return (
        <div className="p-6">
          <h1 className="text-xl font-bold mb-4">Sermons Management</h1>
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        </div>
      );
    }

    return (
      <div className="p-6">
        <h1 className="text-xl font-bold mb-4">Sermons Management</h1>
        
        <div className="flex flex-wrap items-center gap-4 mb-4">
          <Input
            placeholder="Search by title..."
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="max-w-xs"
          />
          <Select value={searchMinistry} onValueChange={setSearchMinistry}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by ministry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Ministries</SelectItem>
              {availableMinistries.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex gap-2">
            {selectedRows.length > 0 && (
              <Button variant="destructive" onClick={handleBulkDelete}>
                Delete Selected ({selectedRows.length})
              </Button>
            )}
            <Button onClick={loadData}>Refresh</Button>
            <CreateSermonDialog onSave={loadData} />
          </div>
        </div>

        <div className="ag-theme-quartz" style={{ height: '600px', width: '100%' }}>
          <AgGridReact
            ref={gridRef}
            rowData={filteredSermons}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            gridOptions={gridOptions}
            rowSelection="multiple"
            suppressRowClickSelection={true}
            onSelectionChanged={onSelectionChanged}
            context={contextValue}
            pagination={true}
            paginationPageSize={20}
            paginationPageSizeSelector={[10, 20, 50, 100]}
          />
        </div>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={!!confirmDeleteIds} onOpenChange={(open) => !open && setConfirmDeleteIds(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete {confirmDeleteIds?.length || 0} sermon(s)? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmDeleteIds && handleDelete(confirmDeleteIds)}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Edit Sermon Dialog */}
        {editTarget && (
          <EditSermonDialog
            sermon={editTarget}
            onSave={async () => {
              setEditTarget(null);
              await loadData();
            }}
            open={!!editTarget}
            onOpenChange={(open) => !open && setEditTarget(null)}
          />
        )}

        {/* Ministry Assignment Dialog */}
        {assignmentTarget && (
          <Dialog open={!!assignmentTarget} onOpenChange={(open) => !open && setAssignmentTarget(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Ministries</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <label className="text-sm font-medium mb-2 block">Select Ministries:</label>
                <Select
                  value={assignmentTarget.selected[0] || ''}
                  onValueChange={(value) => {
                    const current = assignmentTarget.selected;
                    const newSelected = current.includes(value)
                      ? current.filter(m => m !== value)
                      : [...current, value];
                    setAssignmentTarget({ ...assignmentTarget, selected: newSelected });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select ministries" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableMinistries.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="mt-4 flex flex-wrap gap-2">
                  {assignmentTarget.selected.map((mId) => {
                    const ministry = availableMinistries.find(m => m.id === mId);
                    return (
                      <span key={mId} className="inline-flex items-center rounded border px-2 py-1 text-sm bg-muted/40">
                        {ministry?.name || mId}
                        <button
                          className="ml-2 text-red-500"
                          onClick={() => {
                            setAssignmentTarget({
                              ...assignmentTarget,
                              selected: assignmentTarget.selected.filter(m => m !== mId)
                            });
                          }}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAssignmentTarget(null)}>Cancel</Button>
                <Button onClick={() => handleMinistryAssignment(assignmentTarget.sermonIds, assignmentTarget.selected)}>
                  Save
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>
    );
}

export default Sermons;
