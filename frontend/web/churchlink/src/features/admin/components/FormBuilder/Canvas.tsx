import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { useBuilderStore } from "./store";
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { SortableItem } from "./SortableItem";

export function Canvas() {
  const fields = useBuilderStore((s) => s.schema.fields);
  const select = useBuilderStore((s) => s.select);
  const selectedId = useBuilderStore((s) => s.selectedId);
  const removeField = useBuilderStore((s) => s.removeField);
  const reorder = useBuilderStore((s) => s.reorder);

  const sensors = useSensors(useSensor(PointerSensor));

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
  const fromIndex = fields.findIndex((f) => f.id === String(active.id));
  const toIndex = fields.findIndex((f) => f.id === String(over.id));
    if (fromIndex >= 0 && toIndex >= 0) reorder(fromIndex, toIndex);
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Canvas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {fields.map((f) => (
                <SortableItem key={f.id} id={f.id}>
                  <div
                    className={`flex items-center justify-between rounded border p-3 ${selectedId === f.id ? "border-ring" : "border-border"}`}
                    onClick={() => select(f.id)}
                  >
                    <div className="text-sm">{f.label} <span className="text-muted-foreground">({f.type})</span></div>
                    <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); removeField(f.id); }}>Remove</Button>
                  </div>
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}
