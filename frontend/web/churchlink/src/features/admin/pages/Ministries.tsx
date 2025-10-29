import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import {
    ClientSideRowModelModule,
    ModuleRegistry,
    ColDef,
    ICellRendererParams,
} from 'ag-grid-community';
import 'ag-grid-community/styles/ag-theme-quartz.css';

import api from '@/api/api';
import { Button } from '@/shared/components/ui/button';
import { Input } from '@/shared/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/components/ui/Dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/shared/components/ui/alert-dialog';
import { Alert, AlertDescription, AlertTitle } from '@/shared/components/ui/alert';
import { Pencil, Trash } from 'lucide-react';

ModuleRegistry.registerModules([ClientSideRowModelModule]);

type Ministry = {
    id: string;
    name: string;
    created_at: string;
    updated_at: string;
};

type GridContext = {
    openRename: (ministry: Ministry) => void;
    openDelete: (ministry: Ministry) => void;
};

const ActionsCellRenderer = (props: ICellRendererParams) => {
    const { data, context } = props;
    if (!data) return null;
    const ministry = data as Ministry;
    const { openRename, openDelete } = context as GridContext;

    return (
        <div className="flex items-center h-full gap-2">
            <Button size="sm" variant="outline" onClick={() => openRename(ministry)}>
                <Pencil className="mr-2 h-4 w-4" /> Rename
            </Button>
            <Button size="sm" variant="destructive" onClick={() => openDelete(ministry)}>
                <Trash className="mr-2 h-4 w-4" /> Delete
            </Button>
        </div>
    );
};

const formatDate = (iso?: string) => {
    if (!iso) return '—';
    try {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString();
    } catch (error) {
        return '—';
    }
};

