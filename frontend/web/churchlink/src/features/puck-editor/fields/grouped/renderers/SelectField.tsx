import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import type { FieldDefinition } from "../types";

export interface SelectFieldProps {
  value: unknown;
  onChange: (value: unknown) => void;
  fieldDef: FieldDefinition;
}

export function SelectField({ value, onChange, fieldDef }: SelectFieldProps) {
  const options = fieldDef.options || [];
  const strValue = String(value || "");

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium">{fieldDef.label}</label>
      <Select value={strValue} onValueChange={onChange}>
        <SelectTrigger className="h-8">
          <SelectValue placeholder={`Select ${fieldDef.label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
