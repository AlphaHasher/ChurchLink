import type { ComponentConfig } from "@measured/puck";
import { withLayout } from "../shared/Layout";
import { ColorPickerField } from "../../fields/ColorPickerField";

export type DividerBlockPropsInner = {
  style: "solid" | "dashed" | "dotted";
  thickness: "thin" | "medium" | "thick";
  color: string;
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
      type: "custom",
      label: "Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} label="Color" />
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
    color: "",
    spacing: "md",
  },
  render: ({ style, thickness, color, spacing }) => {
    const thicknessMap: Record<string, string> = {
      thin: "1px",
      medium: "2px",
      thick: "4px",
    };

    const spacingClasses: Record<string, string> = {
      sm: "my-4",
      md: "my-8",
      lg: "my-12",
    };

    return (
      <hr
        className={`w-full border-t ${spacingClasses[spacing]}`}
        style={{
          borderStyle: style,
          borderTopWidth: thicknessMap[thickness],
          borderColor: color || "hsl(var(--border))",
        }}
      />
    );
  },
};

export const DividerBlock = withLayout(DividerBlockInternal);