const Ministries = () => {
    const gridRef = useRef<AgGridReact<Ministry>>(null);
    const [ministries, setMinistries] = useState<Ministry[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchValue, setSearchValue] = useState('');
    const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

    const [createOpen, setCreateOpen] = useState(false);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);

    const [renameTarget, setRenameTarget] = useState<Ministry | null>(null);
    const [renameValue, setRenameValue] = useState('');
    const [renaming, setRenaming] = useState(false);

    const [deleteTarget, setDeleteTarget] = useState<Ministry | null>(null);
    const [deleting, setDeleting] = useState(false);

    const showStatus = useCallback((next: { type: 'success' | 'error' | 'info'; message: string } | null) => {
        setStatus(next);
        if (next) {
            window.setTimeout(() => setStatus(null), 5000);
        }
    }, []);

    const fetchMinistries = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/v1/ministries');
            setMinistries(response.data || []);
        } catch (error) {
            console.error('Failed to load ministries', error);
            showStatus({ type: 'error', message: 'Failed to load ministries. Please try again.' });
        } finally {
            setLoading(false);
        }
    }, [showStatus]);

    useEffect(() => {
        void fetchMinistries();
    }, [fetchMinistries]);

    const columnDefs = useMemo<ColDef<Ministry>[]>(
        () => [
            {
                field: 'name',
                headerName: 'Ministry',
                flex: 1,
                minWidth: 200,
                sortable: true,
                filter: true,
            },
            {
                headerName: 'Created',
                valueGetter: (params) => formatDate(params.data?.created_at),
                minWidth: 160,
                sortable: true,
            },
            {
                headerName: 'Updated',
                valueGetter: (params) => formatDate(params.data?.updated_at),
                minWidth: 160,
                sortable: true,
            },
            {
                headerName: 'Actions',
                cellRenderer: ActionsCellRenderer,
                minWidth: 300,
                pinned: 'right',
            },
        ],
        [],
    );

    const defaultColDef = useMemo<ColDef>(() => ({
        resizable: true,
        sortable: true,
        filter: true,
    }), []);

    const onSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const value = event.target.value;
        setSearchValue(value);
        gridRef.current?.api.setGridOption('quickFilterText', value);
    }, []);

    const handleCreate = useCallback(async () => {
        if (!newName.trim()) {
            showStatus({ type: 'error', message: 'Please provide a ministry name.' });
            return;
        }
        setCreating(true);
        try {
            await api.post('/v1/ministries', { name: newName.trim() });
            showStatus({ type: 'success', message: `Created ministry "${newName.trim()}".` });
            setCreateOpen(false);
            setNewName('');
            await fetchMinistries();
        } catch (error: any) {
            console.error('Failed to create ministry', error);
            const detail = error?.response?.data?.detail || 'Unable to create ministry.';
            showStatus({ type: 'error', message: detail });
        } finally {
            setCreating(false);
        }
    }, [newName, fetchMinistries, showStatus]);

    const handleRename = useCallback(async () => {
        if (!renameTarget) return;
        if (!renameValue.trim()) {
            showStatus({ type: 'error', message: 'Please provide a ministry name.' });
            return;
        }
        setRenaming(true);
        try {
            await api.patch(`/v1/ministries/${renameTarget.id}`, { name: renameValue.trim() });
            showStatus({ type: 'success', message: `Renamed ministry to "${renameValue.trim()}".` });
            setRenameTarget(null);
            setRenameValue('');
            await fetchMinistries();
        } catch (error: any) {
            console.error('Failed to rename ministry', error);
            const detail = error?.response?.data?.detail || 'Unable to rename ministry.';
            showStatus({ type: 'error', message: detail });
        } finally {
            setRenaming(false);
        }
    }, [renameTarget, renameValue, fetchMinistries, showStatus]);

    const handleDelete = useCallback(async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/v1/ministries/${deleteTarget.id}`);
            showStatus({ type: 'success', message: `Deleted ministry "${deleteTarget.name}".` });
            setDeleteTarget(null);
            await fetchMinistries();
        } catch (error: any) {
            console.error('Failed to delete ministry', error);
            const detail = error?.response?.data?.detail || 'Unable to delete ministry.';
            showStatus({ type: 'error', message: detail });
        } finally {
            setDeleting(false);
        }
    }, [deleteTarget, fetchMinistries, showStatus]);

    const context = useMemo<GridContext>(
        () => ({
            openRename: (ministry) => {
                setRenameTarget(ministry);
                setRenameValue(ministry.name);
            },
            openDelete: setDeleteTarget,
        }),
        [],
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-semibold">Ministries</h1>
                    <p className="text-muted-foreground">Manage the official list of ministries used throughout the platform.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Input
                        placeholder="Search ministries..."
                        value={searchValue}
                        onChange={onSearchChange}
                        className="w-full sm:w-64"
                    />
                    <Button onClick={() => setCreateOpen(true)}>Add ministry</Button>
                </div>
            </div>

            {status && (
                <Alert variant={status.type === 'error' ? 'destructive' : status.type === 'success' ? 'success' : 'info'}>
                    <AlertTitle>{status.type === 'error' ? 'Error' : status.type === 'success' ? 'Success' : 'Notice'}</AlertTitle>
                    <AlertDescription>{status.message}</AlertDescription>
                </Alert>
            )}

            <div className="ag-theme-quartz w-full border border-border rounded-lg" style={{ height: 500 }}>
                <AgGridReact<Ministry>
                    ref={gridRef}
                    rowData={ministries}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    quickFilterText={searchValue}
                    animateRows
                    loading={loading}
                    overlayNoRowsTemplate={loading ? '<span>Loading ministries...</span>' : '<span>No ministries found.</span>'}
                    context={context}
                />
            </div>

            <Dialog open={createOpen} onOpenChange={(open) => { setCreateOpen(open); if (!open) setNewName(''); }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create ministry</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Input
                            autoFocus
                            placeholder="Ministry name"
                            value={newName}
                            onChange={(event) => setNewName(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void handleCreate();
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                            Cancel
                        </Button>
                        <Button onClick={() => void handleCreate()} disabled={creating}>
                            {creating ? 'Creating...' : 'Create'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!renameTarget} onOpenChange={(open) => {
                if (!open) {
                    setRenameTarget(null);
                    setRenameValue('');
                }
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Rename ministry</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <Input
                            autoFocus
                            placeholder="Ministry name"
                            value={renameValue}
                            onChange={(event) => setRenameValue(event.target.value)}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                    event.preventDefault();
                                    void handleRename();
                                }
                            }}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRenameTarget(null)} disabled={renaming}>
                            Cancel
                        </Button>
                        <Button onClick={() => void handleRename()} disabled={renaming}>
                            {renaming ? 'Saving...' : 'Save changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <AlertDialog open={!!deleteTarget} onOpenChange={(open) => {
                if (!open) setDeleteTarget(null);
            }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete ministry</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{deleteTarget?.name}"? This will remove the ministry from the master list.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => void handleDelete()}
                            disabled={deleting}
                        >
                            {deleting ? 'Deleting...' : 'Delete'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
};

export default Ministries;
