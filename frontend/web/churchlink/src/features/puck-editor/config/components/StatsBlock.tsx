import type { ComponentConfig } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import styles from "../../styles/components/Stats.module.css";
import { getClassNameFactory } from "../../utils/classNames";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import type { TranslationMap } from "../../utils/languageUtils";

const getClassName = getClassNameFactory("Stats", styles);

type Stat = {
  title: string;
  description: string;
};

export type StatsBlockPropsInner = {
  items: Stat[];
  translations?: TranslationMap;
};

export type StatsBlockProps = StatsBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const StatsBlockInternal: ComponentConfig<StatsBlockPropsInner> = {
  label: "Statistics",
  fields: {
    items: {
      type: "array",
      getItemSummary: (item, i) =>
        item.title && item.description ? `${item.title}: ${item.description}` : `Stat #${(i ?? 0) + 1}`,
      defaultItemProps: {
        title: "Stat",
        description: "1,000",
      },
      arrayFields: {
        title: {
          type: "text",
          contentEditable: true,
        },
        description: {
          type: "text",
          contentEditable: true,
        },
      },
    },
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange, field }) => {
        const items = (field as { value?: Stat[] })?.value || [];
        const translatableFields = items.flatMap((_, index) => [
          {
            name: `items.${index}.title`,
            type: "text" as const,
            label: `Stat ${index + 1} Title`,
          },
          {
            name: `items.${index}.description`,
            type: "text" as const,
            label: `Stat ${index + 1} Value`,
          },
        ]);

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
    items: [
      {
        title: "Stat",
        description: "1,000",
      },
    ],
    translations: {},
  },
  render: ({ items, translations }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    return (
      <Section className={getClassName()} maxWidth={"916px"}>
        <div className={getClassName("items")}>
          {items.map((item, i) => {
            const titleKey = `items.${i}.title`;
            const descriptionKey = `items.${i}.description`;
            const displayTitle = translations?.[previewLanguage]?.[titleKey] || item.title;
            const displayDescription =
              translations?.[previewLanguage]?.[descriptionKey] || item.description;

            return (
              <div key={i} className={getClassName("item")}>
                <div className={getClassName("label")}>{displayTitle}</div>
                <div className={getClassName("value")}>{displayDescription}</div>
              </div>
            );
          })}
        </div>
      </Section>
    );
  },
};

export const StatsBlock = withLayout(StatsBlockInternal);
