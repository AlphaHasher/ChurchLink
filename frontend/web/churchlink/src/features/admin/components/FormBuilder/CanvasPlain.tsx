import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { useBuilderStore } from "./store";

export function CanvasPlain() {
  const fields = useBuilderStore((s) => s.schema.fields);
  const select = useBuilderStore((s) => s.select);
  const selectedId = useBuilderStore((s) => s.selectedId);
  const removeField = useBuilderStore((s) => s.removeField);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Canvas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex flex-col gap-2">
          {fields.map((f) => (
            <div
              key={f.id}
              className={`flex items-center justify-between rounded border p-3 ${selectedId === f.id ? "border-ring" : "border-border"}`}
              onClick={() => select(f.id)}
            >
              <div className="text-sm">{f.label} <span className="text-muted-foreground">({f.type})</span></div>
              <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); removeField(f.id); }}>Remove</Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
