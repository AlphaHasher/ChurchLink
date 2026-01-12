import * as React from "react";
import { Textarea } from "@/shared/components/ui/textarea";
import type { FieldDefinition } from "../types";

export interface TextareaFieldProps {
  value: unknown;
  onChange: (value: unknown) => void;
  fieldDef: FieldDefinition;
}

export function TextareaField({ value, onChange, fieldDef }: TextareaFieldProps) {
  const [localValue, setLocalValue] = React.useState(String(value || ""));

  // Sync from parent when value prop changes (e.g., undo/redo)
  React.useEffect(() => {
    setLocalValue(String(value || ""));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue); // Update immediately on keystroke
  };

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{fieldDef.label}</label>
      <Textarea
        value={localValue}
        onChange={handleChange}
        placeholder={fieldDef.label}
        className="min-h-20 resize-none"
      />
    </div>
  );
}
