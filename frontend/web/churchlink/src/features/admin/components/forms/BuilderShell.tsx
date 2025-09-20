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
import { Save as SaveIcon, MoreHorizontal, Upload, Download } from 'lucide-react';
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
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showNameConflictDialog, setShowNameConflictDialog] = useState(false);
  const [overrideTargetId, setOverrideTargetId] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);

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
        setStatusMessage('Loading form...');
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
          setStatusMessage(null);
        }
      } catch (err) {
        console.error('Failed to load form', err);
        setStatusMessage('Failed to load form');
      }
    })();
    return () => { mounted = false; };
  }, [setSchema]);

  const handleSave = async () => {
  // Persist name, folder and description into top-level schema so it stays with exported JSON
  const newSchema = { ...(schema || { data: [] }), title: formName, folder, description };
  setSchema(newSchema as any);

    if (!folder) {
      setStatusMessage('Select or create a folder before saving');
      return;
    }

    try {
      setStatusMessage('Saving to server...');
      const payload = {
        title: formName,
        description: description,
        folder,
        visible: true,
        data: (schema as any)?.data || [],
      };
      await api.post('/v1/forms/', payload);
      setStatusMessage('Saved to server');
    } catch (err: any) {
      console.error('Failed to save form to server', err);
      if (err?.response?.status === 409) {
        const payload = err.response?.data || err.response?.data?.detail || {};
        // If backend provided existing_id, prompt override
        const existingId = payload?.existing_id || payload?.existingId || (payload?.detail && payload.detail.existing_id) || null;
        setOverrideTargetId(existingId);
        setShowNameConflictDialog(true);
        setStatusMessage(null);
      } else {
        setStatusMessage('Failed to save to server');
      }
    }
  };

  const confirmOverride = async () => {
    if (!overrideTargetId) return;
    try {
      setStatusMessage('Overriding existing form...');
      const updatePayload = {
        title: formName,
        description,
        folder,
        visible: true,
        data: (schema as any)?.data || [],
      };
      await api.put(`/v1/forms/${overrideTargetId}`, updatePayload);
      setStatusMessage('Form overridden');
      // Refresh folders list just in case
      const foldersResp = await api.get('/v1/forms/folders');
      setFolders(foldersResp.data || []);
    } catch (err) {
      console.error('Failed to override form', err);
      setStatusMessage('Override failed');
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
          setStatusMessage('Form imported');
        } else {
          setStatusMessage('Invalid form JSON: expected top-level "data" array');
        }
      } catch (err) {
        console.error('Failed to parse imported file', err);
        setStatusMessage('Failed to parse JSON file');
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
        <div className="ml-1 text-sm text-muted-foreground h-5">{statusMessage}</div>
        <input ref={fileInputRef} onChange={onFileChange} type="file" accept="application/json" className="hidden" />
        </div>
        {/* Save Dialog */}
        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save form</DialogTitle>
            </DialogHeader>
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
                      setStatusMessage('Creating folder...');
                      const resp = await api.post('/v1/forms/folders', {}, { params: { name: newFolderName } });
                      const created = resp.data;
                      setFolders((prev) => [...prev, created]);
                      setFolder(created['_id']);
                      setNewFolderName('');
                      setStatusMessage('Folder created');
                    } catch (err: any) {
                      console.error('Failed to create folder', err);
                      if (err?.response?.status === 409) {
                        setStatusMessage('Folder already exists');
                      } else {
                        setStatusMessage('Failed to create folder');
                      }
                    }
                  }}>Create</Button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
              <Button onClick={async () => { if (!folder) { setStatusMessage('Select or create a folder before saving'); return; } await handleSave(); setSaveDialogOpen(false); }}>Save</Button>
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
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => { setShowNameConflictDialog(false); setOverrideTargetId(null); }}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={confirmOverride} className="bg-red-600 hover:bg-red-700">Override</AlertDialogAction>
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
