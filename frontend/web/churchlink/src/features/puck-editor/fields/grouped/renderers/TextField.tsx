import * as React from "react";
import { Input } from "@/shared/components/ui/input";
import type { FieldDefinition } from "../types";

export interface TextFieldProps {
  value: unknown;
  onChange: (value: unknown) => void;
  fieldDef: FieldDefinition;
}

export function TextField({ value, onChange, fieldDef }: TextFieldProps) {
  const [localValue, setLocalValue] = React.useState(String(value || ""));

  // Sync from parent when value prop changes (e.g., undo/redo)
  React.useEffect(() => {
    setLocalValue(String(value || ""));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    onChange(newValue); // Update immediately on keystroke
  };

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{fieldDef.label}</label>
      <Input
        type="text"
        value={localValue}
        onChange={handleChange}
        placeholder={fieldDef.label}
        className="h-8"
      />
    </div>
  );
}
