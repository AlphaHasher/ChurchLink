import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import styles from "../../styles/components/Hero.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";
import { Button } from "@/shared/components/ui/button";

const getClassName = getClassNameFactory("Hero", styles);

type HeroButton = {
  label: string;
  href: string;
  variant?: "default" | "secondary";
};

export type HeroBlockPropsInner = {
  title: string;
  description: string; // HTML string (like richtext but simplified)
  align: "left" | "center";
  padding: string;
  image?: {
    content?: any[]; // slot for custom content
    mode?: "inline" | "background" | "custom";
    url?: string;
  };
  buttons: HeroButton[];
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
    title: { type: "text", contentEditable: true },
    description: {
      type: "textarea",
      label: "Description",
      contentEditable: true,
    },
    buttons: {
      type: "array",
      min: 1,
      max: 4,
      getItemSummary: (item) => item.label || "Button",
      arrayFields: {
        label: { type: "text", contentEditable: true },
        href: { type: "text" },
        variant: {
          type: "select",
          options: [
            { label: "primary", value: "default" },
            { label: "secondary", value: "secondary" },
          ],
        },
      },
      defaultItemProps: {
        label: "Button",
        href: "#",
        variant: "default",
      },
    },
    align: {
      type: "radio",
      options: [
        { label: "left", value: "left" },
        { label: "center", value: "center" },
      ],
    },
    image: {
      type: "object",
      objectFields: {
        content: { type: "slot", label: "Custom Content" },
        url: { type: "text", label: "Image URL" },
        mode: {
          type: "radio",
          label: "Display Mode",
          options: [
            { label: "inline", value: "inline" },
            { label: "bg", value: "background" },
            { label: "custom", value: "custom" },
          ],
        },
      },
    },
    padding: {
      type: "select",
      label: "Vertical Padding",
      options: [
        { label: "Small (32px)", value: "32px" },
        { label: "Medium (64px)", value: "64px" },
        { label: "Large (96px)", value: "96px" },
        { label: "Extra Large (128px)", value: "128px" },
      ],
    },
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange, field }) => {
        const buttons = (field as { value?: HeroButton[] })?.value || [];
        const translatableFields = [
          { name: "title", type: "text" as const, label: "Title" },
          { name: "description", type: "textarea" as const, label: "Description" },
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
    title: "Hero",
    align: "left",
    description: "Description",
    buttons: [{ label: "Learn more", href: "#", variant: "default" }],
    padding: "64px",
    image: {
      mode: "inline",
      url: "",
      content: [],
    },
    translations: {},
  },
  resolveFields: (data, { fields }) => {
    if (data.props.align === "center") {
      return {
        ...fields,
        image: undefined,
      };
    }
    return fields;
  },
  render: ({ align, title, description, buttons, padding, image, translations, puck }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    const displayTitle = translations?.[previewLanguage]?.title || title;
    const displayDescription = translations?.[previewLanguage]?.description || description;

    return (
      <Section
        className={getClassName({
          left: align === "left",
          center: align === "center",
          hasImageBackground: image?.mode === "background",
        })}
        style={{ paddingTop: padding, paddingBottom: padding }}
      >
        {image?.mode === "background" && image?.url && (
          <>
            <div
              className={getClassName("image")}
              style={{
                backgroundImage: `url("${image.url}")`,
              }}
            ></div>
            <div className={getClassName("imageOverlay")}></div>
          </>
        )}

        <div className={getClassName("inner")}>
          <div className={getClassName("content")}>
            <h1>{displayTitle}</h1>
            <div className={getClassName("subtitle")}>{displayDescription}</div>
            <div className={getClassName("actions")}>
              {buttons.map((button, i) => {
                const labelKey = `buttons.${i}.label`;
                const displayLabel =
                  translations?.[previewLanguage]?.[labelKey] || button.label;

                return (
                  <Button
                    key={i}
                    asChild
                    variant={button.variant || "default"}
                    size="lg"
                    tabIndex={puck.isEditing ? -1 : undefined}
                  >
                    <a href={puck.isEditing ? "#" : button.href}>{displayLabel}</a>
                  </Button>
                );
              })}
            </div>
          </div>

          {align !== "center" && image?.mode === "inline" && image?.url && (
            <div
              style={{
                backgroundImage: `url('${image.url}')`,
                backgroundSize: "cover",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "center",
                borderRadius: 24,
                height: 356,
                marginLeft: "auto",
                width: "100%",
              }}
            />
          )}

          {align !== "center" && image?.mode === "custom" && image.content && (
            <image.content
              style={{
                height: 356,
                marginLeft: "auto",
                width: "100%",
              }}
            />
          )}
        </div>
      </Section>
    );
  },
};

export const HeroBlock = withLayout(HeroBlockInternal);
