import type { ComponentConfig } from "@measured/puck";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";

export type TextBlockProps = {
  content: string;
  variant: "h1" | "h2" | "h3" | "h4" | "p" | "lead" | "muted";
  align: "left" | "center" | "right";
  translations?: TranslationMap;
};

export const TextBlock: ComponentConfig<TextBlockProps> = {
  label: "Text",
  fields: {
    content: {
      type: "textarea",
      label: "Content",
      contentEditable: true,
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
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange }) => (
        <TranslationsField
          value={value as TranslationMap}
          onChange={onChange}
          translatableFields={[{ name: "content", type: "textarea", label: "Content" }]}
        />
      ),
    },
  },
  defaultProps: {
    content: "Enter your text here...",
    variant: "p",
    align: "left",
    translations: {},
  },
  render: ({ content, variant, align, translations }) => {
    // Try to use preview language context, but gracefully handle if not in editor
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context (e.g., public page renderer) - will be handled by localizeComponentData
    }

    // Use translated content if available, otherwise use default
    const displayContent = translations?.[previewLanguage]?.content || content;

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
      return <h1 className={`${alignClass} ${variantClasses[variant]}`}>{displayContent}</h1>;
    }
    if (variant === "h2") {
      return <h2 className={`${alignClass} ${variantClasses[variant]}`}>{displayContent}</h2>;
    }
    if (variant === "h3") {
      return <h3 className={`${alignClass} ${variantClasses[variant]}`}>{displayContent}</h3>;
    }
    if (variant === "h4") {
      return <h4 className={`${alignClass} ${variantClasses[variant]}`}>{displayContent}</h4>;
    }
    return <p className={`${alignClass} ${variantClasses[variant]}`}>{displayContent}</p>;
  },
};
