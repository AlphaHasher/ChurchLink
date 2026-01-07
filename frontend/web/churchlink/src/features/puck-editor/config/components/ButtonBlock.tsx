import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";
import { fontFamilyField } from "../shared/fontField";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import { ColorPickerField } from "../../fields/ColorPickerField";
import { buttonsField, buttonDefaults } from "../shared/fieldConfigs";
import { CompoundButton } from "../../components/compound/CompoundButton";
import { cn } from "@/lib/utils";

type ButtonItem = {
  label: string;
  url: string;
  variant: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  size: "default" | "sm" | "lg" | "icon";
  icon: string;
};

export type ButtonBlockPropsInner = {
  buttons: ButtonItem[];
  align: "left" | "center" | "right";
  labelColor?: string;
  backgroundColor?: string;
  fontFamily?: string;
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
    buttons: buttonsField,
    align: {
      type: "radio",
      label: "Alignment",
      options: [
        { label: "Left", value: "left" },
        { label: "Center", value: "center" },
        { label: "Right", value: "right" },
      ],
    },
    fontFamily: fontFamilyField,
    labelColor: {
      type: "custom",
      label: "Label Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} />
      ),
    },
    backgroundColor: {
      type: "custom",
      label: "Background Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} />
      ),
    },
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange }) => (
        <TranslationsField
          value={value as TranslationMap}
          onChange={onChange}
          translatableFields={[
            { name: "buttons.0.label", type: "text", label: "Button 1" },
            { name: "buttons.1.label", type: "text", label: "Button 2" },
            { name: "buttons.2.label", type: "text", label: "Button 3" },
          ]}
        />
      ),
    },
  },
  defaultProps: {
    buttons: [{ ...buttonDefaults, label: "Button" }],
    align: "left",
    labelColor: "",
    backgroundColor: "",
    fontFamily: "",
    translations: {},
  },
  render: ({ buttons, align, labelColor, backgroundColor, fontFamily, translations, puck }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    const fontStyles = getFontFamilyStyle(fontFamily);

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
                translations?.[previewLanguage]?.[labelKey] || button.label;

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
                  labelColor={labelColor}
                  backgroundColor={backgroundColor}
                />
              );
            })}
        </div>
      </Section>
    );
  },
};

export const ButtonBlock = withLayout(ButtonBlockInternal);
