import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import styles from "../../styles/components/Cta.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";
import { fontFamilyField } from "../shared/fontField";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import { ColorPickerField } from "../../fields/ColorPickerField";
import {
  headingField,
  descriptionField,
  badgeField,
  badgeDefaults,
  buttonsField,
  buttonDefaults,
  paddingField,
  paddingDefaults,
  getPaddingValue,
} from "../shared/fieldConfigs";
import { Badge } from "@/shared/components/ui/badge";
import { CompoundButton } from "../../components/compound/CompoundButton";

const getClassName = getClassNameFactory("Cta", styles);

type ButtonItem = {
  label: string;
  url: string;
  variant: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  size: "default" | "sm" | "lg" | "icon";
  icon: string;
};

export type CtaBlockPropsInner = {
  heading: string;
  headingFont?: string;
  headingColor?: string;
  description: string;
  descriptionFont?: string;
  descriptionColor?: string;
  badge?: {
    label: string;
    url: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  };
  buttons: ButtonItem[];
  buttonFont?: string;
  displayLayout: "contained" | "full-bleed";
  padding: {
    top: string;
    bottom: string;
  };
  translations?: TranslationMap;
};

export type CtaBlockProps = CtaBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const CtaBlockInternal: ComponentConfig<CtaBlockPropsInner> = {
  label: "Call to Action",
  fields: {
    heading: headingField,
    headingFont: fontFamilyField,
    headingColor: {
      type: "custom",
      label: "Heading Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} />
      ),
    },
    description: descriptionField,
    descriptionFont: fontFamilyField,
    descriptionColor: {
      type: "custom",
      label: "Description Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} />
      ),
    },
    badge: badgeField,
    buttons: buttonsField,
    buttonFont: fontFamilyField,
    displayLayout: {
      type: "select",
      label: "Display Layout",
      options: [
        { label: "Contained", value: "contained" },
        { label: "Full Bleed", value: "full-bleed" },
      ],
    },
    padding: paddingField,
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange, field }) => {
        const buttons = (field as unknown as { value?: ButtonItem[] })?.value || [];
        const translatableFields = [
          { name: "heading", type: "text" as const, label: "Heading" },
          { name: "description", type: "textarea" as const, label: "Description" },
          { name: "badge.label", type: "text" as const, label: "Badge Label" },
          ...buttons.flatMap((_, index) => [
            {
              name: `buttons.${index}.label`,
              type: "text" as const,
              label: `Button ${index + 1} Label`,
            },
          ]),
        ];

        return (
          <TranslationsField
            value={value as TranslationMap}
            onChange={onChange}
            translatableFields={translatableFields}
          />
        );
      },
    },
  },
  defaultProps: {
    heading: "Ready to get started?",
    headingFont: "",
    headingColor: "#000000",
    description: "Join thousands of users who are already using our platform.",
    descriptionFont: "",
    descriptionColor: "#000000",
    badge: badgeDefaults,
    buttons: [
      { ...buttonDefaults, label: "Get Started" },
      { ...buttonDefaults, label: "Learn More", variant: "outline" },
    ],
    buttonFont: "",
    displayLayout: "contained",
    padding: paddingDefaults,
    translations: {},
  },
  render: ({
    heading,
    headingFont,
    headingColor,
    description,
    descriptionFont,
    descriptionColor,
    badge,
    buttons,
    buttonFont,
    displayLayout,
    padding,
    translations,
    puck,
  }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    const displayHeading = translations?.[previewLanguage]?.heading || heading;
    const displayDescription = translations?.[previewLanguage]?.description || description;
    const displayBadgeLabel = translations?.[previewLanguage]?.["badge.label"] || badge?.label || "";

    const headingFontStyles = getFontFamilyStyle(headingFont);
    const descriptionFontStyles = getFontFamilyStyle(descriptionFont);
    const buttonFontStyles = getFontFamilyStyle(buttonFont);

    return (
      <Section
        className={getClassName(displayLayout === "full-bleed" ? "Cta--fullBleed" : "Cta")}
        style={{
          paddingTop: getPaddingValue(padding.top),
          paddingBottom: getPaddingValue(padding.bottom),
        }}
      >
        <div className={getClassName(displayLayout === "contained" ? "content--contained" : "content")}>
          {badge?.label && (
            <Badge variant={badge.variant} asChild={!puck.isEditing && !!badge.url}>
              {!puck.isEditing && badge.url ? (
                <a href={badge.url}>{displayBadgeLabel}</a>
              ) : (
                <span>{displayBadgeLabel}</span>
              )}
            </Badge>
          )}
          <h2 style={{ ...headingFontStyles, color: headingColor || undefined }}>
            {displayHeading}
          </h2>
          <p style={{ ...descriptionFontStyles, color: descriptionColor || undefined }}>
            {displayDescription}
          </p>
          {buttons && buttons.length > 0 && (
            <div className={getClassName("buttons")}>
              {buttons.map((button, i) => {
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
                    fontVars={buttonFontStyles}
                  />
                );
              })}
            </div>
          )}
        </div>
      </Section>
    );
  },
};

export const CtaBlock = withLayout(CtaBlockInternal);
