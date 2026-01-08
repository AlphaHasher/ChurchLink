import type { ComponentConfig } from "@measured/puck";
import { usePuck } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import styles from "../../styles/components/Testimonials.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import { getTranslation, type TranslationMap } from "../../utils/languageUtils";
import { fontFamilyField } from "../shared/fontField";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import { ColorPickerField } from "../../fields/ColorPickerField";
import {
  headingField,
  paddingField,
  paddingDefaults,
  getPaddingValue,
} from "../shared/fieldConfigs";
import { User } from "lucide-react";
import { extractComponentId } from "../../utils/puckFieldUtils";

const getClassName = getClassNameFactory("Testimonials", styles);

type TestimonialItem = {
  title: string;
  quote: string;
  author: {
    name: string;
    image: {
      src: string;
      alt: string;
    };
  };
};

export type TestimonialsBlockPropsInner = {
  heading: string;
  headingFont?: string;
  headingColor?: string;
  testimonials: TestimonialItem[];
  titleFont?: string;
  titleColor?: string;
  quoteFont?: string;
  quoteColor?: string;
  authorFont?: string;
  authorColor?: string;
  padding: {
    top: string;
    bottom: string;
  };
  translations?: TranslationMap;
};

export type TestimonialsBlockProps = TestimonialsBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const getInitials = (name: string | undefined): string => {
  if (!name || typeof name !== "string") return "";
  return name
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
};

const TestimonialsBlockInternal: ComponentConfig<TestimonialsBlockPropsInner> = {
  label: "Testimonials",
  fields: {
    heading: headingField,
    headingFont: fontFamilyField,
    headingColor: {
      type: "custom",
      label: "Heading Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} label="Heading Color" />
      ),
    },
    testimonials: {
      type: "array",
      max: 10,
      getItemSummary: (item, index = 0) =>
        (item.author?.name && typeof item.author.name === "string") ? item.author.name : `Testimonial ${index + 1}`,
      arrayFields: {
        title: { type: "text", contentEditable: true },
        quote: { type: "textarea", contentEditable: true },
        author: {
          type: "object",
          objectFields: {
            name: { type: "text", contentEditable: true },
            image: {
              type: "object",
              objectFields: {
                src: { type: "text" },
                alt: { type: "text" },
              },
            },
          },
        },
      },
      defaultItemProps: {
        title: "Best decision ever",
        quote:
          "Our goal was to streamline SMB trade, making it easier and faster than ever.",
        author: {
          name: "Jane Janson",
          image: {
            src: "",
            alt: "Jane Janson",
          },
        },
      },
    },
    titleFont: fontFamilyField,
    titleColor: {
      type: "custom",
      label: "Title Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} label="Title Color" />
      ),
    },
    quoteFont: fontFamilyField,
    quoteColor: {
      type: "custom",
      label: "Quote Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} label="Quote Color" />
      ),
    },
    authorFont: fontFamilyField,
    authorColor: {
      type: "custom",
      label: "Author Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} label="Author Color" />
      ),
    },
    padding: paddingField,
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange, id }) => {
        const componentId = extractComponentId(id);
        const { appState } = usePuck();
        const comp = appState.data.content.find((item) => item.props.id === componentId);
        const props = comp?.props as TestimonialsBlockPropsInner;
        const testimonials = props?.testimonials || [];
        const translatableFields = [
          { name: "heading", type: "text" as const, label: "Heading" },
          ...testimonials.flatMap((_, index) => [
            {
              name: `testimonials.${index}.title`,
              type: "text" as const,
              label: `Testimonial ${index + 1} Title`,
            },
            {
              name: `testimonials.${index}.quote`,
              type: "textarea" as const,
              label: `Testimonial ${index + 1} Quote`,
            },
            {
              name: `testimonials.${index}.author.name`,
              type: "text" as const,
              label: `Testimonial ${index + 1} Author Name`,
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
    heading: "Trusted by hundreds of businesses worldwide",
    headingFont: "",
    headingColor: "#000000",
    padding: paddingDefaults,
    testimonials: [
      {
        title: "Best decision ever",
        quote:
          "Our goal was to streamline SMB trade, making it easier and faster than ever.",
        author: {
          name: "Jane Janson",
          image: { src: "", alt: "Jane Janson" },
        },
      },
    ],
    titleFont: "",
    titleColor: "#000000",
    quoteFont: "",
    quoteColor: "#000000",
    authorFont: "",
    authorColor: "#000000",
    translations: {},
  },
  render: ({ heading, headingFont, headingColor, testimonials, titleFont, titleColor, quoteFont, quoteColor, authorFont, authorColor, padding, translations }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    const displayHeading = getTranslation(translations, previewLanguage, "heading") || heading;
    const headingFontStyles = getFontFamilyStyle(headingFont);
    const titleFontStyles = getFontFamilyStyle(titleFont);
    const quoteFontStyles = getFontFamilyStyle(quoteFont);
    const authorFontStyles = getFontFamilyStyle(authorFont);

    return (
      <Section
        className={getClassName()}
        style={{
          paddingTop: getPaddingValue(padding.top),
          paddingBottom: getPaddingValue(padding.bottom),
        }}
      >
        <div className={getClassName("container")}>
          <h2 style={{ ...headingFontStyles, color: headingColor || undefined }}>
            {displayHeading}
          </h2>

          <div className={getClassName("grid")}>
            {testimonials.map((testimonial, index) => {
              const titleKey = `testimonials.${index}.title`;
              const quoteKey = `testimonials.${index}.quote`;
              const authorKey = `testimonials.${index}.author.name`;

              const displayTitle =
                getTranslation(translations, previewLanguage, titleKey) || testimonial.title;
              const displayQuote =
                getTranslation(translations, previewLanguage, quoteKey) || testimonial.quote;
              const displayAuthorName =
                getTranslation(translations, previewLanguage, authorKey) ||
                testimonial.author.name;

              return (
                <div key={index} className={getClassName("card")}>
                  <User className={getClassName("icon")} size={32} />

                  <div className={getClassName("content")}>
                    <div className={getClassName("text")}>
                      <h3 className={getClassName("title")} style={{ ...titleFontStyles, color: titleColor || undefined }}>{displayTitle}</h3>
                      <p className={getClassName("quote")} style={{ ...quoteFontStyles, color: quoteColor || undefined }}>{displayQuote}</p>
                    </div>

                    <div className={getClassName("author")}>
                      <span className={getClassName("authorBy")}>By</span>
                      {testimonial.author.image?.src ? (
                        <img
                          src={testimonial.author.image.src}
                          alt={testimonial.author.image.alt}
                          className={getClassName("avatar")}
                        />
                      ) : (
                        <div className={getClassName("avatarFallback")}>
                          {getInitials(displayAuthorName)}
                        </div>
                      )}
                      <span className={getClassName("authorName")} style={{ ...authorFontStyles, color: authorColor || undefined }}>
                        {displayAuthorName}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Section>
    );
  },
};

export const TestimonialsBlock = withLayout(TestimonialsBlockInternal);
