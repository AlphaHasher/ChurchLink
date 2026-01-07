import { FontFamilyField } from "./FontFamilyField";
import { ColorPickerField } from "./ColorPickerField";

interface TypographyFieldProps {
  value: {
    fontFamily?: string;
    color?: string;
  };
  onChange: (value: { fontFamily?: string; color?: string }) => void;
}

export function TypographyField({ value, onChange }: TypographyFieldProps) {
  const { fontFamily = "", color = "" } = value || {};

  return (
    <div className="space-y-2">
      <FontFamilyField
        value={fontFamily}
        onChange={(newFont) => onChange({ ...value, fontFamily: newFont })}
      />
      <div className="pt-1">
        <label className="text-xs text-muted-foreground mb-1 block">Color</label>
        <ColorPickerField
          value={color}
          onChange={(newColor) => onChange({ ...value, color: newColor })}
        />
      </div>
    </div>
  );
}
