import type { ComponentConfig } from "@measured/puck";

export type SpacerBlockProps = {
  size: "xs" | "sm" | "md" | "lg" | "xl" | "2xl";
};

export const SpacerBlock: ComponentConfig<SpacerBlockProps> = {
  label: "Spacer",
  fields: {
    size: {
      type: "select",
      label: "Size",
      options: [
        { label: "Extra Small (16px)", value: "xs" },
        { label: "Small (24px)", value: "sm" },
        { label: "Medium (32px)", value: "md" },
        { label: "Large (48px)", value: "lg" },
        { label: "Extra Large (64px)", value: "xl" },
        { label: "2X Large (96px)", value: "2xl" },
      ],
    },
  },
  defaultProps: {
    size: "md",
  },
  render: ({ size }) => {
    const sizeClasses: Record<string, string> = {
      xs: "h-4",
      sm: "h-6",
      md: "h-8",
      lg: "h-12",
      xl: "h-16",
      "2xl": "h-24",
    };

    return <div className={sizeClasses[size]} aria-hidden="true" />;
  },
};
