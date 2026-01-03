import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";
import { Button } from "@/shared/components/ui/button";

export type ButtonBlockPropsInner = {
  label: string;
  href: string;
  variant: "default" | "secondary";
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
    href: "#",
    variant: "default",
    translations: {},
  },
  render: ({ href, variant, label, translations, puck }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    const displayLabel = translations?.[previewLanguage]?.label || label;

    return (
      <Section>
        <div>
          <Button
            asChild
            variant={variant}
            size="lg"
            tabIndex={puck.isEditing ? -1 : undefined}
          >
            <a href={puck.isEditing ? "#" : href}>{displayLabel}</a>
          </Button>
        </div>
      </Section>
    );
  },
};

export const ButtonBlock = withLayout(ButtonBlockInternal);
