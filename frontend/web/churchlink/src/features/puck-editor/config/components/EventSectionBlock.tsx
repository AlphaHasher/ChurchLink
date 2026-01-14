import type { ComponentConfig } from "@puckeditor/core";
import { usePuck } from "@puckeditor/core";
import EventSection from "@/features/admin/components/WebBuilder/sections/EventSection";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import { getTranslation, type TranslationMap } from "../../utils/languageUtils";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import { extractComponentId } from "../../utils/puckFieldUtils";
import { findComponentRecursive, updateComponentRecursive } from "../../utils/puckDataUtils";
import { GroupedFieldsPanel } from "../../fields/grouped/GroupedFieldsPanel";
import { eventSectionBlockGroups } from "../../fields/grouped/componentConfigs/eventSectionBlock";

export type EventSectionBlockProps = {
  title: string;
  titleFont?: string;
  titleColor?: string;
  showTitle: boolean;
  showFilters: boolean;
  translations?: TranslationMap;
};

export const EventSectionBlock: ComponentConfig<EventSectionBlockProps> = {
  label: "Events",
  fields: {
    title: {
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
            config={eventSectionBlockGroups}
          />
        );
      },
    } as any,
  } as any,
  defaultProps: {
    title: "Upcoming Events",
    titleFont: "",
    titleColor: "#000000",
    showTitle: true,
    showFilters: true,
    translations: {},
  },
  render: ({ title, titleFont, titleColor, showTitle, showFilters, translations }) => {
    // Try to use preview language context, but gracefully handle if not in editor
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context (e.g., public page renderer) - will be handled by localizeComponentData
    }

    // Use translated title if available, otherwise use default
    const displayTitle = getTranslation(translations, previewLanguage, "title") || title;
    const titleFontStyles = getFontFamilyStyle(titleFont);
    const titleFontFamily = titleFontStyles?.fontFamily as string | undefined;

    return (
      <EventSection
        title={displayTitle}
        titleFont={titleFontFamily}
        titleColor={titleColor}
        showTitle={showTitle}
        showFilters={showFilters}
      />
    );
  },
};
