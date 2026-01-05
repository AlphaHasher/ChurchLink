import { useState, useMemo } from "react";
import { icons } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { X } from "lucide-react";

interface IconPickerFieldProps {
  value?: string;
  onChange: (value: string) => void;
}

export const IconPickerField = ({ value = "none", onChange }: IconPickerFieldProps) => {
  const [search, setSearch] = useState("");

  // Get all icon names from lucide-react
  const iconNames = useMemo(() => Object.keys(icons), []);

  // Filter icons based on search
  const filteredIcons = useMemo(() => {
    if (!search) return iconNames.slice(0, 50); // Show first 50 by default
    const searchLower = search.toLowerCase();
    return iconNames
      .filter((name) => name.toLowerCase().includes(searchLower))
      .slice(0, 100); // Limit to 100 results
  }, [search, iconNames]);

  const renderIcon = (iconName: string) => {
    try {
      const LucideIcon = (icons as Record<string, React.ComponentType<{ size?: number }>>)[iconName];
      if (!LucideIcon) return null;
      return <LucideIcon size={20} />;
    } catch {
      return null;
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {/* Search input */}
      <Input
        type="text"
        placeholder="Search icons..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {/* Selected icon preview */}
      {value && value !== "none" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.5rem",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            backgroundColor: "hsl(var(--muted))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}>
            {renderIcon(value)}
            <span style={{ fontSize: "0.875rem" }}>{value}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChange("none")}
            style={{ padding: "0.25rem" }}
          >
            <X size={16} />
          </Button>
        </div>
      )}

      {/* Icon grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(48px, 1fr))",
          gap: "0.5rem",
          maxHeight: "300px",
          overflowY: "auto",
          padding: "0.5rem",
          border: "1px solid hsl(var(--border))",
          borderRadius: "6px",
        }}
      >
        {/* None option */}
        <button
          type="button"
          onClick={() => onChange("none")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "48px",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
            backgroundColor: value === "none" ? "hsl(var(--primary))" : "transparent",
            color: value === "none" ? "hsl(var(--primary-foreground))" : "inherit",
            cursor: "pointer",
            fontSize: "0.75rem",
          }}
        >
          None
        </button>

        {/* Icon options */}
        {filteredIcons.map((iconName) => (
          <button
            key={iconName}
            type="button"
            onClick={() => onChange(iconName)}
            title={iconName}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "48px",
              border: "1px solid hsl(var(--border))",
              borderRadius: "6px",
              backgroundColor: value === iconName ? "hsl(var(--primary))" : "transparent",
              color: value === iconName ? "hsl(var(--primary-foreground))" : "inherit",
              cursor: "pointer",
            }}
          >
            {renderIcon(iconName)}
          </button>
        ))}
      </div>

      {/* Results count */}
      <div style={{ fontSize: "0.75rem", color: "hsl(var(--muted-foreground))" }}>
        {search && `${filteredIcons.length} icons found`}
        {!search && `Showing first 50 icons. Search to see more.`}
      </div>
    </div>
  );
};
