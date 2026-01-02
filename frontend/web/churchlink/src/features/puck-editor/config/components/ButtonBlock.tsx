import type { ComponentConfig } from "@measured/puck";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";

export type ButtonBlockProps = {
  label: string;
  href: string;
  variant: "default" | "secondary" | "outline" | "ghost" | "destructive";
  size: "sm" | "default" | "lg";
  fullWidth: boolean;
  translations?: TranslationMap;
};

export const ButtonBlock: ComponentConfig<ButtonBlockProps> = {
  label: "Button",
  fields: {
    label: {
      type: "text",
      label: "Button Text",
    },
    href: {
      type: "text",
      label: "Link URL",
    },
    variant: {
      type: "select",
      label: "Style",
      options: [
        { label: "Primary", value: "default" },
        { label: "Secondary", value: "secondary" },
        { label: "Outline", value: "outline" },
        { label: "Ghost", value: "ghost" },
        { label: "Destructive", value: "destructive" },
      ],
    },
    size: {
      type: "radio",
      label: "Size",
      options: [
        { label: "Small", value: "sm" },
        { label: "Medium", value: "default" },
        { label: "Large", value: "lg" },
      ],
    },
    fullWidth: {
      type: "radio",
      label: "Width",
      options: [
        { label: "Auto", value: false },
        { label: "Full Width", value: true },
      ],
    },
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange }) => (
        <TranslationsField
          value={value as TranslationMap}
          onChange={onChange}
          translatableFields={[{ name: "label", type: "text", label: "Button Text" }]}
        />
      ),
    },
  },
  defaultProps: {
    label: "Click me",
    href: "#",
    variant: "default",
    size: "default",
    fullWidth: false,
    translations: {},
  },
  render: ({ label, href, variant, size, fullWidth, translations }) => {
    // Try to use preview language context, but gracefully handle if not in editor
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context (e.g., public page renderer) - will be handled by localizeComponentData
    }

    // Use translated label if available, otherwise use default
    const displayLabel = translations?.[previewLanguage]?.label || label;

    const baseClasses = "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

    const variantClasses: Record<string, string> = {
      default: "bg-primary text-primary-foreground hover:bg-primary/90",
      secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
      outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    };

    const sizeClasses: Record<string, string> = {
      sm: "h-9 px-3 text-sm",
      default: "h-10 px-4 py-2",
      lg: "h-11 px-8 text-lg",
    };

    const widthClass = fullWidth ? "w-full" : "";

    return (
      <a
        href={href}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass}`}
      >
        {displayLabel}
      </a>
    );
  },
};
