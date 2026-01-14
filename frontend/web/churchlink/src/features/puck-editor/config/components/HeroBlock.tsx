"use client";

import type { ComponentConfig } from "@puckeditor/core";
import { usePuck } from "@puckeditor/core";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import { getTranslation, type TranslationMap } from "../../utils/languageUtils";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import { extractComponentId } from "../../utils/puckFieldUtils";
import { findComponentRecursive, updateComponentRecursive } from "../../utils/puckDataUtils";
import { GroupedFieldsPanel } from "../../fields/grouped/GroupedFieldsPanel";
import { heroBlockGroups } from "../../fields/grouped/componentConfigs/heroBlock";
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
    heading: {
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
            config={heroBlockGroups}
          />
        );
      },
    } as any,
  } as any,
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
