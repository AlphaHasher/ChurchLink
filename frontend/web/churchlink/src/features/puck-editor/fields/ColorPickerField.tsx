import { useState, useCallback, useRef, useEffect } from "react";
import { SketchPicker } from "react-color";
import type { ColorResult } from "react-color";

interface ColorPickerFieldProps {
  value: string;
  onChange: (value: string) => void;
}

function colorResultToString(color: ColorResult): string {
  const { r, g, b, a = 1 } = color.rgb;
  return a < 1 ? `rgba(${r}, ${g}, ${b}, ${a})` : color.hex;
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
    }
  }, [value]);

  // Handle color changes from the picker
  const handleColorChange = useCallback((color: ColorResult) => {
    // Skip the initial mount callback
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    const newValue = colorResultToString(color);
    setLocalColor(newValue);

    // Only call parent onChange if value actually changed
    if (newValue !== lastExternalValue.current) {
      lastExternalValue.current = newValue;
      onChange(newValue);
    }
  }, [onChange]);

  return (
    <div className="space-y-2">
      <SketchPicker
        color={localColor}
        onChange={handleColorChange}
        disableAlpha={false}
        width="100%"
      />

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
