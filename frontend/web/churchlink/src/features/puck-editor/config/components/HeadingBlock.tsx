import React from "react";
import type { ComponentConfig } from "@puckeditor/core";
import { usePuck } from "@puckeditor/core";
import styles from "../../styles/components/Heading.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { Section } from "../shared/Section";
import { withLayout, type WithLayout } from "../shared/Layout";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import { getTranslation, type TranslationMap } from "../../utils/languageUtils";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import { extractComponentId } from "../../utils/puckFieldUtils";
import { findComponentRecursive, updateComponentRecursive } from "../../utils/puckDataUtils";
import { GroupedFieldsPanel } from "../../fields/grouped/GroupedFieldsPanel";
import { headingBlockGroups } from "../../fields/grouped/componentConfigs/headingBlock";
import { getShadowStyle, type ShadowPreset } from "../../utils/shadowPresets";

const getClassName = getClassNameFactory("Heading", styles);

type HeadingBlockPropsInner = {
  text: string;
  typography?: { fontFamily?: string; color?: string };
  size: "xxxl" | "xxl" | "xl" | "l" | "m" | "s" | "xs";
  level: "none" | "" | "1" | "2" | "3" | "4" | "5" | "6";
  align: "left" | "center" | "right";
  shadow?: ShadowPreset;
  translations?: TranslationMap;
};

export type HeadingBlockProps = WithLayout<HeadingBlockPropsInner>;

const HeadingBlockInternal: ComponentConfig<HeadingBlockPropsInner> = {
  label: "Heading",
  fields: {
    text: {
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
            config={headingBlockGroups}
          />
        );
      },
    } as any,
  } as any,
  defaultProps: {
    align: "left",
    text: "Heading",
    typography: { fontFamily: "", color: "#000000" },
    size: "m",
    level: "",
    shadow: "none",
    translations: {},
  },
  render: ({ align, text, typography, size, level, shadow, translations }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    const displayText = getTranslation(translations, previewLanguage, "text") || text;

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

    const Tag = level && level !== "none" ? (`h${level}` as const) : ("div" as const);

    const fontStyles = getFontFamilyStyle(typography?.fontFamily);

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
              color: typography?.color || undefined,
              whiteSpace: "pre-wrap",
              ...sizeStyles[size],
              ...fontStyles,
              ...(shadow && getShadowStyle(shadow as ShadowPreset)),
            },
          },
          displayText
        )}
      </Section>
    );
  },
};

export const HeadingBlock = withLayout(HeadingBlockInternal);
