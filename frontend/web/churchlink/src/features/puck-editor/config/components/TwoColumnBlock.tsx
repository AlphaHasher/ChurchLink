import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import styles from "../../styles/components/TwoColumn.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";
import { fontFamilyField } from "../shared/fontField";
import { getFontFamilyVariables } from "../../utils/fontLoader";
import {
  headingField,
  descriptionField,
  badgeField,
  badgeDefaults,
  buttonsField,
  buttonDefaults,
  featuresField,
  imagesField,
  imageDefaults,
  paddingField,
  paddingDefaults,
  getPaddingValue,
} from "../shared/fieldConfigs";
import { CompoundBadge } from "../../components/compound/CompoundBadge";
import { CompoundButton } from "../../components/compound/CompoundButton";
import { CompoundIcon } from "../../components/compound/CompoundIcon";
import { CompoundImage } from "../../components/compound/CompoundImage";

const getClassName = getClassNameFactory("TwoColumn", styles);

type ButtonItem = {
  label: string;
  url: string;
  variant: "default" | "secondary" | "outline" | "ghost" | "link" | "destructive";
  size: "default" | "sm" | "lg" | "icon";
  icon: string;
};

type FeatureItem = {
  icon: string;
  name: string;
  description: string;
};

type ImageItem = {
  src: string;
  alt: string;
};

export type TwoColumnBlockPropsInner = {
  heading: string;
  headingFont?: string;
  description: string;
  descriptionFont?: string;
  badge?: {
    label: string;
    url: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  };
  features: FeatureItem[];
  buttons: ButtonItem[];
  buttonFont?: string;
  images: ImageItem[];
  imageAspectRatio: "16x9" | "1x1";
  imagePosition: "left" | "right";
  padding: {
    top: string;
    bottom: string;
  };
  translations?: TranslationMap;
};

export type TwoColumnBlockProps = TwoColumnBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const TwoColumnBlockInternal: ComponentConfig<TwoColumnBlockPropsInner> = {
  label: "Two Column",
  fields: {
    heading: headingField,
    headingFont: fontFamilyField,
    description: descriptionField,
    descriptionFont: fontFamilyField,
    badge: badgeField,
    features: featuresField,
    buttons: buttonsField,
    buttonFont: fontFamilyField,
    images: imagesField,
    imageAspectRatio: {
      type: "select",
      label: "Image Aspect Ratio",
      options: [
        { label: "16:9 (Landscape)", value: "16x9" },
        { label: "1:1 (Square)", value: "1x1" },
      ],
    },
    imagePosition: {
      type: "select",
      label: "Image Position",
      options: [
        { label: "Left", value: "left" },
        { label: "Right", value: "right" },
      ],
    },
    padding: paddingField,
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange, field }) => {
        const buttons = (field as unknown as { value?: ButtonItem[] })?.value || [];
        const features = (field as unknown as { value?: FeatureItem[] })?.value || [];
        const translatableFields = [
          { name: "heading", type: "text" as const, label: "Heading" },
          { name: "description", type: "textarea" as const, label: "Description" },
          { name: "badge.label", type: "text" as const, label: "Badge Label" },
          ...features.flatMap((_, index) => [
            {
              name: `features.${index}.name`,
              type: "text" as const,
              label: `Feature ${index + 1} Name`,
            },
            {
              name: `features.${index}.description`,
              type: "textarea" as const,
              label: `Feature ${index + 1} Description`,
            },
          ]),
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
    heading: "Powerful features for your workflow",
    headingFont: "",
    description: "Everything you need to get your work done faster and better.",
    descriptionFont: "",
    badge: badgeDefaults,
    features: [
      {
        icon: "check",
        name: "Feature name",
        description: "Description of the feature",
      },
    ],
    buttons: [buttonDefaults],
    buttonFont: "",
    images: [imageDefaults],
    imageAspectRatio: "16x9",
    imagePosition: "right",
    padding: paddingDefaults,
    translations: {},
  },
  render: ({
    heading,
    headingFont,
    description,
    descriptionFont,
    badge,
    features,
    buttons,
    buttonFont,
    images,
    imageAspectRatio,
    imagePosition,
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

    const headingFontVars = getFontFamilyVariables(headingFont);
    const descriptionFontVars = getFontFamilyVariables(descriptionFont);
    const buttonFontVars = getFontFamilyVariables(buttonFont);

    return (
      <Section
        className={getClassName()}
        style={{
          paddingTop: getPaddingValue(padding.top),
          paddingBottom: getPaddingValue(padding.bottom),
        }}
      >
        <div className={getClassName(imagePosition === "left" ? "container--reverse" : "container")}>
          {/* Content section */}
          <div className={getClassName("content")}>
            {badge?.label && (
              <CompoundBadge
                label={displayBadgeLabel}
                url={badge.url}
                variant={badge.variant}
                isEditing={puck.isEditing}
              />
            )}
            <h2 className="puck-font-scope" style={headingFontVars}>
              {displayHeading}
            </h2>
            <p className="puck-font-scope" style={descriptionFontVars}>
              {displayDescription}
            </p>

            {features && features.length > 0 && (
              <div className={getClassName("features")}>
                {features.map((feature, index) => {
                  const nameKey = `features.${index}.name`;
                  const descKey = `features.${index}.description`;

                  const displayName =
                    translations?.[previewLanguage]?.[nameKey] || feature.name;
                  const displayDesc =
                    translations?.[previewLanguage]?.[descKey] || feature.description;

                  return (
                    <div key={index} className={getClassName("feature")}>
                      <CompoundIcon
                        icon={feature.icon}
                        size={20}
                        className={getClassName("featureIcon")}
                      />
                      <div>
                        <div className={getClassName("featureName")}>{displayName}</div>
                        <div className={getClassName("featureDesc")}>{displayDesc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

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
                      fontVars={buttonFontVars}
                    />
                  );
                })}
              </div>
            )}
          </div>

          {/* Images section */}
          <div className={getClassName("images")}>
            {images.length === 1 ? (
              <CompoundImage
                src={images[0].src}
                alt={images[0].alt}
                aspectRatio={imageAspectRatio}
              />
            ) : (
              <div className={getClassName("imagesGrid")}>
                {images.map((image, index) => (
                  <CompoundImage
                    key={index}
                    src={image.src}
                    alt={image.alt}
                    aspectRatio={imageAspectRatio}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </Section>
    );
  },
};

export const TwoColumnBlock = withLayout(TwoColumnBlockInternal);
