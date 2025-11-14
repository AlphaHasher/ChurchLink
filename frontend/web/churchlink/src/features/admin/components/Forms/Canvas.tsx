import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/components/ui/sheet";
import { Pencil, Trash, Lock } from "lucide-react";
import { useBuilderStore } from "./store";
import { Inspector } from "./Inspector";
import { DndContext, PointerSensor, KeyboardSensor, useSensor, useSensors, DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
import { SortableItem } from "./SortableItem";

const FRIENDLY_TYPE: Record<string, string> = {
  text: "Text Field",
  email: "Email Field",
  url: "URL Field",
  tel: "Phone Field",
  textarea: "Paragraph Field",
  number: "Number Field",
  checkbox: "Checkbox",
  switch: "Switch",
  select: "Select Field",
  radio: "Radio Group",
  date: "Date Field",
  time: "Time Field",
  static: "Static Text",
  price: "Price Field",
};

export function Canvas() {
  const fields = useBuilderStore((s) => s.schema.data);
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
              {fields.map((f, idx) => {
                const isPriceField = f.type === 'price';
                return (
                  <SortableItem key={f.id} id={f.id} disabled={isPriceField}>
                    {({ setNodeRef, setActivatorNodeRef, attributes, listeners, style }) => (
                      <div
                        ref={setNodeRef}
                        style={style}
                        className={`flex items-center justify-between rounded border p-3 ${selectedId === f.id ? "border-ring" : "border-border"} ${isPriceField ? "bg-muted/50" : ""}`}
                        onClick={() => select(f.id)}
                        {...(isPriceField ? {} : attributes)}
                      >
                        <div className="text-sm flex items-center gap-2 min-w-0">
                          <span
                            ref={setActivatorNodeRef}
                            className={`mr-1 flex-shrink-0 ${isPriceField ? "text-muted-foreground" : "cursor-grab select-none"}`}
                            {...(isPriceField ? {} : listeners)}
                            onClick={(e) => e.stopPropagation()}
                            aria-label={isPriceField ? "Payment Method (auto-managed)" : "Drag handle"}
                            title={isPriceField ? "Payment Method is auto-managed and always positioned at the bottom" : "Drag to reorder"}
                          >
                            {isPriceField ? <Lock className="h-4 w-4" /> : "⋮⋮"}
                          </span>
                          <span className="flex-shrink-0">{idx + 1}.</span>
                          <span className="truncate" title={(() => {
                            if (f.type === 'static') {
                              const content = (f as any).content;
                              return typeof content === 'string' && content.trim().length > 0 ? content : FRIENDLY_TYPE[f.type];
                            }
                            const raw = (f as any).label;
                            return typeof raw === 'string' && raw.trim().length > 0 ? raw : FRIENDLY_TYPE[f.type] || `${f.type[0].toUpperCase()}${f.type.slice(1)} Field`;
                          })()}>
                            {(() => {
                              if (f.type === 'static') {
                                const content = (f as any).content;
                                return typeof content === 'string' && content.trim().length > 0 ? content : FRIENDLY_TYPE[f.type];
                              }
                              const raw = (f as any).label;
                              const hasCustom = typeof raw === 'string' && raw.trim().length > 0;
                              return hasCustom ? raw : FRIENDLY_TYPE[f.type] || `${f.type[0].toUpperCase()}${f.type.slice(1)} Field`;
                            })()}
                          </span>
                          <span className="text-muted-foreground flex-shrink-0">({f.type}{f.width ? ` • ${f.width}` : ""})</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Sheet>
                            <SheetTrigger asChild>
                              <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); select(f.id); }} title="Edit" className="ml-2">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </SheetTrigger>
                            <SheetContent side="left" className="sm:max-w-md w-[90vw] p-0 flex flex-col">
                              <SheetHeader className="p-4 pb-2 flex-shrink-0">
                                <SheetTitle>Edit Field</SheetTitle>
                              </SheetHeader>
                              <div className="flex-1 overflow-y-auto p-4 pt-2 pb-6">
                                <Inspector />
                              </div>
                            </SheetContent>
                          </Sheet>
                          {!isPriceField && (
                            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); removeField(f.id); }} title="Remove">
                              <Trash className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </SortableItem>
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}
