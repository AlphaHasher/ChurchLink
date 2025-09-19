import { Palette } from "./Palette";
import { Canvas } from "./Canvas";
import { Inspector } from "./Inspector";
import { PreviewRendererClient } from "./PreviewRendererClient";
import { ErrorBoundary } from "./ErrorBoundary";
import { useEffect, useRef } from "react";
import { useBuilderStore } from "./store";
import { Button } from "@/shared/components/ui/button";

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Autosave to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("form-builder:schema", JSON.stringify(schema));
    } catch {}
  }, [schema]);

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
          <h1 className="text-xl font-semibold">Form Builder</h1>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} onChange={onFileChange} type="file" accept="application/json" className="hidden" />
            <Button variant="secondary" onClick={onImportClick}>Import JSON</Button>
            <Button onClick={onExport}>Export JSON</Button>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-4 p-4">
        <div className="col-span-12 md:col-span-3">
          <ErrorBoundary>
            <Palette />
          </ErrorBoundary>
        </div>
        <div className="col-span-12 md:col-span-5">
          <ErrorBoundary>
            <Canvas />
          </ErrorBoundary>
        </div>
        <div className="col-span-12 md:col-span-4 space-y-4">
          <ErrorBoundary>
            <Inspector />
          </ErrorBoundary>
          <div className="rounded border p-4">
            <h3 className="font-medium mb-2">Live Preview</h3>
            <ErrorBoundary>
              <PreviewRendererClient />
            </ErrorBoundary>
          </div>
        </div>
      </div>
    </ErrorBoundary>
  );
}
