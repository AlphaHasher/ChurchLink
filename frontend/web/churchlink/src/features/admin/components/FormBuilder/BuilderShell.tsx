import { Palette } from "./Palette";
import { CanvasPlain } from "./CanvasPlain";
import { Inspector } from "./Inspector";
import { PreviewRendererClient } from "./PreviewRendererClient";
import { ErrorBoundary } from "./ErrorBoundary";

export function BuilderShell() {
  return (
    <ErrorBoundary>
      <div className="p-2">
        <h1 className="text-xl font-semibold mb-3">Form Builder</h1>
      </div>
      <div className="grid grid-cols-12 gap-4 p-4">
        <div className="col-span-12 md:col-span-3">
          <ErrorBoundary>
            <Palette />
          </ErrorBoundary>
        </div>
        <div className="col-span-12 md:col-span-5">
          <ErrorBoundary>
            <CanvasPlain />
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
