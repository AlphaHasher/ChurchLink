import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FormsTabs from '@/features/admin/components/Forms/FormsTabs';
import api from '@/api/api';
import { Input } from '@/shared/components/ui/input';
import { Button } from '@/shared/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/shared/components/ui/pagination';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/shared/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { Checkbox } from '@/shared/components/ui/checkbox';
import { Switch } from '@/shared/components/ui/switch';
import { MoreHorizontal, Pencil, FileEdit, Copy, Download, Trash, MoveRight, Settings2, RefreshCcw } from 'lucide-react';

const ManageForms = () => {
  const navigate = useNavigate();
  const [forms, setForms] = useState<any[]>([]);
  const [folders, setFolders] = useState<{ _id: string; name: string }[]>([]);
  const [searchName, setSearchName] = useState('');
  const [searchFolder, setSearchFolder] = useState<string>('all');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDeleteIds, setConfirmDeleteIds] = useState<string[] | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [moveTargetIds, setMoveTargetIds] = useState<string[] | null>(null);
  const [moveToFolderId, setMoveToFolderId] = useState<string>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [slugDialog, setSlugDialog] = useState<{ id: string; slug: string } | null>(null);
  const [slugError, setSlugError] = useState<string | null>(null);

  const fetchForms = async () => {
    try {
      setLoading(true);
      const resp = await api.get('/v1/forms/');
      setForms(resp.data || []);
    } catch (e) {
      console.error('Failed to fetch forms', e);
    } finally {
      setLoading(false);
    }
  };

  const search = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (searchName) params.name = searchName;
  if (searchFolder && searchFolder !== 'all') params.folder = searchFolder;
      const resp = await api.get('/v1/forms/search', { params });
      setForms(resp.data || []);
    } catch (e) {
      console.error('Search failed', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchFolders = async () => {
    try {
      const resp = await api.get('/v1/forms/folders');
      setFolders(resp.data || []);
    } catch (e) {
      console.error('Failed to fetch folders', e);
    }
  };

  useEffect(() => { fetchForms(); fetchFolders(); }, []);

  const pagedForms = useMemo(() => {
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    return forms.slice(start, end);
  }, [forms, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil((forms.length || 0) / pageSize));

  const folderName = (id?: string) => folders.find((f) => f._id === id)?.name || '';

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelected(new Set(forms.map((f) => f.id)));
    else setSelected(new Set());
  };

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleDelete = async (ids: string[]) => {
    setStatus('Deleting...');
    try {
      await Promise.all(ids.map((id) => api.delete(`/v1/forms/${id}`)));
      setForms((prev) => prev.filter((f) => !ids.includes(f.id)));
      setSelected((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });
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
      setForms((prev) => prev.map((f) => (f.id === id ? { ...f, visible } : f)));
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
      setForms((prev) => prev.map((f) => (f.id === id ? { ...f, slug: cleaned } : f)));
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
      setForms((prev) => prev.map((f) => (f.id === id ? { ...f, slug: undefined } : f)));
    } catch (err) {
      setStatus('Failed to remove slug');
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;
    try {
      await api.put(`/v1/forms/${renameTarget.id}`, { title: renameTarget.title });
      setForms((prev) => prev.map((f) => (f.id === renameTarget.id ? { ...f, title: renameTarget.title } : f)));
      setRenameTarget(null);
    } catch (e) {
      console.error('Rename failed', e);
      setStatus('Rename failed');
    }
  };

  const handleMove = async () => {
    if (!moveTargetIds || !moveToFolderId) return;
    try {
      await Promise.all(moveTargetIds.map((id) => api.put(`/v1/forms/${id}`, { folder: moveToFolderId })));
      setForms((prev) => prev.map((f) => (moveTargetIds.includes(f.id) ? { ...f, folder: moveToFolderId } : f)));
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
          <Button onClick={() => navigate('/admin/forms/form-builder')}>
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
          <Button onClick={search} disabled={loading}><Settings2 className="h-4 w-4 mr-2" />Search</Button>
          <Button variant="ghost" onClick={() => { setSearchName(''); setSearchFolder('all'); fetchForms(); }}>Clear</Button>
          {status && <div className="text-sm text-muted-foreground ml-2">{status}</div>}
          <div className="ml-auto">
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-24">
                <SelectValue placeholder="Rows" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>    
        </div>
        {/* Bulk actions */}
        {selected.size > 0 && (
          <div className="flex items-center justify-between p-2 border rounded mb-3 bg-muted/30">
            <div className="text-sm">{selected.size} selected</div>
            <div className="flex items-center gap-2">
              <Button variant="destructive" size="sm" onClick={() => setConfirmDeleteIds(Array.from(selected))}><Trash className="h-4 w-4 mr-1" /> Delete</Button>
              <Button size="sm" variant="outline" onClick={() => setMoveTargetIds(Array.from(selected))}><MoveRight className="h-4 w-4 mr-1" /> Move to...</Button>
              <Button size="sm" variant="outline" onClick={async () => { for (const id of selected) await handleExport(id); }}><Download className="h-4 w-4 mr-1" /> Export</Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
                <tr className="text-left text-muted-foreground">
                <th className="w-8 p-2"><Checkbox checked={selected.size === forms.length && forms.length > 0} onCheckedChange={(c) => toggleSelectAll(!!c)} aria-label="Select all" /></th>
                <th className="p-2">Title</th>
                <th className="p-2">Folder</th>
                <th className="p-2">Links</th>
                <th className="p-2">Visible</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="p-4">Loading...</td></tr>
              )}
              {!loading && forms.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-muted-foreground">No forms found</td></tr>
              )}
              {!loading && pagedForms.map((f) => (
                <tr key={f.id} className="border-t">
                  <td className="p-2"><Checkbox checked={selected.has(f.id)} onCheckedChange={(c) => toggleSelect(f.id, !!c)} aria-label={`Select ${f.title}`} /></td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{f.title}</span>
                      {f.description ? <span className="text-xs text-muted-foreground">{f.description}</span> : null}
                    </div>
                  </td>
                  <td className="p-2">
                    {folderName(f.folder) ? (
                      <span className="inline-flex items-center rounded border px-2 py-0.5 text-xs bg-muted/40">
                        {folderName(f.folder)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2">
                    {f.slug ? (
                      <div className={`inline-flex items-center gap-2 ${!f.visible ? 'text-muted-foreground' : ''}`}>
                        <a href={`/forms/${f.slug}`} target="_blank" rel="noreferrer" className={`${!f.visible ? 'pointer-events-none' : ''}`}>{`/forms/${f.slug}`}</a>
                          <div className={`inline-flex items-center ${!f.visible ? 'text-muted-foreground' : ''}`}>
                            <Button size="icon" variant="ghost" onClick={() => openCreateSlug(f.id, f.slug)} title="Edit slug"><Pencil className="h-4 w-4" /></Button>
                            <Button size="icon" variant="ghost" onClick={() => handleRemoveSlug(f.id)} title="Remove slug"><Trash className="h-4 w-4" /></Button>
                          </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => openCreateSlug(f.id)} className="text-muted-foreground">Create Link</Button>
                    )}
                  </td>
                  <td className="p-2">
                    <Switch checked={!!f.visible} onCheckedChange={(c) => handleToggleVisible(f.id, !!c)} aria-label="Toggle visibility" />
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => navigate(`/admin/forms/form-builder?load=${f.id}`)}><FileEdit className="h-4 w-4 mr-1" /> Edit</Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleDuplicate(f.id)}><Copy className="h-4 w-4 mr-2" /> Duplicate</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleExport(f.id)}><Download className="h-4 w-4 mr-2" /> Export JSON</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setRenameTarget({ id: f.id, title: f.title })}><Pencil className="h-4 w-4 mr-2" /> Rename</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setMoveTargetIds([f.id]); setMoveToFolderId(''); }}><MoveRight className="h-4 w-4 mr-2" /> Move to...</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600" onClick={() => setConfirmDeleteIds([f.id])}><Trash className="h-4 w-4 mr-2" /> Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-3">
          <div className="flex items-center justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={(e: any) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
                    href="#"
                    className={page <= 1 ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
                {(() => {
                  const items: React.ReactNode[] = [];
                  const maxToShow = 5;
                  let start = Math.max(1, page - 2);
                  let end = Math.min(totalPages, start + maxToShow - 1);
                  if (end - start < maxToShow - 1) {
                    start = Math.max(1, end - (maxToShow - 1));
                  }
                  if (start > 1) {
                    items.push(
                      <PaginationItem key={1}>
                        <PaginationLink href="#" isActive={page === 1} onClick={(e: any) => { e.preventDefault(); setPage(1); }}>1</PaginationLink>
                      </PaginationItem>
                    );
                    if (start > 2) items.push(<PaginationItem key="s-ellipsis"><span className="px-2">…</span></PaginationItem>);
                  }
                  for (let p = start; p <= end; p++) {
                    items.push(
                      <PaginationItem key={p}>
                        <PaginationLink href="#" isActive={p === page} onClick={(e: any) => { e.preventDefault(); setPage(p); }}>{p}</PaginationLink>
                      </PaginationItem>
                    );
                  }
                  if (end < totalPages) {
                    if (end < totalPages - 1) items.push(<PaginationItem key="e-ellipsis"><span className="px-2">…</span></PaginationItem>);
                    items.push(
                      <PaginationItem key={totalPages}>
                        <PaginationLink href="#" isActive={page === totalPages} onClick={(e: any) => { e.preventDefault(); setPage(totalPages); }}>{totalPages}</PaginationLink>
                      </PaginationItem>
                    );
                  }
                  return items;
                })()}
                <PaginationItem>
                  <PaginationNext
                    onClick={(e: any) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }}
                    href="#"
                    className={page >= totalPages ? 'pointer-events-none opacity-50' : ''}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>

          {/* rows-per-page moved to top filters */}
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
