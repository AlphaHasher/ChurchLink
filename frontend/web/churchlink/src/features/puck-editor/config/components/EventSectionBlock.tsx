import type { ComponentConfig } from "@puckeditor/core";
import EventSection from "@/features/admin/components/WebBuilder/sections/EventSection";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import { getTranslation, type TranslationMap } from "../../utils/languageUtils";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import { FontFamilyField } from "../../fields/FontFamilyField";
import { ColorPickerField } from "../../fields/ColorPickerField";
import { TranslationsField } from "../../fields/TranslationsField";

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
    titleFont: {
      type: "custom",
      label: "Title Font",
      render: ({ value, onChange }) => (
        <FontFamilyField value={value as string} onChange={onChange} />
      ),
    },
    titleColor: {
      type: "custom",
      label: "Title Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value as string} onChange={onChange} />
      ),
    },
    showTitle: {
      type: "radio",
      label: "Show Title",
      options: [
        { label: "Yes", value: true as any },
        { label: "No", value: false as any },
      ],
    },
    showFilters: {
      type: "radio",
      label: "Show Filters",
      options: [
        { label: "Yes", value: true as any },
        { label: "No", value: false as any },
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
            { name: "title", type: "text", label: "Section Title" },
          ]}
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
