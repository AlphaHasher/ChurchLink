import type { ComponentConfig } from "@measured/puck";
import EventSection from "@/features/admin/components/WebBuilder/sections/EventSection";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";
import { ColorPickerField } from "../../fields/ColorPickerField";
import { fontFamilyField } from "../shared/fontField";
import { getFontFamilyVariables } from "../../utils/fontLoader";

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
      type: "text",
      label: "Section Title",
    },
    titleFont: fontFamilyField,
    titleColor: {
      type: "custom",
      label: "Title Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} />
      ),
    },
    showTitle: {
      type: "radio",
      label: "Show Title",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    showFilters: {
      type: "radio",
      label: "Show Filters",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false },
      ],
    },
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange }) => (
        <TranslationsField
          value={value as TranslationMap}
          onChange={onChange}
          translatableFields={[{ name: "title", type: "text", label: "Section Title" }]}
        />
      ),
    },
  },
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
    const displayTitle = translations?.[previewLanguage]?.title || title;
    const titleFontVars = getFontFamilyVariables(titleFont);
    const titleFontFamily = titleFontVars?.fontFamily as string | undefined;

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
