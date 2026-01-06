import type { ComponentConfig } from "@measured/puck";
import { withLayout } from "../shared/Layout";
import { ColorPickerField } from "../../fields/ColorPickerField";

export type DividerBlockPropsInner = {
  style: "solid" | "dashed" | "dotted";
  thickness: "thin" | "medium" | "thick";
  color: "border" | "muted" | "primary" | "secondary" | "custom";
  customColor?: string;
  spacing: "sm" | "md" | "lg";
};

export type DividerBlockProps = DividerBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const DividerBlockInternal: ComponentConfig<DividerBlockPropsInner> = {
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
      label: "Color Preset",
      options: [
        { label: "Default", value: "border" },
        { label: "Muted", value: "muted" },
        { label: "Primary", value: "primary" },
        { label: "Secondary", value: "secondary" },
        { label: "Custom", value: "custom" },
      ],
    },
    customColor: {
      type: "custom",
      label: "Custom Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} />
      ),
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
    customColor: "",
    spacing: "md",
  },
  render: ({ style, thickness, color, customColor, spacing }) => {
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
      custom: "border-black/20",
    };

    const spacingClasses: Record<string, string> = {
      sm: "my-4",
      md: "my-8",
      lg: "my-12",
    };

    const finalColor = color === "custom" && customColor ? customColor : undefined;

    return (
      <hr
        className={`w-full border-t ${colorClasses[color]} ${spacingClasses[spacing]}`}
        style={{
          borderStyle: style,
          borderTopWidth: thicknessMap[thickness],
          ...(finalColor ? { borderColor: finalColor } : {}),
        }}
      />
    );
  },
};

export const DividerBlock = withLayout(DividerBlockInternal);
