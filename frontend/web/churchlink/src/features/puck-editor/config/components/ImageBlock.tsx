import type { ComponentConfig } from "@puckeditor/core";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import { getTranslation, type TranslationMap } from "../../utils/languageUtils";
import { getDropShadowStyle, type ShadowPreset } from "../../utils/shadowPresets";
import { TranslationsField } from "../../fields/TranslationsField";

export type ImageBlockPropsInner = {
  src: string;
  alt: string;
  objectFit: "contain" | "cover" | "fill" | "none";
  aspectRatio: "auto" | "1/1" | "4/3" | "16/9" | "21/9";
  rounded: "none" | "sm" | "md" | "lg" | "full";
  maxHeight?: number;
  align: "left" | "center" | "right";
  dropShadow?: ShadowPreset;
  translations?: TranslationMap;
};

export type ImageBlockProps = ImageBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const ImageBlockInternal: ComponentConfig<ImageBlockPropsInner> = {
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
    maxHeight: {
      type: "number",
      label: "Max Height (px)",
      min: 0,
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
    dropShadow: {
      type: "select",
      label: "Drop Shadow",
      options: [
        { label: "None", value: "none" },
        { label: "Extra Small", value: "xs" },
        { label: "Small", value: "sm" },
        { label: "Medium", value: "md" },
        { label: "Large", value: "lg" },
        { label: "Extra Large", value: "xl" },
      ],
    },
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange }) => (
        <TranslationsField
          value={value as TranslationMap}
          onChange={onChange}
          translatableFields={[
            { name: "alt", type: "text", label: "Alt Text" },
          ]}
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
    maxHeight: undefined,
    align: "center",
    dropShadow: "none",
    translations: {},
  },
  render: ({ src, alt, objectFit, aspectRatio, rounded, maxHeight, align, dropShadow, translations }) => {
    // Try to use preview language context, but gracefully handle if not in editor
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context (e.g., public page renderer) - will be handled by localizeComponentData
    }

    // Use translated alt text if available, otherwise use default
    const displayAlt = getTranslation(translations, previewLanguage, "alt") || alt;

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

    const containerStyle: React.CSSProperties = {
      display: "flex",
      justifyContent: align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center",
    };
    const imageStyle: React.CSSProperties = {
      ...getDropShadowStyle(dropShadow || "none"),
    };

    // Apply aspect ratio if specified (only when no maxHeight)
    if (aspectRatio !== "auto" && !maxHeight) {
      containerStyle.aspectRatio = aspectRatio.replace("/", " / ");
    }

    // Apply max height if specified - scale to fit
    if (maxHeight) {
      imageStyle.maxHeight = `${maxHeight}px`;
      imageStyle.width = "auto";
      imageStyle.height = "auto";
      imageStyle.objectFit = "contain";
    }

    return (
      <Section>
        <div className="w-full" style={containerStyle}>
          <img
            src={src}
            alt={displayAlt}
            className={maxHeight ? roundedClasses[rounded] : `w-full h-full ${objectFitClasses[objectFit]} ${roundedClasses[rounded]}`}
            style={imageStyle}
          />
        </div>
      </Section>
    );
  },
};

export const ImageBlock = withLayout(ImageBlockInternal);
