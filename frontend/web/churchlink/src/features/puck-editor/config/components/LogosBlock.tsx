import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import styles from "../../styles/components/Logos.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";

const getClassName = getClassNameFactory("Logos", styles);

type Logo = {
  alt: string;
  imageUrl: string;
};

export type LogosBlockPropsInner = {
  logos: Logo[];
  translations?: TranslationMap;
};

export type LogosBlockProps = LogosBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const LogosBlockInternal: ComponentConfig<LogosBlockPropsInner> = {
  label: "Logos",
  fields: {
    logos: {
      type: "array",
      getItemSummary: (item, i) => item.alt || `Logo #${(i ?? 0) + 1}`,
      defaultItemProps: {
        alt: "",
        imageUrl: "",
      },
      arrayFields: {
        alt: { type: "text" },
        imageUrl: { type: "text" },
      },
    },
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange, field }) => {
        const logos = (field as { value?: Logo[] })?.value || [];
        const translatableFields = logos.map((_, index) => ({
          name: `logos.${index}.alt`,
          type: "text" as const,
          label: `Logo ${index + 1} Alt Text`,
        }));

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
    logos: [
      {
        alt: "google",
        imageUrl:
          "https://logolook.net/wp-content/uploads/2021/06/Google-Logo.png",
      },
      {
        alt: "google",
        imageUrl:
          "https://logolook.net/wp-content/uploads/2021/06/Google-Logo.png",
      },
      {
        alt: "google",
        imageUrl:
          "https://logolook.net/wp-content/uploads/2021/06/Google-Logo.png",
      },
      {
        alt: "google",
        imageUrl:
          "https://logolook.net/wp-content/uploads/2021/06/Google-Logo.png",
      },
      {
        alt: "google",
        imageUrl:
          "https://logolook.net/wp-content/uploads/2021/06/Google-Logo.png",
      },
    ],
    translations: {},
  },
  render: ({ logos, translations }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    return (
      <Section className={getClassName()}>
        <div className={getClassName("items")}>
          {logos.map((item, i) => {
            const altKey = `logos.${i}.alt`;
            const displayAlt = translations?.[previewLanguage]?.[altKey] || item.alt;

            return (
              <div key={i} className={getClassName("item")}>
                <img
                  className={getClassName("image")}
                  alt={displayAlt}
                  src={item.imageUrl}
                  height={64}
                />
              </div>
            );
          })}
        </div>
      </Section>
    );
  },
};

export const LogosBlock = withLayout(LogosBlockInternal);
