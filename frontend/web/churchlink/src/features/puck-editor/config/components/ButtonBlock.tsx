import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";
import { Button } from "@/shared/components/ui/button";
import { fontFamilyField } from "../shared/fontField";
import { getFontFamilyVariables } from "../../utils/fontLoader";
import { ColorPickerField } from "../../fields/ColorPickerField";

export type ButtonBlockPropsInner = {
  label: string;
  labelColor?: string;
  href: string;
  variant: "default" | "secondary";
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
    label: {
      type: "text",
      placeholder: "Button text...",
      contentEditable: true,
    },
    fontFamily: fontFamilyField,
    labelColor: {
      type: "custom",
      label: "Label Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} />
      ),
    },
    href: { type: "text", label: "Link URL" },
    variant: {
      type: "radio",
      options: [
        { label: "Primary", value: "default" },
        { label: "Secondary", value: "secondary" },
      ],
    },
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange }) => (
        <TranslationsField
          value={value as TranslationMap}
          onChange={onChange}
          translatableFields={[{ name: "label", type: "text", label: "Button Text" }]}
        />
      ),
    },
  },
  defaultProps: {
    label: "Button",
    labelColor: "#000000",
    href: "#",
    variant: "default",
    fontFamily: "",
    translations: {},
  },
  render: ({ href, variant, label, labelColor, fontFamily, translations, puck }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    const displayLabel = translations?.[previewLanguage]?.label || label;

    const fontVars = getFontFamilyVariables(fontFamily);

    return (
      <Section>
        <div>
          <Button
            asChild
            variant={variant}
            size="lg"
            tabIndex={puck.isEditing ? -1 : undefined}
          >
            <a
              href={puck.isEditing ? "#" : href}
              className="puck-font-scope"
              style={{
                ...fontVars,
                color: labelColor || undefined,
              }}
            >
              {displayLabel}
            </a>
          </Button>
        </div>
      </Section>
    );
  },
};

export const ButtonBlock = withLayout(ButtonBlockInternal);
