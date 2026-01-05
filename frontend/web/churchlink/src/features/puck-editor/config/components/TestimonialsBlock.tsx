import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import styles from "../../styles/components/Testimonials.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";
import { fontFamilyField } from "../shared/fontField";
import { getFontFamilyVariables } from "../../utils/fontLoader";
import {
  headingField,
  paddingField,
  paddingDefaults,
  getPaddingValue,
} from "../shared/fieldConfigs";
import { User } from "lucide-react";

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
  testimonials: TestimonialItem[];
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
    padding: paddingField,
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange, field }) => {
        const testimonials = (field as unknown as { value?: TestimonialItem[] })?.value || [];
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
    translations: {},
  },
  render: ({ heading, headingFont, testimonials, padding, translations }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    const displayHeading = translations?.[previewLanguage]?.heading || heading;
    const headingFontVars = getFontFamilyVariables(headingFont);

    return (
      <Section
        className={getClassName()}
        style={{
          paddingTop: getPaddingValue(padding.top),
          paddingBottom: getPaddingValue(padding.bottom),
        }}
      >
        <div className={getClassName("container")}>
          <h2 className="puck-font-scope" style={headingFontVars}>
            {displayHeading}
          </h2>

          <div className={getClassName("grid")}>
            {testimonials.map((testimonial, index) => {
              const titleKey = `testimonials.${index}.title`;
              const quoteKey = `testimonials.${index}.quote`;
              const authorKey = `testimonials.${index}.author.name`;

              const displayTitle =
                translations?.[previewLanguage]?.[titleKey] || testimonial.title;
              const displayQuote =
                translations?.[previewLanguage]?.[quoteKey] || testimonial.quote;
              const displayAuthorName =
                translations?.[previewLanguage]?.[authorKey] ||
                testimonial.author.name;

              return (
                <div key={index} className={getClassName("card")}>
                  <User className={getClassName("icon")} size={32} />

                  <div className={getClassName("content")}>
                    <div className={getClassName("text")}>
                      <h3 className={getClassName("title")}>{displayTitle}</h3>
                      <p className={getClassName("quote")}>{displayQuote}</p>
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
                      <span className={getClassName("authorName")}>
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
