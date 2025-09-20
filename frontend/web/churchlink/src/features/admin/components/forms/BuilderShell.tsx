import { Palette } from "./Palette";
import { Canvas } from "./Canvas";
import { PreviewRendererClient } from "./PreviewRendererClient";
import { ErrorBoundary } from "./ErrorBoundary";
import { useEffect, useRef, useState } from "react";
import { useBuilderStore } from "./store";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Input } from '@/shared/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

export function BuilderShell() {
  const schema = useBuilderStore((s) => s.schema);
  const setSchema = useBuilderStore((s) => s.setSchema);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("form-builder:schema");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.fields) setSchema(parsed);
      }
    } catch {}
  }, []);

  // Autosave to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("form-builder:schema", JSON.stringify(schema));
    } catch {}
  }, [schema]);

  const [formName, setFormName] = useState(schema?.meta?.title ?? "");
  const [destination, setDestination] = useState("local");

  const handleSave = () => {
    console.log('Save form', { name: formName, destination, schema });

    // Persist name into schema meta so it stays with exported JSON
    setSchema({ ...(schema || { fields: [] }), meta: { ...(schema?.meta || {}), title: formName } });
  };

  const onExport = () => {
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${schema?.meta?.title || "form"}.json`;
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
        if (parsed && parsed.fields) setSchema(parsed);
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
              <label className="text-sm">Name</label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} className="w-48" />
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm">Save To</label>
              <Select onValueChange={(v) => setDestination(String(v))}>
                <SelectTrigger size="sm">
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODO">TODO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSave} className="ml-2">Save</Button>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} onChange={onFileChange} type="file" accept="application/json" className="hidden" />
            <Button variant="secondary" onClick={onImportClick}>Import JSON</Button>
            <Button onClick={onExport}>Export JSON</Button>
          </div>
        </div>
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
