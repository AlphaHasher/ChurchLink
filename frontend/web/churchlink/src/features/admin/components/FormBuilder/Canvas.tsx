import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/components/ui/sheet";
import { Pencil, Trash } from "lucide-react";
import { useBuilderStore } from "./store";
import { Inspector } from "./Inspector";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { SortableItem } from "./SortableItem";

export function Canvas() {
  const fields = useBuilderStore((s) => s.schema.fields);
  const select = useBuilderStore((s) => s.select);
  const removeField = useBuilderStore((s) => s.removeField);
  const reorder = useBuilderStore((s) => s.reorder);
  const selectedId = useBuilderStore((s) => s.selectedId);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor)
  );

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
  <DndContext sensors={sensors} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
              {fields.map((f, idx) => (
                <SortableItem key={f.id} id={f.id}>
                  {({ setNodeRef, setActivatorNodeRef, attributes, listeners, style }) => (
                    <div
                      ref={setNodeRef}
                      style={style}
                      className={`flex items-center justify-between rounded border p-3 ${selectedId === f.id ? "border-ring" : "border-border"}`}
                      onClick={() => select(f.id)}
                      {...attributes}
                    >
                      <div className="text-sm flex items-center gap-2">
                        <span
                          ref={setActivatorNodeRef}
                          className="mr-1 cursor-grab select-none"
                          {...listeners}
                          onClick={(e) => e.stopPropagation()}
                          aria-label="Drag handle"
                          title="Drag to reorder"
                        >
                          ⋮⋮
                        </span>
                        {idx + 1}. {f.label} <span className="text-muted-foreground">({f.type}{f.width ? ` • ${f.width}` : ""})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Sheet>
                          <SheetTrigger asChild>
                            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); select(f.id); }} title="Edit">
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </SheetTrigger>
                          <SheetContent side="left" className="sm:max-w-md w-[90vw] p-0">
                            <SheetHeader className="p-4 pb-2">
                              <SheetTitle>Edit Field</SheetTitle>
                            </SheetHeader>
                            <div className="max-h-[80vh] overflow-auto p-4 pt-2">
                              <Inspector />
                            </div>
                          </SheetContent>
                        </Sheet>
                        <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); removeField(f.id); }} title="Remove">
                          <Trash className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </SortableItem>
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}
