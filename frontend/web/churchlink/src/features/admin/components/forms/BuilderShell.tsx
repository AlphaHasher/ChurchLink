import { Palette } from "./Palette";
import { Canvas } from "./Canvas";
import { PreviewRendererClient } from "./PreviewRendererClient";
import { ErrorBoundary } from "./ErrorBoundary";
import { useEffect, useRef, useState } from "react";
import { useAuth } from '@/features/auth/hooks/auth-context';
import { useBuilderStore } from "./store";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/Dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/shared/components/ui/dropdown-menu';
import { Save as SaveIcon, MoreHorizontal, Upload, Download, Trash } from 'lucide-react';
import { Alert } from '@/shared/components/ui/alert';
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
import api from '@/api/api';

export function BuilderShell() {
  const schema = useBuilderStore((s) => s.schema);
  const setSchema = useBuilderStore((s) => s.setSchema);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [formName, setFormName] = useState((schema as any)?.title ?? "");
  const [description, setDescription] = useState((schema as any)?.description ?? "");
  const [folder, setFolder] = useState<string | null>((schema as any)?.folder ?? null);
  const [folders, setFolders] = useState<{ _id: string; name: string }[]>([]);
  const [newFolderName, setNewFolderName] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error' | 'info' | 'warning' | null; title?: string; message?: string } | null>(null);
  const [showNameConflictDialog, setShowNameConflictDialog] = useState(false);
  const [overrideTargetId, setOverrideTargetId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const lastSavedSnapshotRef = useRef<string>(JSON.stringify({ title: '', description: '', folder: null, data: [] }));

  useEffect(() => {
    if (status?.type === 'success') {
      const t = setTimeout(() => setStatus(null), 5000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const authCtx = useAuth();

  useEffect(() => {
    if (!authCtx.user) return;
    let mounted = true;
    const load = async () => {
      try {
        const resp = await api.get('/v1/forms/folders');
        if (!mounted) return;
        setFolders(resp.data || []);
      } catch (err) {
        console.error('Failed to load folders', err);
        setStatus({ type: 'error', title: 'Load failed', message: 'Could not load folders' });
      }
    };
    load();
    return () => { mounted = false; };
  }, [authCtx.user]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loadId = params.get('load');
    if (!loadId) return;
    let mounted = true;
    (async () => {
      try {
        setStatus({ type: 'info', title: 'Loading', message: 'Loading form...' });
        const resp = await api.get(`/v1/forms/${loadId}`);
        if (!mounted) return;
        const form = resp.data;
        if (form && form.data) {
          const dataArray = Array.isArray(form.data) ? form.data : (form.data?.data || []);
          setSchema({
            title: form.title || '',
            description: form.description || '',
            folder: form.folder || null,
            data: dataArray,
          } as any);
          setFormName(form.title || '');
          setDescription(form.description || '');
          setFolder(form.folder || null);
          setStatus(null);
          lastSavedSnapshotRef.current = JSON.stringify({ title: form.title || '', description: form.description || '', folder: form.folder || null, data: dataArray });
        }
      } catch (err) {
        console.error('Failed to load form', err);
        setStatus({ type: 'error', title: 'Failed to load form', message: 'Please try again.' });
      }
    })();
    return () => { mounted = false; };
  }, [setSchema]);

  // Handle New Form flow via ?new=1 param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const newFlag = params.get('new');
    if (!newFlag) return;
    const dataArray = (schema as any)?.data || [];
    const hasFields = Array.isArray(dataArray) && dataArray.length > 0;
    if (!hasFields) {
      // Nothing on canvas; no need to confirm
      resetToBlank();
      return;
    }
    const snapshot = JSON.stringify({ title: formName || '', description: description || '', folder: folder || null, data: dataArray });
    const isDirty = snapshot !== lastSavedSnapshotRef.current && snapshot !== JSON.stringify({ title: '', description: '', folder: null, data: [] });
    if (isDirty) setShowDiscardDialog(true);
    else resetToBlank();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetToBlank = () => {
    const blank: any = { title: '', description: '', folder: null, data: [] };
    setSchema(blank);
    setFormName('');
    setDescription('');
    setFolder(null);
    lastSavedSnapshotRef.current = JSON.stringify(blank);
  };

  // Track dirty state and expose it for manager page via localStorage
  useEffect(() => {
    const snapshot = JSON.stringify({ title: formName || '', description: description || '', folder: folder || null, data: (schema as any)?.data || [] });
    const isDirtyNow = snapshot !== lastSavedSnapshotRef.current;
    try { localStorage.setItem('formBuilderDirty', isDirtyNow ? '1' : '0'); } catch {}
  }, [schema, formName, description, folder]);

  const handleSave = async () => {
  // Persist name, folder and description into top-level schema so it stays with exported JSON
  const newSchema = { ...(schema || { data: [] }), title: formName, folder, description };
  setSchema(newSchema as any);

    if (!folder) {
      setStatus({ type: 'warning', title: 'Folder required', message: 'Select or create a folder before saving' });
      return;
    }

    try {
      setStatus({ type: 'info', title: 'Saving', message: 'Saving to server...' });
      const payload = {
        title: formName,
        description: description,
        folder,
        visible: true,
        data: (schema as any)?.data || [],
      };
      await api.post('/v1/forms/', payload);
      setStatus({ type: 'success', title: 'Saved', message: 'Saved to server' });
  lastSavedSnapshotRef.current = JSON.stringify({ title: formName, description, folder, data: (schema as any)?.data || [] });
    } catch (err: any) {
      console.error('Failed to save form to server', err);
      if (err?.response?.status === 409) {
        const payload = err.response?.data || err.response?.data?.detail || {};
        // If backend provided existing_id, prompt override
        const existingId = payload?.existing_id || payload?.existingId || (payload?.detail && payload.detail.existing_id) || null;
        setOverrideTargetId(existingId);
        setShowNameConflictDialog(true);
        setStatus(null);
      } else {
        setStatus({ type: 'error', title: 'Save failed', message: 'Failed to save to server' });
      }
    }
  };

  const confirmOverride = async () => {
    if (!overrideTargetId) return;
    try {
      setStatus({ type: 'info', title: 'Overriding', message: 'Overriding existing form...' });
      const updatePayload = {
        title: formName,
        description,
        folder,
        visible: true,
        data: (schema as any)?.data || [],
      };
  await api.put(`/v1/forms/${overrideTargetId}`, updatePayload);
  setStatus({ type: 'success', message: 'Form overridden' });
  lastSavedSnapshotRef.current = JSON.stringify({ title: formName, description, folder, data: (schema as any)?.data || [] });
      // Refresh folders list just in case
      const foldersResp = await api.get('/v1/forms/folders');
      setFolders(foldersResp.data || []);
    } catch (err) {
      console.error('Failed to override form', err);
      setStatus({ type: 'error', title: 'Override failed', message: 'Could not override form' });
    } finally {
      setShowNameConflictDialog(false);
      setOverrideTargetId(null);
    }
  };

  const onExport = () => {
    const exportObj: any = {
      title: formName || (schema as any)?.title || 'Untitled Form',
      description: description || (schema as any)?.description || '',
      folder: (schema as any)?.folder || null,
      data: (schema as any)?.data || [],
    };
    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${formName || (schema as any)?.title || 'form'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const onImportClick = () => fileInputRef.current?.click();
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        // Only support the canonical shape: top-level `data` array
        if (parsed && Array.isArray(parsed.data)) {
          setSchema({
            title: parsed.title || '',
            description: parsed.description || '',
            folder: parsed.folder || null,
            data: parsed.data,
          });
          if (parsed.title) setFormName(parsed.title);
          if (parsed.description) setDescription(parsed.description);
          setStatus({ type: 'success', title: 'Imported', message: 'Form imported' });
        } else {
          setStatus({ type: 'error', title: 'Invalid JSON', message: 'Expected top-level "data" array' });
        }
      } catch (err) {
        console.error('Failed to parse imported file', err);
        setStatus({ type: 'error', title: 'Parse failed', message: 'Failed to parse JSON file' });
      }
    };
    reader.readAsText(file);
    e.currentTarget.value = "";
  };
  return (
    <ErrorBoundary>
      <div className="p-2">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-xl font-semibold">{formName || 'Untitled Form'}</div>
          </div>
          <div className="flex items-center gap-2">
            {/* Status Alert to the left of Save button */}
              {status?.type && !saveDialogOpen && !showNameConflictDialog && !showDiscardDialog && !showClearConfirm && (
              <div className="hidden md:block max-w-xs">
                <Alert
                  variant={status.type === 'error' ? 'destructive' : status.type === 'success' ? 'success' : status.type === 'info' ? 'info' : 'warning'}
                  className="h-10 inline-flex items-center px-3 py-1"
                >
                  <span className="text-sm truncate">{status.message ?? status.title}</span>
                </Alert>
              </div>
            )}
              <Button variant="outline" onClick={() => setShowClearConfirm(true)} title="Clear form (start fresh)">
                <Trash className="h-4 w-4 mr-2" /> Clear
              </Button>
            <Button onClick={() => setSaveDialogOpen(true)}>
              <SaveIcon className="h-4 w-4 mr-2" /> Save
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Form</DropdownMenuLabel>
                <DropdownMenuItem onClick={onImportClick}><Upload className="h-4 w-4 mr-2" /> Import JSON</DropdownMenuItem>
                <DropdownMenuItem onClick={onExport}><Download className="h-4 w-4 mr-2" /> Export JSON</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSaveDialogOpen(true)}><SaveIcon className="h-4 w-4 mr-2" /> Save As...</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        {/* Fallback status below header for smaller screens (hidden when dialog open) */}
        {status?.type && !saveDialogOpen && !showNameConflictDialog && !showDiscardDialog && !showClearConfirm && (
          <div className="md:hidden mb-2">
            <Alert
              variant={status.type === 'error' ? 'destructive' : status.type === 'success' ? 'success' : status.type === 'info' ? 'info' : 'warning'}
              className="h-10 inline-flex items-center px-3 py-1"
            >
              <span className="text-sm truncate">{status.message ?? status.title}</span>
            </Alert>
          </div>
        )}
        <input ref={fileInputRef} onChange={onFileChange} type="file" accept="application/json" className="hidden" />
        </div>
        {/* Save Dialog */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save form</DialogTitle>
            </DialogHeader>
            {status?.type && (
              <Alert
                variant={status.type === 'error' ? 'destructive' : status.type === 'success' ? 'success' : status.type === 'info' ? 'info' : 'warning'}
                className="h-10 inline-flex items-center px-3 py-1"
              >
                <span className="text-sm truncate">{status.message ?? status.title}</span>
              </Alert>
            )}
            <div className="space-y-3">
              <Input placeholder="Name" value={formName} onChange={(e) => setFormName(e.target.value)} />
              <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <div className="space-y-2">
                <div className="text-sm font-medium">Folder</div>
                {folders && folders.length > 0 ? (
                  <Select value={folder || undefined} onValueChange={(v) => setFolder(String(v))}>
                    <SelectTrigger>
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
                <div className="flex items-center gap-2">
                  <Input placeholder="New folder" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} />
                  <Button variant="ghost" onClick={async () => {
                    if (!newFolderName) return;
                    try {
                      setStatus({ type: 'info', title: 'Creating folder', message: 'Please wait...' });
                      const resp = await api.post('/v1/forms/folders', {}, { params: { name: newFolderName } });
                      const created = resp.data;
                      setFolders((prev) => [...prev, created]);
                      setFolder(created['_id']);
                      setNewFolderName('');
                      setStatus({ type: 'success', title: 'Folder created', message: undefined });
                    } catch (err: any) {
                      console.error('Failed to create folder', err);
                      if (err?.response?.status === 409) {
                        setStatus({ type: 'warning', title: 'Folder exists', message: 'Choose it from the list' });
                      } else {
                        setStatus({ type: 'error', title: 'Create folder failed', message: 'Please try again' });
                      }
                    }
                  }}>Create</Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
              <Button onClick={async () => { if (!folder) { setStatus({ type: 'warning', title: 'Folder required', message: 'Select or create a folder before saving' }); return; } await handleSave(); setSaveDialogOpen(false); }}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Override confirmation dialog (name conflict) */}
        <AlertDialog open={showNameConflictDialog} onOpenChange={(open) => { if (!open) { setShowNameConflictDialog(false); setOverrideTargetId(null); } }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Name conflict</AlertDialogTitle>
              <AlertDialogDescription>
                You already have a form named "{formName}". Do you want to override it?
              </AlertDialogDescription>
            </AlertDialogHeader>
            {status?.type && (
              <Alert
                variant={status.type === 'error' ? 'destructive' : status.type === 'success' ? 'success' : status.type === 'info' ? 'info' : 'warning'}
                className="h-10 inline-flex items-center px-3 py-1"
              >
                <span className="text-sm truncate">{status.message ?? status.title}</span>
              </Alert>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowNameConflictDialog(false); setOverrideTargetId(null); }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmOverride} className="bg-red-600 hover:bg-red-700">Override</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Discard new form changes confirmation */}
        <AlertDialog open={showDiscardDialog} onOpenChange={(open) => { if (!open) setShowDiscardDialog(false); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard current changes?</AlertDialogTitle>
              <AlertDialogDescription>
                You have unsaved changes. Do you want to discard them and start a new blank form?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowDiscardDialog(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { resetToBlank(); setShowDiscardDialog(false); }} className="bg-red-600 hover:bg-red-700">Discard</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {/* Clear canvas confirmation */}
        <AlertDialog open={showClearConfirm} onOpenChange={(open) => { if (!open) setShowClearConfirm(false); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear form builder?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove all fields and reset the form metadata. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowClearConfirm(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => { resetToBlank(); setShowClearConfirm(false); }} className="bg-red-600 hover:bg-red-700">Clear</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      <div className="grid grid-cols-12 gap-4 p-4">
        <div className="col-span-12 md:col-span-2">
          <ErrorBoundary>
            <Palette />
          </ErrorBoundary>
        </div>
        <div className="col-span-12 md:col-span-6">
          <ErrorBoundary>
            <Canvas />
          </ErrorBoundary>
        </div>
        <div className="col-span-12 md:col-span-4">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Live Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <ErrorBoundary>
                <PreviewRendererClient />
              </ErrorBoundary>
            </CardContent>
          </Card>
        </div>
      </div>
    </ErrorBoundary>
  );
}
