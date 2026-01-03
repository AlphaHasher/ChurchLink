import React from "react";
import type { ComponentConfig } from "@measured/puck";
import styles from "../../styles/components/Heading.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { Section } from "../shared/Section";
import { withLayout, type WithLayout } from "../shared/Layout";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";

const getClassName = getClassNameFactory("Heading", styles);

const sizeOptions = [
  { value: "xxxl", label: "XXXL" },
  { value: "xxl", label: "XXL" },
  { value: "xl", label: "XL" },
  { value: "l", label: "L" },
  { value: "m", label: "M" },
  { value: "s", label: "S" },
  { value: "xs", label: "XS" },
];

const levelOptions = [
  { label: "", value: "" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4", value: "4" },
  { label: "5", value: "5" },
  { label: "6", value: "6" },
];

type HeadingBlockPropsInner = {
  text: string;
  size: "xxxl" | "xxl" | "xl" | "l" | "m" | "s" | "xs";
  level: "" | "1" | "2" | "3" | "4" | "5" | "6";
  align: "left" | "center" | "right";
  translations?: TranslationMap;
};

export type HeadingBlockProps = WithLayout<HeadingBlockPropsInner>;

const HeadingBlockInternal: ComponentConfig<HeadingBlockPropsInner> = {
  label: "Heading",
  fields: {
    text: {
      type: "textarea",
      label: "Text",
      contentEditable: true,
    },
    size: {
      type: "select",
      label: "Size",
      options: sizeOptions,
    },
    level: {
      type: "select",
      label: "Level",
      options: levelOptions,
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
    align: "left",
    text: "Heading",
    size: "m",
    level: "",
    translations: {},
  },
  render: ({ align, text, size, level, translations }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    const displayText = translations?.[previewLanguage]?.text || text;

    // Size mapping to actual CSS values
    const sizeStyles: Record<string, React.CSSProperties> = {
      xxxl: { fontSize: "4rem", lineHeight: 1.1 },
      xxl: { fontSize: "3rem", lineHeight: 1.1 },
      xl: { fontSize: "2.5rem", lineHeight: 1.2 },
      l: { fontSize: "2rem", lineHeight: 1.2 },
      m: { fontSize: "1.5rem", lineHeight: 1.3 },
      s: { fontSize: "1.25rem", lineHeight: 1.4 },
      xs: { fontSize: "1rem", lineHeight: 1.5 },
    };

    const Tag = level ? (`h${level}` as const) : ("div" as const);

    return (
      <Section>
        {React.createElement(
          Tag,
          {
            className: getClassName(),
            style: {
              display: "block",
              textAlign: align,
              width: "100%",
              ...sizeStyles[size],
            },
          },
          displayText
        )}
      </Section>
    );
  },
};

export const HeadingBlock = withLayout(HeadingBlockInternal);
