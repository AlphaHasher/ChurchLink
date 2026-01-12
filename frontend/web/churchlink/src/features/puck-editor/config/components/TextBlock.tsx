import type { ComponentConfig } from "@measured/puck";
import { usePuck } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import styles from "../../styles/components/Text.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import { getTranslation, type TranslationMap } from "../../utils/languageUtils";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import { extractComponentId } from "../../utils/puckFieldUtils";
import { findComponentRecursive, updateComponentRecursive } from "../../utils/puckDataUtils";
import { GroupedFieldsPanel } from "../../fields/grouped/GroupedFieldsPanel";
import { textBlockGroups } from "../../fields/grouped/componentConfigs/textBlock";

const getClassName = getClassNameFactory("Text", styles);

export type TextBlockPropsInner = {
  text: string;
  typography?: { fontFamily?: string; color?: string };
  size: "s" | "m";
  align: "left" | "center" | "right";
  color: "default" | "muted";
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
            config={textBlockGroups}
          />
        );
      },
    } as any,
  } as any,
  defaultProps: {
    text: "Text",
    typography: { fontFamily: "", color: "#000000" },
    size: "m",
    align: "left",
    color: "default",
    maxWidth: undefined,
    translations: {},
  },
  render: ({ text, typography, size, align, color, maxWidth, translations }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    const displayText = getTranslation(translations, previewLanguage, "text") || text;

    const fontSize = size === "m" ? "20px" : "16px";
    const colorValue = typography?.color || (color === "muted" ? "var(--puck-color-grey-05)" : "inherit");

    const fontStyles = getFontFamilyStyle(typography?.fontFamily);

    return (
      <Section>
        <p
          className={getClassName()}
          style={{
            fontSize,
            textAlign: align,
            color: colorValue,
            maxWidth: maxWidth ? `${maxWidth}px` : undefined,
            ...fontStyles,
          }}
        >
          {displayText}
        </p>
      </Section>
    );
  },
};

export const TextBlock = withLayout(TextBlockInternal);
