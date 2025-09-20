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

  const authCtx = useAuth();

  // Fetch user folders from server once auth is ready
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

  // If ?load=<id> is present, fetch that form and load into builder
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
          // form.data should already be the builder schema without meta
          setSchema(form.data);
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
      // Save using canonical payload: top-level title/description/folder and data array
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
    // Export in canonical schema: title/description/folder at top-level, data array under `data`
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
        if (parsed) {
          // Accept legacy shape (fields) or new shape (data).
          if (parsed.fields && Array.isArray(parsed.fields)) {
            setSchema({
              title: parsed.title || parsed.meta?.title || '',
              description: parsed.description || parsed.meta?.description || '',
              folder: parsed.meta?.folder || parsed.folder || null,
              data: parsed.fields,
            });
            if (parsed.title || parsed.meta?.title) setFormName(parsed.title || parsed.meta?.title);
            if (parsed.description || parsed.meta?.description) setDescription(parsed.description || parsed.meta?.description);
          } else if (parsed.data && Array.isArray(parsed.data)) {
            setSchema({
              title: parsed.title || '',
              description: parsed.description || '',
              folder: parsed.folder || null,
              data: parsed.data,
            });
            if (parsed.title) setFormName(parsed.title);
            if (parsed.description) setDescription(parsed.description);
          }
        }
      } catch {}
    };
    reader.readAsText(file);
    e.currentTarget.value = "";
  };
  return (
    <ErrorBoundary>
      <div className="p-2">
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Input placeholder="Name" value={formName} onChange={(e) => setFormName(e.target.value)} className="w-48" />
                <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} className="w-80" />
              </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
                  <Select onValueChange={(v) => setFolder(String(v))}>
                    <SelectTrigger size="sm">
                      <SelectValue placeholder="Choose folder" />
                    </SelectTrigger>
                    <SelectContent>
                      {folders.map((f) => (
                        <SelectItem key={f._id} value={f._id}>{f.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="New folder" value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} className="w-36" />
                  <Button size="sm" variant="ghost" onClick={async () => {
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
              <Button onClick={handleSave} className="ml-2">Save</Button>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} onChange={onFileChange} type="file" accept="application/json" className="hidden" />
            <Button variant="secondary" onClick={onImportClick}>Import JSON</Button>
            <Button onClick={onExport}>Export JSON</Button>
          </div>
          <div className="ml-4 text-sm text-muted-foreground">{statusMessage}</div>
        </div>
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
      </div>
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
