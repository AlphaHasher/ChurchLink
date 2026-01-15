"use client";

import type { ComponentConfig } from "@puckeditor/core";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import { getTranslation, type TranslationMap } from "../../utils/languageUtils";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import {
  badgeDefaults,
  buttonDefaults,
  imageDefaults,
  paddingDefaults,
  getPaddingValue,
} from "../shared/fieldConfigs";
import { Badge } from "@/shared/components/ui/badge";
import { CompoundButton } from "../../components/compound/CompoundButton";
import { CompoundIcon } from "../../components/compound/CompoundIcon";
import { CompoundImage } from "../../components/compound/CompoundImage";
import { FontFamilyField } from "../../fields/FontFamilyField";
import { ColorPickerField } from "../../fields/ColorPickerField";
import { IconPickerField } from "../../fields/IconPickerField";
import { TranslationsField } from "../../fields/TranslationsField";
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
  headingColor?: string;
  description: string;
  descriptionFont?: string;
  descriptionColor?: string;
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
    badge: {
      type: "object",
      objectFields: {
        label: { type: "text", label: "Label" },
        url: { type: "text", label: "URL" },
        variant: {
          type: "select",
          label: "Variant",
          options: [
            { label: "Default", value: "default" },
            { label: "Secondary", value: "secondary" },
            { label: "Destructive", value: "destructive" },
            { label: "Outline", value: "outline" },
          ],
        },
      },
    },
    heading: { type: "text", label: "Heading" },
    headingFont: {
      type: "custom",
      label: "Heading Font",
      render: ({ value, onChange }) => (
        <FontFamilyField value={value as string} onChange={onChange} />
      ),
    },
    headingColor: {
      type: "custom",
      label: "Heading Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value as string} onChange={onChange} />
      ),
    },
    description: { type: "textarea", label: "Description" },
    descriptionFont: {
      type: "custom",
      label: "Description Font",
      render: ({ value, onChange }) => (
        <FontFamilyField value={value as string} onChange={onChange} />
      ),
    },
    descriptionColor: {
      type: "custom",
      label: "Description Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value as string} onChange={onChange} />
      ),
    },
    features: {
      type: "array",
      label: "Features",
      max: 5,
      arrayFields: {
        icon: {
          type: "custom",
          label: "Icon",
          render: ({ value, onChange }) => (
            <IconPickerField value={value as string} onChange={onChange} />
          ),
        },
        name: { type: "text", label: "Title" },
        description: { type: "textarea", label: "Description" },
      },
      getItemSummary: (item) => (item as FeatureItem).name || "Feature",
      defaultItemProps: {
        icon: "check",
        name: "Feature name",
        description: "Description of the feature",
      },
    },
    buttons: {
      type: "array",
      label: "Buttons",
      max: 3,
      arrayFields: {
        label: { type: "text", label: "Label" },
        url: { type: "text", label: "URL" },
        variant: {
          type: "select",
          label: "Variant",
          options: [
            { label: "Default", value: "default" },
            { label: "Secondary", value: "secondary" },
            { label: "Outline", value: "outline" },
            { label: "Ghost", value: "ghost" },
          ],
        },
        size: {
          type: "select",
          label: "Size",
          options: [
            { label: "Default", value: "default" },
            { label: "Small", value: "sm" },
            { label: "Large", value: "lg" },
          ],
        },
        icon: {
          type: "custom",
          label: "Icon",
          render: ({ value, onChange }) => (
            <IconPickerField value={value as string} onChange={onChange} />
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
      },
    },
    buttonFont: {
      type: "custom",
      label: "Button Font",
      render: ({ value, onChange }) => (
        <FontFamilyField value={value as string} onChange={onChange} />
      ),
    },
    images: {
      type: "array",
      label: "Images",
      max: 10,
      arrayFields: {
        src: { type: "text", label: "Image URL" },
        alt: { type: "text", label: "Alt Text" },
      },
      getItemSummary: (item) => (item as ImageItem).alt || "Image",
      defaultItemProps: {
        src: "",
        alt: "Image description",
      },
    },
    imageLayout: {
      type: "select",
      label: "Image Layout",
      options: [
        { label: "None", value: "none" },
        { label: "Single Square (1x1)", value: "1x1" },
        { label: "Three Image Cluster", value: "1x1-9x16-1x1" },
        { label: "Wide Banner (16x9)", value: "16x9" },
      ],
    },
    imageAspectRatio: {
      type: "select",
      label: "Aspect Ratio",
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
    padding: {
      type: "object",
      objectFields: {
        top: {
          type: "select",
          label: "Top Padding",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "small" },
            { label: "Medium", value: "medium" },
            { label: "Large", value: "large" },
          ],
        },
        bottom: {
          type: "select",
          label: "Bottom Padding",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "small" },
            { label: "Medium", value: "medium" },
            { label: "Large", value: "large" },
          ],
        },
      },
    },
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange }) => (
        <TranslationsField
          value={value as TranslationMap}
          onChange={onChange}
          translatableFields={[
            { name: "badge.label", type: "text", label: "Badge Label" },
            { name: "heading", type: "text", label: "Heading" },
            { name: "description", type: "textarea", label: "Description" },
            { name: "features.0.name", type: "text", label: "Feature 1 Name" },
            { name: "features.0.description", type: "textarea", label: "Feature 1 Description" },
            { name: "buttons.0.label", type: "text", label: "Button 1 Label" },
            { name: "buttons.1.label", type: "text", label: "Button 2 Label" },
          ]}
        />
      ),
    },
  },
  defaultProps: {
    badge: badgeDefaults,
    heading: "Build something amazing",
    headingFont: "",
    headingColor: "#000000",
    description: "Create beautiful websites with our powerful page builder",
    descriptionFont: "",
    descriptionColor: "#000000",
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
    headingColor,
    description,
    descriptionFont,
    descriptionColor,
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

    const displayHeading = getTranslation(translations, previewLanguage, "heading") || heading;
    const displayDescription = getTranslation(translations, previewLanguage, "description") || description;
    const displayBadgeLabel = getTranslation(translations, previewLanguage, "badge.label") || badge?.label || "";

    const headingFontStyles = getFontFamilyStyle(headingFont);
    const descriptionFontStyles = getFontFamilyStyle(descriptionFont);
    const buttonFontStyles = getFontFamilyStyle(buttonFont);

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
                  "text-5xl md:text-7xl tracking-tighter font-regular",
                  {
                    "max-w-2xl": isCentered,
                    "lg:max-w-lg": isTwoColumnLayout,
                  }
                )}
                style={{ ...headingFontStyles, color: headingColor || undefined, whiteSpace: "pre-wrap" }}
              >
                {displayHeading}
              </h1>

              {description && (
                <p
                  className={cn(
                    "text-lg md:text-xl leading-relaxed tracking-tight text-muted-foreground",
                    {
                      "max-w-2xl": isCentered,
                      "lg:max-w-md": isTwoColumnLayout,
                    }
                  )}
                  style={{ ...descriptionFontStyles, color: descriptionColor || undefined, whiteSpace: "pre-wrap" }}
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
                      getTranslation(translations, previewLanguage, nameKey) || feature.name;
                    const displayDesc =
                      getTranslation(translations, previewLanguage, descKey) || feature.description;

                    return (
                      <div key={index} className="flex gap-3 items-start">
                        <CompoundIcon
                          icon={feature.icon}
                          size={20}
                          className="text-primary mt-0.5 shrink-0"
                        />
                        <div>
                          <div className="font-semibold text-base" style={{ whiteSpace: "pre-wrap" }}>{displayName}</div>
                          <div className="text-muted-foreground text-sm" style={{ whiteSpace: "pre-wrap" }}>{displayDesc}</div>
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
                      getTranslation(translations, previewLanguage, labelKey) || button.label;

                    return (
                      <div key={i} className="flex-shrink-0">
                        <CompoundButton
                          label={displayLabel}
                          url={button.url}
                          variant={button.variant}
                          size={button.size}
                          icon={button.icon}
                          isEditing={puck.isEditing}
                          fontVars={buttonFontStyles}
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
        className={cn("bg-muted rounded-md overflow-hidden", {
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
      <div className="bg-muted rounded-md overflow-hidden aspect-square">
        {image1?.src ? (
          <CompoundImage src={image1.src} alt={image1.alt} className="h-full" />
        ) : null}
      </div>
      <div className="bg-muted rounded-md overflow-hidden row-span-2">
        {image2?.src ? (
          <CompoundImage src={image2.src} alt={image2.alt} className="h-full" />
        ) : null}
      </div>
      <div className="bg-muted rounded-md overflow-hidden aspect-square">
        {image3?.src ? (
          <CompoundImage src={image3.src} alt={image3.alt} className="h-full" />
        ) : null}
      </div>
    </div>
  );
};

export const HeroBlock = withLayout(HeroBlockInternal);
