import type { ComponentConfig } from "@puckeditor/core";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import styles from "../../styles/components/Text.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import { getShadowStyle, shadowPresetLabels, type ShadowPreset } from "../../utils/shadowPresets";
import { FontFamilyField } from "../../fields/FontFamilyField";
import { ColorPickerField } from "../../fields/ColorPickerField";
import { TranslationsField } from "../../fields/TranslationsField";
import type { TranslationMap } from "../../utils/languageUtils";

const getClassName = getClassNameFactory("Text", styles);

const FONT_SIZE_MAP: Record<string, string> = {
  h1: "3rem",
  h2: "2.5rem",
  h3: "2rem",
  h4: "1.5rem",
  h5: "1.25rem",
  h6: "1rem",
  p: "1rem",
};

export type TextBlockPropsInner = {
  content: string;           // HTML from richtext field
  level: "p" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
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
      type: "richtext",
      label: "Content",
    },
    level: {
      type: "select",
      label: "Element Type",
      options: [
        { label: "Paragraph", value: "p" },
        { label: "Heading 1 (H1)", value: "h1" },
        { label: "Heading 2 (H2)", value: "h2" },
        { label: "Heading 3 (H3)", value: "h3" },
        { label: "Heading 4 (H4)", value: "h4" },
        { label: "Heading 5 (H5)", value: "h5" },
        { label: "Heading 6 (H6)", value: "h6" },
      ],
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
            { name: "content", type: "textarea", label: "Content" },
          ]}
        />
      ),
    },
  },
  defaultProps: {
    content: "Enter your text here...",
    level: "p",
    typography: { fontFamily: "", color: "" },
    shadow: "none",
    maxWidth: undefined,
    translations: {},
  },
  render: ({ content, level, typography, shadow, maxWidth }) => {
    const isHeading = level !== "p";

    return (
      <Section>
        <div
          className={getClassName()}
          role={isHeading ? "heading" : undefined}
          aria-level={isHeading ? parseInt(level.charAt(1)) : undefined}
          style={{
            fontSize: FONT_SIZE_MAP[level],
            color: typography?.color || "inherit",
            maxWidth: maxWidth ? `${maxWidth}px` : undefined,
            fontWeight: isHeading ? "bold" : undefined,
            ...getFontFamilyStyle(typography?.fontFamily),
            ...(shadow && shadow !== "none" ? getShadowStyle(shadow) : {}),
          }}
        >
          {content}
        </div>
      </Section>
    );
  },
};

export const TextBlock = withLayout(TextBlockInternal);
