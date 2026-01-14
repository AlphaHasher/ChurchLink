import type { ComponentConfig } from "@puckeditor/core";
import { usePuck } from "@puckeditor/core";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import { getTranslation, type TranslationMap } from "../../utils/languageUtils";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import { buttonDefaults } from "../shared/fieldConfigs";
import { CompoundButton } from "../../components/compound/CompoundButton";
import { cn } from "@/lib/utils";
import { extractComponentId } from "../../utils/puckFieldUtils";
import { findComponentRecursive, updateComponentRecursive } from "../../utils/puckDataUtils";
import { GroupedFieldsPanel } from "../../fields/grouped/GroupedFieldsPanel";
import { buttonBlockGroups } from "../../fields/grouped/componentConfigs/buttonBlock";

type ButtonItem = {
  label: string;
  url: string;
  variant: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  size: "default" | "sm" | "lg" | "icon";
  icon: string;
  fontFamily?: string;
  labelColor?: string;
  backgroundColor?: string;
};

export type ButtonBlockPropsInner = {
  buttons: ButtonItem[];
  align: "left" | "center" | "right";
  translations?: TranslationMap;
};

export type ButtonBlockProps = ButtonBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const ButtonBlockInternal: ComponentConfig<ButtonBlockPropsInner> = {
  label: "Button",
  fields: {
    buttons: {
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
            config={buttonBlockGroups}
          />
        );
      },
    } as any,
  } as any,
  defaultProps: {
    buttons: [{ ...buttonDefaults, label: "Button", fontFamily: "", labelColor: "", backgroundColor: "" }],
    align: "left",
    translations: {},
  },
  render: ({ buttons, align, translations, puck }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    return (
      <Section>
        <div className={cn(
          "flex flex-row gap-4 items-center flex-wrap",
          { "justify-center": align === "center" },
          { "justify-end": align === "right" }
        )}>
          {buttons
            ?.filter((button) => !!button.label)
            .map((button, i) => {
              const labelKey = `buttons.${i}.label`;
              const displayLabel =
                getTranslation(translations, previewLanguage, labelKey) || button.label;

              const fontStyles = getFontFamilyStyle(button.fontFamily);

              return (
                <CompoundButton
                  key={i}
                  label={displayLabel}
                  url={button.url}
                  variant={button.variant}
                  size={button.size}
                  icon={button.icon}
                  isEditing={puck.isEditing}
                  fontVars={fontStyles}
                  labelColor={button.labelColor}
                  backgroundColor={button.backgroundColor}
                />
              );
            })}
        </div>
      </Section>
    );
  },
};

export const ButtonBlock = withLayout(ButtonBlockInternal);
