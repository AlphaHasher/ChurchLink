import { useState, useCallback, useRef, useEffect } from "react";
import {
  ColorPicker,
  ColorPickerSelection,
  ColorPickerHue,
  ColorPickerAlpha,
  ColorPickerFormat,
  ColorPickerOutput
} from "@/shared/components/ui/shadcn-io/color-picker";

interface ColorPickerFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function ColorPickerField({ value, onChange }: ColorPickerFieldProps) {
  // Use local state to prevent infinite loops
  const [localColor, setLocalColor] = useState(value || "#ffffff");
  const isInitialMount = useRef(true);
  const lastExternalValue = useRef(value);

  // Sync from external value changes (e.g., undo/redo)
  useEffect(() => {
    if (value !== lastExternalValue.current) {
      lastExternalValue.current = value;
      setLocalColor(value || "#ffffff");
    }
  }, [value]);

  // Handle color changes from the picker
  const handleColorChange = useCallback((color: unknown) => {
    // Skip the initial mount callback
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (typeof color === 'object' && color && 'rgb' in color) {
      const colorObj = color as { rgb: () => { string: () => string } };
      const newValue = colorObj.rgb().string();
      setLocalColor(newValue);

      // Only call parent onChange if value actually changed
      if (newValue !== lastExternalValue.current) {
        lastExternalValue.current = newValue;
        onChange(newValue);
      }
    }
  }, [onChange]);

  return (
    <div className="space-y-2">
      <ColorPicker
        value={localColor}
        onChange={handleColorChange}
      >
        <div className="flex gap-2">
          <div className="flex-1 space-y-2">
            <ColorPickerSelection className="h-32" />
            <ColorPickerHue />
            <ColorPickerAlpha />
          </div>
        </div>
        <div className="flex gap-2">
          <ColorPickerOutput />
          <ColorPickerFormat className="flex-1" />
        </div>
      </ColorPicker>
      <button
        type="button"
        onClick={() => {
          setLocalColor("#ffffff");
          onChange("");
        }}
        className="text-xs text-muted-foreground hover:underline"
      >
        Clear color
      </button>
    </div>
  );
}
