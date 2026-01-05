import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import styles from "../../styles/components/Bento.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";
import { fontFamilyField } from "../shared/fontField";
import { getFontFamilyVariables } from "../../utils/fontLoader";
import {
  headingField,
  descriptionField,
  iconField,
  buttonField,
  buttonDefaults,
  paddingField,
  paddingDefaults,
  getPaddingValue,
} from "../shared/fieldConfigs";
import { CompoundIcon } from "../../components/compound/CompoundIcon";
import { CompoundButton } from "../../components/compound/CompoundButton";

const getClassName = getClassNameFactory("Bento", styles);

type CardItem = {
  icon: string;
  heading: string;
  description: string;
  button: {
    label: string;
    url: string;
    variant: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
    size: "default" | "sm" | "lg" | "icon";
    icon: string;
  };
};

export type BentoBlockPropsInner = {
  heading?: string;
  headingFont?: string;
  description?: string;
  descriptionFont?: string;
  cards: CardItem[];
  padding: {
    top: string;
    bottom: string;
  };
  translations?: TranslationMap;
};

export type BentoBlockProps = BentoBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const BentoBlockInternal: ComponentConfig<BentoBlockPropsInner> = {
  label: "Bento Grid",
  fields: {
    heading: headingField,
    headingFont: fontFamilyField,
    description: descriptionField,
    descriptionFont: fontFamilyField,
    cards: {
      type: "array",
      min: 1,
      max: 4,
      getItemSummary: (item, index = 0) => item.heading || `Card ${index + 1}`,
      arrayFields: {
        icon: iconField,
        heading: { type: "text", contentEditable: true },
        description: { type: "textarea", contentEditable: true },
        button: buttonField,
      },
      defaultItemProps: {
        icon: "activity",
        heading: "Heading",
        description: "Description of the feature or service.",
        button: buttonDefaults,
      },
    },
    padding: paddingField,
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange, field }) => {
        const cards = (field as unknown as { value?: CardItem[] })?.value || [];
        const translatableFields = [
          { name: "heading", type: "text" as const, label: "Heading" },
          { name: "description", type: "textarea" as const, label: "Description" },
          ...cards.flatMap((_, index) => [
            {
              name: `cards.${index}.heading`,
              type: "text" as const,
              label: `Card ${index + 1} Heading`,
            },
            {
              name: `cards.${index}.description`,
              type: "textarea" as const,
              label: `Card ${index + 1} Description`,
            },
            {
              name: `cards.${index}.button.label`,
              type: "text" as const,
              label: `Card ${index + 1} Button Label`,
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
    heading: "Powerful features",
    headingFont: "",
    description: "Everything you need in one place.",
    descriptionFont: "",
    cards: [
      {
        icon: "activity",
        heading: "Analytics",
        description: "Track your performance with detailed analytics.",
        button: buttonDefaults,
      },
    ],
    padding: paddingDefaults,
    translations: {},
  },
  render: ({
    heading,
    headingFont,
    description,
    descriptionFont,
    cards,
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

    const headingFontVars = getFontFamilyVariables(headingFont);
    const descriptionFontVars = getFontFamilyVariables(descriptionFont);

    return (
      <Section
        className={getClassName()}
        style={{
          paddingTop: getPaddingValue(padding.top),
          paddingBottom: getPaddingValue(padding.bottom),
        }}
      >
        <div className={getClassName("container")}>
          {/* Header section */}
          {(heading || description) && (
            <div className={getClassName("header")}>
              {heading && (
                <h2 className="puck-font-scope" style={headingFontVars}>
                  {displayHeading}
                </h2>
              )}
              {description && (
                <p className="puck-font-scope" style={descriptionFontVars}>
                  {displayDescription}
                </p>
              )}
            </div>
          )}

          {/* Bento Grid */}
          <div className={getClassName("grid")}>
            {cards.map((card, index) => {
              const headingKey = `cards.${index}.heading`;
              const descKey = `cards.${index}.description`;
              const buttonLabelKey = `cards.${index}.button.label`;

              const displayCardHeading =
                translations?.[previewLanguage]?.[headingKey] || card.heading;
              const displayCardDesc =
                translations?.[previewLanguage]?.[descKey] || card.description;
              const displayButtonLabel =
                translations?.[previewLanguage]?.[buttonLabelKey] || card.button.label;

              return (
                <div
                  key={index}
                  className={getClassName(
                    index === 0 ? "card--card0" :
                    index === 1 ? "card--card1" :
                    index === 2 ? "card--card2" :
                    index === 3 ? "card--card3" : "card"
                  )}
                >
                  <CompoundIcon icon={card.icon} size={32} className={getClassName("cardIcon")} />
                  <div className={getClassName("cardContent")}>
                    <h3 className={getClassName("cardHeading")}>{displayCardHeading}</h3>
                    <p className={getClassName("cardDescription")}>{displayCardDesc}</p>
                  </div>
                  {card.button.label && (
                    <CompoundButton
                      label={displayButtonLabel}
                      url={card.button.url}
                      variant={card.button.variant}
                      size={card.button.size}
                      icon={card.button.icon}
                      isEditing={puck.isEditing}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Section>
    );
  },
};

export const BentoBlock = withLayout(BentoBlockInternal);
