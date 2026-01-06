import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import styles from "../../styles/components/Text.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";
import { ALargeSmall, AlignLeft } from "lucide-react";
import { fontFamilyField } from "../shared/fontField";
import { getFontFamilyVariables } from "../../utils/fontLoader";
import { ColorPickerField } from "../../fields/ColorPickerField";

const getClassName = getClassNameFactory("Text", styles);

export type TextBlockPropsInner = {
  text: string;
  textColor?: string;
  size: "s" | "m";
  align: "left" | "center" | "right";
  color: "default" | "muted";
  maxWidth?: number;
  fontFamily?: string;
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
    text: {
      type: "textarea",
      label: "Text",
      contentEditable: true,
    },
    fontFamily: fontFamilyField,
    textColor: {
      type: "custom",
      label: "Text Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} />
      ),
    },
    size: {
      type: "radio",
      options: [
        { label: "S", value: "s" },
        { label: "M", value: "m" },
      ],
      labelIcon: <ALargeSmall size={16} />,
    },
    align: {
      type: "radio",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
      labelIcon: <AlignLeft size={16} />,
    },
    color: {
      type: "radio",
      options: [
        { label: "Default", value: "default" },
        { label: "Muted", value: "muted" },
      ],
    },
    maxWidth: {
      type: "number",
      label: "Max Width",
    },
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange }) => (
        <TranslationsField
          value={value as TranslationMap}
          onChange={onChange}
          translatableFields={[{ name: "text", type: "textarea", label: "Text" }]}
        />
      ),
    },
  },
  defaultProps: {
    text: "Text",
    textColor: "#000000",
    size: "m",
    align: "left",
    color: "default",
    maxWidth: undefined,
    fontFamily: "",
    translations: {},
  },
  render: ({ text, textColor, size, align, color, maxWidth, fontFamily, translations }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    const displayText = translations?.[previewLanguage]?.text || text;

    const fontSize = size === "m" ? "20px" : "16px";
    const colorValue = textColor || (color === "muted" ? "var(--puck-color-grey-05)" : "inherit");

    const fontVars = getFontFamilyVariables(fontFamily);

    return (
      <Section>
        <p
          className={`${getClassName()} puck-font-scope`}
          style={{
            fontSize,
            textAlign: align,
            color: colorValue,
            maxWidth: maxWidth ? `${maxWidth}px` : undefined,
            ...fontVars,
          }}
        >
          {displayText}
        </p>
      </Section>
    );
  },
};

export const TextBlock = withLayout(TextBlockInternal);
