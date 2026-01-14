import type { ComponentConfig } from "@measured/puck";
import { usePuck } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import { getTranslation, type TranslationMap } from "../../utils/languageUtils";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import {
  paddingDefaults,
  getPaddingValue,
} from "../shared/fieldConfigs";
import { extractComponentId } from "../../utils/puckFieldUtils";
import { findComponentRecursive, updateComponentRecursive } from "../../utils/puckDataUtils";
import { GroupedFieldsPanel } from "../../fields/grouped/GroupedFieldsPanel";
import { faqBlockGroups } from "../../fields/grouped/componentConfigs/faqBlock";
import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";

type FaqItem = {
  question: string;
  answer: string;
};

export type FaqBlockPropsInner = {
  faqs: FaqItem[];
  questionFont?: string;
  questionColor?: string;
  answerFont?: string;
  answerColor?: string;
  columnLayout: "single-column" | "two-column";
  mode: "single-answer" | "multi-answer";
  padding: {
    top: string;
    bottom: string;
  };
  translations?: TranslationMap;
};

export type FaqBlockProps = FaqBlockPropsInner & {
  layout?: {
    spanCol?: number;
    spanRow?: number;
    padding?: string;
    grow?: boolean;
  };
};

const FaqBlockInternal: ComponentConfig<FaqBlockPropsInner> = {
  label: "FAQ",
  fields: {
    faqs: {
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
            config={faqBlockGroups}
          />
        );
      },
    } as any,
  } as any,
  defaultProps: {
    faqs: [
      {
        question: "How does it work?",
        answer: "It works by following a simple process that makes everything easy.",
      },
    ],
    questionFont: "",
    questionColor: "#000000",
    answerFont: "",
    answerColor: "#000000",
    columnLayout: "two-column",
    mode: "single-answer",
    padding: paddingDefaults,
    translations: {},
  },
  render: ({
    faqs,
    questionFont,
    questionColor,
    answerFont,
    answerColor,
    columnLayout,
    mode,
    padding,
    translations,
  }) => {
    let previewLanguage = "en";
    try {
      const context = usePuckLanguage();
      previewLanguage = context.previewLanguage;
    } catch {
      // Not in editor context
    }

    const questionFontStyles = getFontFamilyStyle(questionFont);
    const answerFontStyles = getFontFamilyStyle(answerFont);

    return (
      <Section
        style={{
          paddingTop: getPaddingValue(padding.top),
          paddingBottom: getPaddingValue(padding.bottom),
        }}
      >
        <div className={columnLayout === "two-column" ? "grid gap-10 lg:grid-cols-2" : "w-full"}>
          <Accordion.Root
            type={mode === "single-answer" ? "single" : "multiple"}
            collapsible
            className="w-full"
          >
            {faqs.map((faq, index) => {
              const questionKey = `faqs.${index}.question`;
              const answerKey = `faqs.${index}.answer`;

              const displayQuestion =
                getTranslation(translations, previewLanguage, questionKey) || faq.question;
              const displayAnswer =
                getTranslation(translations, previewLanguage, answerKey) || faq.answer;

              return (
                <Accordion.Item
                  key={index}
                  value={`item-${index}`}
                  className="border-b border-border"
                >
                  <Accordion.Header>
                    <Accordion.Trigger className="flex w-full items-center justify-between py-4 text-left font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180">
                      <span style={{ ...questionFontStyles, color: questionColor || undefined, whiteSpace: "pre-wrap" }}>{displayQuestion}</span>
                      <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    <div className="pb-4 pt-0" style={{ ...answerFontStyles, color: answerColor || undefined, whiteSpace: "pre-wrap" }}>{displayAnswer}</div>
                  </Accordion.Content>
                </Accordion.Item>
              );
            })}
          </Accordion.Root>
        </div>
      </Section>
    );
  },
};

export const FaqBlock = withLayout(FaqBlockInternal);
