import * as React from "react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/shared/components/ui/accordion";
import { Button } from "@/shared/components/ui/button";
import {
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
} from "lucide-react";
import { fieldRenderers } from "./renderers";
import {
  addArrayItem,
  removeArrayItem,
  moveArrayItem,
  getValueAtPath,
  setValueAtPath,
} from "./utils";
import type { FieldDefinition } from "./types";

interface ArrayItemAccordionProps {
  items: unknown[];
  fields: FieldDefinition[];
  arrayPath: string;
  itemLabelField: string;
  maxItems: number;
  defaultItem: Record<string, unknown>;
  onChange: (newItems: unknown[]) => void;
}

export const ArrayItemAccordion: React.FC<ArrayItemAccordionProps> = ({
  items,
  fields,
  arrayPath,
  itemLabelField,
  maxItems,
  defaultItem,
  onChange,
}) => {
  // Get item label from itemLabelField
  const getItemLabel = (item: unknown, index: number): string => {
    if (typeof item !== "object" || item === null) {
      return `Item ${index + 1}`;
    }

    const itemObj = item as Record<string, unknown>;
    const labelValue = itemObj[itemLabelField];

    if (labelValue && typeof labelValue === "string" && labelValue.trim()) {
      return `${itemLabelField === "label" ? "" : itemLabelField} ${index + 1}: ${labelValue}`;
    }

    return `Item ${index + 1}`;
  };

  // Handle field change within an item
  const handleFieldChange = (itemIndex: number, fieldName: string, value: unknown) => {
    const item = items[itemIndex];
    if (typeof item !== "object" || item === null) return;

    const itemObj = item as Record<string, unknown>;
    const updatedItem = setValueAtPath(itemObj, fieldName, value);
    const newItems = [...items];
    newItems[itemIndex] = updatedItem;
    onChange(newItems);
  };

  // Handle delete item
  const handleDeleteItem = (index: number) => {
    const newState = removeArrayItem({ [arrayPath]: items }, arrayPath, index);
    const newItems = getValueAtPath(newState, arrayPath);
    if (Array.isArray(newItems)) {
      onChange(newItems);
    }
  };

  // Handle add item
  const handleAddItem = () => {
    if (items.length >= maxItems) return;
    const newState = addArrayItem({ [arrayPath]: items }, arrayPath, defaultItem);
    const newItems = getValueAtPath(newState, arrayPath);
    if (Array.isArray(newItems)) {
      onChange(newItems);
    }
  };

  // Handle move item up
  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const newState = moveArrayItem(
      { [arrayPath]: items },
      arrayPath,
      index,
      index - 1
    );
    const newItems = getValueAtPath(newState, arrayPath);
    if (Array.isArray(newItems)) {
      onChange(newItems);
    }
  };

  // Handle move item down
  const handleMoveDown = (index: number) => {
    if (index >= items.length - 1) return;
    const newState = moveArrayItem(
      { [arrayPath]: items },
      arrayPath,
      index,
      index + 1
    );
    const newItems = getValueAtPath(newState, arrayPath);
    if (Array.isArray(newItems)) {
      onChange(newItems);
    }
  };

  const canAddMore = items.length < maxItems;

  return (
    <div className="space-y-3">
      <Accordion type="single" collapsible className="space-y-2">
        {items.map((item, index) => {
          const itemLabel = getItemLabel(item, index);
          const itemObj =
            typeof item === "object" && item !== null
              ? (item as Record<string, unknown>)
              : {};

          return (
            <AccordionItem key={index} value={`item-${index}`} className="border rounded-md">
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50">
                <AccordionTrigger className="hover:no-underline flex-1 flex py-0">
                  <span className="text-sm font-medium text-left">
                    {itemLabel}
                  </span>
                </AccordionTrigger>

                <div className="flex items-center gap-1 ml-auto">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveUp(index);
                    }}
                    disabled={index === 0}
                    className="h-7 w-7 p-0"
                    title="Move up"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMoveDown(index);
                    }}
                    disabled={index === items.length - 1}
                    className="h-7 w-7 p-0"
                    title="Move down"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteItem(index);
                    }}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    title="Delete item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <AccordionContent className="px-3 py-3 space-y-3 bg-background">
                {fields.map((field) => {
                  const fieldValue = getValueAtPath(itemObj, field.name);
                  const Renderer = fieldRenderers[field.type];

                  if (!Renderer) {
                    return (
                      <div key={field.name} className="text-sm text-muted-foreground">
                        Unknown field type: {field.type}
                      </div>
                    );
                  }

                  return (
                    <Renderer
                      key={field.name}
                      value={fieldValue}
                      onChange={(value) =>
                        handleFieldChange(index, field.name, value)
                      }
                      fieldDef={field}
                    />
                  );
                })}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>

      {canAddMore && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleAddItem}
          className="w-full gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Item
        </Button>
      )}

      {!canAddMore && items.length > 0 && (
        <div className="text-xs text-muted-foreground px-3 py-2 bg-muted/30 rounded">
          Maximum {maxItems} items reached
        </div>
      )}
    </div>
  );
};
