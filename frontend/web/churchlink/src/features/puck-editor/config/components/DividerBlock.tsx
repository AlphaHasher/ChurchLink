import type { ComponentConfig } from "@measured/puck";

export type DividerBlockProps = {
  style: "solid" | "dashed" | "dotted";
  thickness: "thin" | "medium" | "thick";
  color: "border" | "muted" | "primary" | "secondary";
  spacing: "sm" | "md" | "lg";
};

export const DividerBlock: ComponentConfig<DividerBlockProps> = {
  label: "Divider",
  fields: {
    style: {
      type: "radio",
      label: "Style",
      options: [
        { label: "Solid", value: "solid" },
        { label: "Dashed", value: "dashed" },
        { label: "Dotted", value: "dotted" },
      ],
    },
    thickness: {
      type: "radio",
      label: "Thickness",
      options: [
        { label: "Thin", value: "thin" },
        { label: "Medium", value: "medium" },
        { label: "Thick", value: "thick" },
      ],
    },
    color: {
      type: "select",
      label: "Color",
      options: [
        { label: "Default", value: "border" },
        { label: "Muted", value: "muted" },
        { label: "Primary", value: "primary" },
        { label: "Secondary", value: "secondary" },
      ],
    },
    spacing: {
      type: "select",
      label: "Vertical Spacing",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
      ],
    },
  },
  defaultProps: {
    style: "solid",
    thickness: "thin",
    color: "border",
    spacing: "md",
  },
  render: ({ style, thickness, color, spacing }) => {
    const thicknessMap: Record<string, string> = {
      thin: "1px",
      medium: "2px",
      thick: "4px",
    };

    const colorClasses: Record<string, string> = {
      border: "border-border",
      muted: "border-muted-foreground/30",
      primary: "border-primary",
      secondary: "border-secondary",
    };

    const spacingClasses: Record<string, string> = {
      sm: "my-4",
      md: "my-8",
      lg: "my-12",
    };

    return (
      <hr
        className={`w-full ${colorClasses[color]} ${spacingClasses[spacing]}`}
        style={{
          borderStyle: style,
          borderTopWidth: thicknessMap[thickness],
        }}
      />
    );
  },
};
