import type { ComponentConfig } from "@measured/puck";
import { usePuck } from "@measured/puck";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import { getTranslation, type TranslationMap } from "../../utils/languageUtils";
import { extractComponentId } from "../../utils/puckFieldUtils";
import { findComponentRecursive, updateComponentRecursive } from "../../utils/puckDataUtils";
import { GroupedFieldsPanel } from "../../fields/grouped/GroupedFieldsPanel";
import { imageBlockGroups } from "../../fields/grouped/componentConfigs/imageBlock";

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
      type: "custom",
      label: "Settings",
      render: ({ id }: { id: string }) => {
        const componentId = extractComponentId(id);
        const { appState, dispatch } = usePuck();
        const componentResult = findComponentRecursive(appState.data, componentId);
        const component = componentResult?.component;

        const handleChange = (newProps: Record<string, unknown>) => {
          if (!component) return;

          const newData = updateComponentRecursive(appState.data, componentId, newProps);

          dispatch({
            type: "setData",
            data: newData,
          });
        };

        return (
          <GroupedFieldsPanel
            value={(component?.props as Record<string, unknown>) || {}}
            onChange={handleChange}
            config={imageBlockGroups}
          />
        );
      },
    } as any,
  } as any,
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
