import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { RgbaColorPicker, RgbaColor } from "react-colorful";

interface ColorPickerFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

// Parse color string to RgbaColor
function parseColor(color: string): RgbaColor {
  if (!color) return { r: 255, g: 255, b: 255, a: 1 };

  // Handle rgba format
  const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1,
    };
  }

  // Handle hex format
  const hex = color.replace("#", "");
  if (hex.length === 6 || hex.length === 8) {
    return {
      r: parseInt(hex.slice(0, 2), 16),
      g: parseInt(hex.slice(2, 4), 16),
      b: parseInt(hex.slice(4, 6), 16),
      a: hex.length === 8 ? parseInt(hex.slice(6, 8), 16) / 255 : 1,
    };
  }

  return { r: 255, g: 255, b: 255, a: 1 };
}

// Convert RgbaColor to string
function colorToString(color: RgbaColor): string {
  if (color.a < 1) {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${color.a})`;
  }
  const toHex = (n: number) => n.toString(16).padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

export function ColorPickerField({ value, onChange, label }: ColorPickerFieldProps) {
  const [localColor, setLocalColor] = useState<RgbaColor>(() => parseColor(value));
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  // Refs
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Sync external value changes (undo/redo)
  useEffect(() => {
    const parsed = parseColor(value);
    const current = localColor;
    if (
      parsed.r !== current.r ||
      parsed.g !== current.g ||
      parsed.b !== current.b ||
      parsed.a !== current.a
    ) {
      setLocalColor(parsed);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Update position when opening popover
  const updatePosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, []);

  // Click outside to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Debounced update for smooth dragging
  const handleChange = useCallback((color: RgbaColor) => {
    setLocalColor(color);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChangeRef.current(colorToString(color));
    }, 32);
  }, []);

  const handleClear = useCallback(() => {
    setLocalColor({ r: 255, g: 255, b: 255, a: 1 });
    onChangeRef.current("");
  }, []);

  const hexDisplay = colorToString(localColor);
  const hasColor = value && value !== "";

  return (
    <div className="space-y-1">
      {label && <label className="text-sm font-medium">{label}</label>}
      <div className="relative">
        {/* Compact inline color input */}
        <div className="flex items-center h-9 w-full rounded-md border border-input bg-background text-sm">
          <button
            ref={triggerRef}
            type="button"
            onClick={() => {
              if (!isOpen) {
                updatePosition();
              }
              setIsOpen(!isOpen);
            }}
            className="h-7 w-7 m-1 rounded border border-border shrink-0 cursor-pointer"
            style={{
              backgroundColor: hasColor ? hexDisplay : "#ffffff",
              backgroundImage: !hasColor
                ? "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)"
                : undefined,
              backgroundSize: "6px 6px",
              backgroundPosition: "0 0, 0 3px, 3px -3px, -3px 0px",
            }}
            title="Pick color"
          />
          <input
            type="text"
            value={hasColor ? hexDisplay : ""}
            placeholder="None"
            onChange={(e) => {
              if (!e.target.value) {
                handleClear();
                return;
              }
              const parsed = parseColor(e.target.value);
              setLocalColor(parsed);
              onChangeRef.current(colorToString(parsed));
            }}
            className="flex-1 h-full bg-transparent text-xs font-mono px-2 outline-none"
          />
          {hasColor && (
            <button
              type="button"
              onClick={handleClear}
              className="px-2 text-xs text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>

      </div>

      {/* Popover picker using portal */}
      {isOpen && createPortal(
        <div
          ref={popoverRef}
          className="p-3 bg-popover border border-border rounded-lg shadow-lg"
          style={{
            position: "fixed",
            top: `${position.top}px`,
            left: `${position.left}px`,
            zIndex: 9999,
          }}
        >
          <RgbaColorPicker
            color={localColor}
            onChange={handleChange}
            style={{ width: "200px" }}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
