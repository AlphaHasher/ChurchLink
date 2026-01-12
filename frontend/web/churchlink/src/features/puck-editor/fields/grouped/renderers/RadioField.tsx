import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import type { FieldDefinition } from "../types";

export interface RadioFieldProps {
  value: unknown;
  onChange: (value: unknown) => void;
  fieldDef: FieldDefinition;
}

export function RadioField({ value, onChange, fieldDef }: RadioFieldProps) {
  const options = fieldDef.options || [];
  const strValue = String(value || "");

  const handleChange = (newValue: string) => {
    // Convert "true"/"false" strings to booleans
    if (newValue === "true") {
      onChange(true);
    } else if (newValue === "false") {
      onChange(false);
    } else {
      onChange(newValue);
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{fieldDef.label}</label>
      <RadioGroup value={strValue} onValueChange={handleChange}>
        {options.map((option) => (
          <div key={option.value} className="flex items-center space-x-2">
            <RadioGroupItem value={option.value} id={option.value} />
            <label htmlFor={option.value} className="text-sm cursor-pointer">
              {option.label}
            </label>
          </div>
        ))}
      </RadioGroup>
    </div>
  );
}
