import type { ComponentConfig } from "@puckeditor/core";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import { usePreviewLanguageSafe } from "../../context/PuckLanguageContext";
import { getTranslation, type TranslationMap } from "../../utils/languageUtils";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import { CompoundButton } from "../../components/compound/CompoundButton";
import { IconPickerField } from "../../fields/IconPickerField";
import { FontFamilyField } from "../../fields/FontFamilyField";
import { ColorPickerField } from "../../fields/ColorPickerField";
import { TranslationsField } from "../../fields/TranslationsField";
import { cn } from "@/lib/utils";

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
      type: "array",
      label: "Buttons",
      arrayFields: {
        label: {
          type: "text",
          label: "Label",
        },
        url: {
          type: "text",
          label: "URL",
        },
        variant: {
          type: "select",
          label: "Variant",
          options: [
            { label: "Default", value: "default" },
            { label: "Secondary", value: "secondary" },
            { label: "Outline", value: "outline" },
            { label: "Ghost", value: "ghost" },
            { label: "Link", value: "link" },
            { label: "Destructive", value: "destructive" },
          ],
        },
        size: {
          type: "select",
          label: "Size",
          options: [
            { label: "Default", value: "default" },
            { label: "Small", value: "sm" },
            { label: "Large", value: "lg" },
            { label: "Icon", value: "icon" },
          ],
        },
        icon: {
          type: "custom",
          label: "Icon",
          render: ({ value, onChange }) => (
            <IconPickerField value={value as string} onChange={onChange} />
          ),
        },
        fontFamily: {
          type: "custom",
          label: "Font Family",
          render: ({ value, onChange }) => (
            <FontFamilyField value={value as string} onChange={onChange} />
          ),
        },
        labelColor: {
          type: "custom",
          label: "Label Color",
          render: ({ value, onChange }) => (
            <ColorPickerField value={value as string} onChange={onChange} />
          ),
        },
        backgroundColor: {
          type: "custom",
          label: "Background Color",
          render: ({ value, onChange }) => (
            <ColorPickerField value={value as string} onChange={onChange} />
          ),
        },
      },
      getItemSummary: (item) => (item as ButtonItem).label || "Button",
      defaultItemProps: {
        label: "Button",
        url: "",
        variant: "default" as const,
        size: "default" as const,
        icon: "none",
        fontFamily: "",
        labelColor: "",
        backgroundColor: "",
      },
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
          translatableFields={[
            { name: "buttons.0.label", type: "text", label: "Button 1 Label" },
            { name: "buttons.1.label", type: "text", label: "Button 2 Label" },
            { name: "buttons.2.label", type: "text", label: "Button 3 Label" },
          ]}
        />
      ),
    },
  },
  defaultProps: {
    buttons: [
      {
        label: "Button",
        url: "",
        variant: "default",
        size: "default",
        icon: "none",
        fontFamily: "",
        labelColor: "",
        backgroundColor: "",
      },
    ],
    align: "left",
    translations: {},
  },
  render: ({ buttons, align, translations, puck }) => {
    const previewLanguage = usePreviewLanguageSafe();

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
