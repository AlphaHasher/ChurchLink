import type { ComponentConfig } from "@measured/puck";

export type TextBlockProps = {
  content: string;
  variant: "h1" | "h2" | "h3" | "h4" | "p" | "lead" | "muted";
  align: "left" | "center" | "right";
};

export const TextBlock: ComponentConfig<TextBlockProps> = {
  label: "Text",
  fields: {
    content: {
      type: "textarea",
      label: "Content",
    },
    variant: {
      type: "select",
      label: "Style",
      options: [
        { label: "Heading 1", value: "h1" },
        { label: "Heading 2", value: "h2" },
        { label: "Heading 3", value: "h3" },
        { label: "Heading 4", value: "h4" },
        { label: "Paragraph", value: "p" },
        { label: "Lead Text", value: "lead" },
        { label: "Muted Text", value: "muted" },
      ],
    },
    align: {
      type: "radio",
      label: "Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
  },
  defaultProps: {
    content: "Enter your text here...",
    variant: "p",
    align: "left",
  },
  render: ({ content, variant, align }) => {
    const alignClass = {
      left: "text-left",
      center: "text-center",
      right: "text-right",
    }[align];

    const variantClasses: Record<string, string> = {
      h1: "text-4xl font-bold tracking-tight",
      h2: "text-3xl font-semibold tracking-tight",
      h3: "text-2xl font-semibold",
      h4: "text-xl font-semibold",
      p: "text-base",
      lead: "text-xl text-muted-foreground",
      muted: "text-sm text-muted-foreground",
    };

    // Render the appropriate element based on variant
    if (variant === "h1") {
      return <h1 className={`${alignClass} ${variantClasses[variant]}`}>{content}</h1>;
    }
    if (variant === "h2") {
      return <h2 className={`${alignClass} ${variantClasses[variant]}`}>{content}</h2>;
    }
    if (variant === "h3") {
      return <h3 className={`${alignClass} ${variantClasses[variant]}`}>{content}</h3>;
    }
    if (variant === "h4") {
      return <h4 className={`${alignClass} ${variantClasses[variant]}`}>{content}</h4>;
    }
    return <p className={`${alignClass} ${variantClasses[variant]}`}>{content}</p>;
  },
};
