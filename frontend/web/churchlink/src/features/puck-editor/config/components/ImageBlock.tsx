import type { ComponentConfig } from "@measured/puck";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";

export type ImageBlockProps = {
  src: string;
  alt: string;
  objectFit: "contain" | "cover" | "fill" | "none";
  aspectRatio: "auto" | "1/1" | "4/3" | "16/9" | "21/9";
  rounded: "none" | "sm" | "md" | "lg" | "full";
  translations?: TranslationMap;
};

export const ImageBlock: ComponentConfig<ImageBlockProps> = {
  label: "Image",
  fields: {
    src: {
      type: "text",
      label: "Image URL",
    },
    alt: {
      type: "text",
      label: "Alt Text",
    },
    objectFit: {
      type: "select",
      label: "Object Fit",
      options: [
        { label: "Contain", value: "contain" },
        { label: "Cover", value: "cover" },
        { label: "Fill", value: "fill" },
        { label: "None", value: "none" },
      ],
    },
    aspectRatio: {
      type: "select",
      label: "Aspect Ratio",
      options: [
        { label: "Auto", value: "auto" },
        { label: "Square (1:1)", value: "1/1" },
        { label: "Standard (4:3)", value: "4/3" },
        { label: "Widescreen (16:9)", value: "16/9" },
        { label: "Ultra-wide (21:9)", value: "21/9" },
      ],
    },
    rounded: {
      type: "select",
      label: "Border Radius",
      options: [
        { label: "None", value: "none" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Full", value: "full" },
      ],
    },
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange }) => (
        <TranslationsField
          value={value as TranslationMap}
          onChange={onChange}
          translatableFields={[{ name: "alt", type: "text", label: "Alt Text" }]}
        />
      ),
    },
  },
  defaultProps: {
    src: "https://placehold.co/800x400",
    alt: "Image description",
    objectFit: "cover",
    aspectRatio: "16/9",
    rounded: "md",
    translations: {},
  },
  render: ({ src, alt, objectFit, aspectRatio, rounded, translations }) => {
    // Try to use preview language context, but gracefully handle if not in editor
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context (e.g., public page renderer) - will be handled by localizeComponentData
    }

    // Use translated alt text if available, otherwise use default
    const displayAlt = translations?.[previewLanguage]?.alt || alt;

    const objectFitClasses: Record<string, string> = {
      contain: "object-contain",
      cover: "object-cover",
      fill: "object-fill",
      none: "object-none",
    };

    const roundedClasses: Record<string, string> = {
      none: "rounded-none",
      sm: "rounded-sm",
      md: "rounded-md",
      lg: "rounded-lg",
      full: "rounded-full",
    };

    const aspectRatioStyle = aspectRatio !== "auto"
      ? { aspectRatio: aspectRatio.replace("/", " / ") }
      : {};

    return (
      <div className="w-full" style={aspectRatioStyle}>
        <img
          src={src}
          alt={displayAlt}
          className={`w-full h-full ${objectFitClasses[objectFit]} ${roundedClasses[rounded]}`}
        />
      </div>
    );
  },
};
