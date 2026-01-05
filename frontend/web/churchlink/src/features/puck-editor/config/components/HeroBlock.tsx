"use client";

import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
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
import { Badge } from "@/shared/components/ui/badge";
import { CompoundButton } from "../../components/compound/CompoundButton";
import { CompoundIcon } from "../../components/compound/CompoundIcon";
import { CompoundImage } from "../../components/compound/CompoundImage";
import { cn } from "@/lib/utils";

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

export type HeroBlockPropsInner = {
  badge?: {
    label: string;
    url: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  };
  heading: string;
  headingFont?: string;
  description: string;
  descriptionFont?: string;
  features: FeatureItem[];
  buttons: ButtonItem[];
  buttonFont?: string;
  images: ImageItem[];
  imageLayout: "none" | "1x1" | "1x1-9x16-1x1" | "16x9";
  imageAspectRatio?: "16x9" | "1x1" | "9x16";
  contentAlign: "center" | "left";
  padding: {
    top: string;
    bottom: string;
  };
  translations?: TranslationMap;
};

export type HeroBlockProps = HeroBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const HeroBlockInternal: ComponentConfig<HeroBlockPropsInner> = {
  label: "Hero",
  fields: {
    badge: badgeField,
    heading: headingField,
    headingFont: fontFamilyField,
    description: descriptionField,
    descriptionFont: fontFamilyField,
    features: featuresField,
    buttons: buttonsField,
    buttonFont: fontFamilyField,
    images: imagesField,
    imageLayout: {
      type: "select",
      label: "Image Layout",
      options: [
        { label: "None", value: "none" },
        { label: "Single Square (1x1)", value: "1x1" },
        { label: "Three Image Cluster (1x1-9x16-1x1)", value: "1x1-9x16-1x1" },
        { label: "Wide Banner (16x9)", value: "16x9" },
      ],
    },
    imageAspectRatio: {
      type: "select",
      label: "Image Aspect Ratio",
      options: [
        { label: "16:9 (Landscape)", value: "16x9" },
        { label: "1:1 (Square)", value: "1x1" },
        { label: "9:16 (Portrait)", value: "9x16" },
      ],
    },
    contentAlign: {
      type: "select",
      label: "Content Alignment",
      options: [
        { label: "Center", value: "center" },
        { label: "Left", value: "left" },
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
    badge: badgeDefaults,
    heading: "Build something amazing",
    headingFont: "",
    description: "Create beautiful websites with our powerful page builder",
    descriptionFont: "",
    features: [],
    buttons: [
      { ...buttonDefaults, label: "Get Started" },
      { ...buttonDefaults, label: "Learn More", variant: "outline" },
    ],
    buttonFont: "",
    images: [imageDefaults],
    imageLayout: "1x1",
    imageAspectRatio: "16x9",
    contentAlign: "center",
    padding: paddingDefaults,
    translations: {},
  },
  render: ({
    badge,
    heading,
    headingFont,
    description,
    descriptionFont,
    features,
    buttons,
    buttonFont,
    images,
    imageLayout,
    imageAspectRatio,
    contentAlign,
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

    const hasImages = Array.isArray(images) && images.length > 0 && imageLayout !== "none";
    const isTwoColumnLayout = imageLayout === "1x1" || imageLayout === "1x1-9x16-1x1";
    const isCentered = contentAlign === "center" && !isTwoColumnLayout;

    return (
      <Section
        style={{
          paddingTop: getPaddingValue(padding.top),
          paddingBottom: getPaddingValue(padding.bottom),
        }}
      >
        <div
          className={cn("items-center gap-8", {
            "flex flex-col justify-center text-center": isCentered,
            "grid grid-cols-1 items-center lg:grid-cols-2 text-start":
              isTwoColumnLayout,
            "flex flex-col gap-10": !isCentered && !isTwoColumnLayout,
          })}
        >
          {/* Content Section */}
          <div className={isTwoColumnLayout ? "flex flex-col gap-10" : undefined}>
            <div className="flex gap-4 flex-col">
              {badge?.label && (
                <div className={isCentered ? "flex justify-center" : undefined}>
                  <Badge variant={badge.variant} asChild={!puck.isEditing && !!badge.url}>
                    {!puck.isEditing && badge.url ? (
                      <a href={badge.url}>{displayBadgeLabel}</a>
                    ) : (
                      <span>{displayBadgeLabel}</span>
                    )}
                  </Badge>
                </div>
              )}

              <h1
                className={cn(
                  "text-5xl md:text-7xl tracking-tighter font-regular puck-font-scope",
                  {
                    "max-w-2xl": isCentered,
                    "lg:max-w-lg": isTwoColumnLayout,
                  }
                )}
                style={headingFontVars}
              >
                {displayHeading}
              </h1>

              {description && (
                <p
                  className={cn(
                    "text-lg md:text-xl leading-relaxed tracking-tight text-muted-foreground puck-font-scope",
                    {
                      "max-w-2xl": isCentered,
                      "lg:max-w-md": isTwoColumnLayout,
                    }
                  )}
                  style={descriptionFontVars}
                >
                  {displayDescription}
                </p>
              )}

              {features && features.length > 0 && (
                <div className="flex flex-col gap-4 mt-2">
                  {features.map((feature, index) => {
                    const nameKey = `features.${index}.name`;
                    const descKey = `features.${index}.description`;

                    const displayName =
                      translations?.[previewLanguage]?.[nameKey] || feature.name;
                    const displayDesc =
                      translations?.[previewLanguage]?.[descKey] || feature.description;

                    return (
                      <div key={index} className="flex gap-3 items-start">
                        <CompoundIcon
                          icon={feature.icon}
                          size={20}
                          className="text-primary mt-0.5 shrink-0"
                        />
                        <div>
                          <div className="font-semibold text-base">{displayName}</div>
                          <div className="text-muted-foreground text-sm">{displayDesc}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {buttons && buttons.length > 0 && (
              <div className={cn("flex flex-row gap-4 items-center", { "justify-center": isCentered })}>
                {buttons
                  .filter((button) => !!button.label)
                  .map((button, i) => {
                    const labelKey = `buttons.${i}.label`;
                    const displayLabel =
                      translations?.[previewLanguage]?.[labelKey] || button.label;

                    return (
                      <div key={i} className="flex-shrink-0">
                        <CompoundButton
                          label={displayLabel}
                          url={button.url}
                          variant={button.variant}
                          size={button.size}
                          icon={button.icon}
                          isEditing={puck.isEditing}
                          fontVars={buttonFontVars}
                        />
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* Images Section */}
          {imageLayout === "16x9" && hasImages && (
            <ImageSingle src={images[0].src} alt={images[0].alt} aspectRatio="16x9" />
          )}
          {imageLayout === "1x1" && hasImages && (
            <ImageSingle src={images[0].src} alt={images[0].alt} aspectRatio={imageAspectRatio} />
          )}
          {imageLayout === "1x1-9x16-1x1" && hasImages && (
            <ImageCluster images={images} />
          )}
        </div>
      </Section>
    );
  },
};

const ImageSingle = ({
  src,
  alt,
  aspectRatio,
}: {
  src: string;
  alt: string;
  aspectRatio?: "16x9" | "1x1" | "9x16";
}) => {
  return (
    <div className="w-full">
      <div
        className={cn("bg-muted rounded-md", {
          "aspect-video": aspectRatio === "16x9" || !aspectRatio,
          "aspect-square": aspectRatio === "1x1",
          "aspect-[9/16]": aspectRatio === "9x16",
        })}
      >
        {src ? <CompoundImage src={src} alt={alt} className="h-full" /> : null}
      </div>
    </div>
  );
};

const ImageCluster = ({ images }: { images: ImageItem[] }) => {
  if (!images || images.length === 0) {
    return null;
  }

  const [image1, image2, image3] = images;

  return (
    <div className="grid grid-cols-2 gap-8">
      <div className="bg-muted rounded-md aspect-square">
        {image1?.src ? (
          <CompoundImage src={image1.src} alt={image1.alt} className="h-full" />
        ) : null}
      </div>
      <div className="bg-muted rounded-md row-span-2">
        {image2?.src ? (
          <CompoundImage src={image2.src} alt={image2.alt} className="h-full" />
        ) : null}
      </div>
      <div className="bg-muted rounded-md aspect-square">
        {image3?.src ? (
          <CompoundImage src={image3.src} alt={image3.alt} className="h-full" />
        ) : null}
      </div>
    </div>
  );
};

export const HeroBlock = withLayout(HeroBlockInternal);
