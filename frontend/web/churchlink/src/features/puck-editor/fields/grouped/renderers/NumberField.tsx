import { Input } from "@/shared/components/ui/input";
import type { FieldDefinition } from "../types";

export interface NumberFieldProps {
  value: unknown;
  onChange: (value: unknown) => void;
  fieldDef: FieldDefinition;
}

export function NumberField({ value, onChange, fieldDef }: NumberFieldProps) {
  const numValue = value === null || value === undefined ? "" : String(value);

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{fieldDef.label}</label>
      <Input
        type="number"
        value={numValue}
        onChange={(e) => {
          const numVal = e.target.value ? parseInt(e.target.value, 10) : null;
          onChange(numVal);
        }}
        placeholder={fieldDef.label}
        min={fieldDef.min}
        max={fieldDef.max}
        className="h-8"
      />
    </div>
  );
}
