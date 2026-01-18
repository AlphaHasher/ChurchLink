import type { ComponentConfig } from "@puckeditor/core";
import parse from "html-react-parser";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import styles from "../../styles/components/Text.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import { getShadowStyle, shadowPresetLabels, type ShadowPreset } from "../../utils/shadowPresets";
import { FontFamilyField } from "../../fields/FontFamilyField";
import { ColorPickerField } from "../../fields/ColorPickerField";
import { RichtextField } from "../../fields/RichtextField";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePreviewLanguageSafe } from "../../context/PuckLanguageContext";
import { getTranslation, type TranslationMap } from "../../utils/languageUtils";
import { sanitizeHtml } from "../../utils/sanitize";

const getClassName = getClassNameFactory("Text", styles);

export type TextBlockPropsInner = {
  content: string;           // HTML from richtext field
  typography?: {
    fontFamily?: string;
    color?: string
  };
  shadow?: ShadowPreset;
  maxWidth?: number;
  translations?: TranslationMap;
};

export type TextBlockProps = TextBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const TextBlockInternal: ComponentConfig<TextBlockPropsInner> = {
  label: "Text",
  fields: {
    content: {
      type: "custom",
      label: "Content",
      render: ({ value, onChange }) => (
        <RichtextField value={value as string} onChange={onChange} />
      ),
    },
    typography: {
      type: "object",
      objectFields: {
        fontFamily: {
          type: "custom",
          label: "Font Family",
          render: ({ value, onChange }) => (
            <FontFamilyField value={value as string} onChange={onChange} />
          ),
        },
        color: {
          type: "custom",
          label: "Color",
          render: ({ value, onChange }) => (
            <ColorPickerField value={value as string} onChange={onChange} />
          ),
        },
      },
    },
    shadow: {
      type: "select",
      label: "Drop Shadow",
      options: Object.entries(shadowPresetLabels).map(([value, label]) => ({
        label,
        value,
      })),
    },
    maxWidth: {
      type: "number",
      label: "Max Width (px)",
      min: 0,
    },
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange }) => (
        <TranslationsField
          value={value as TranslationMap}
          onChange={onChange}
          translatableFields={[
            { name: "content", type: "richtext", label: "Content" },
          ]}
        />
      ),
    },
  },
  defaultProps: {
    content: "Enter your text here...",
    typography: { fontFamily: "", color: "" },
    shadow: "none",
    maxWidth: undefined,
    translations: {},
  },
  render: ({ content, typography, shadow, maxWidth, translations }) => {
    const previewLanguage = usePreviewLanguageSafe();
    const translatedContent = getTranslation(translations, previewLanguage, "content");
    // Use translation if available, otherwise use original content
    const displayContent = translatedContent || content;

    const sharedStyle = {
      color: typography?.color || "inherit",
      maxWidth: maxWidth ? `${maxWidth}px` : undefined,
      ...getFontFamilyStyle(typography?.fontFamily),
      ...(shadow && shadow !== "none" ? getShadowStyle(shadow) : {}),
    };

    const sharedProps = {
      className: getClassName(),
      style: sharedStyle,
    };

    const renderContent = () => parse(sanitizeHtml(displayContent));

    return (
      <Section>
        <div {...sharedProps}>{renderContent()}</div>
      </Section>
    );
  },
};

export const TextBlock = withLayout(TextBlockInternal);
