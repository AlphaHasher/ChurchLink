import type { ComponentConfig } from "@measured/puck";
import { usePuck } from "@measured/puck";
import { Section } from "../shared/Section";
import { withLayout } from "../shared/Layout";
import { TranslationsField } from "../../fields/TranslationsField";
import { usePuckLanguage } from "../../context/PuckLanguageContext";
import { getTranslation, type TranslationMap } from "../../utils/languageUtils";
import { ColorPickerField } from "../../fields/ColorPickerField";
import { fontFamilyField } from "../shared/fontField";
import { getFontFamilyStyle } from "../../utils/fontLoader";
import {
  paddingField,
  paddingDefaults,
  getPaddingValue,
} from "../shared/fieldConfigs";
import { extractComponentId } from "../../utils/puckFieldUtils";
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
      type: "array",
      max: 15,
      getItemSummary: (item, index = 0) => item.question || `FAQ ${index + 1}`,
      arrayFields: {
        question: { type: "text", contentEditable: true },
        answer: { type: "textarea", contentEditable: true },
      },
      defaultItemProps: {
        question: "Question?",
        answer: "Answer to the question.",
      },
    },
    questionFont: fontFamilyField,
    questionColor: {
      type: "custom",
      label: "Question Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} label="Question Color" />
      ),
    },
    answerFont: fontFamilyField,
    answerColor: {
      type: "custom",
      label: "Answer Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value || ""} onChange={onChange} label="Answer Color" />
      ),
    },
    columnLayout: {
      type: "select",
      label: "Column Layout",
      options: [
        { label: "Single Column", value: "single-column" },
        { label: "Two Column", value: "two-column" },
      ],
    },
    mode: {
      type: "select",
      label: "Mode",
      options: [
        { label: "Single Answer (one open at a time)", value: "single-answer" },
        { label: "Multi Answer (multiple can be open)", value: "multi-answer" },
      ],
    },
    padding: paddingField,
    translations: {
      type: "custom",
      label: "Translations",
      render: ({ value, onChange, id }) => {
        const componentId = extractComponentId(id);
        const { appState } = usePuck();

        // Find the current component in the content array
        const currentComponent = appState.data.content.find(
          (item) => item.props.id === componentId
        );

        const faqs = (currentComponent?.props as FaqBlockPropsInner)?.faqs || [];

        const translatableFields = faqs.flatMap((_, index) => [
          {
            name: `faqs.${index}.question`,
            type: "text" as const,
            label: `FAQ ${index + 1} Question`,
          },
          {
            name: `faqs.${index}.answer`,
            type: "textarea" as const,
            label: `FAQ ${index + 1} Answer`,
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
                      <span style={{ ...questionFontStyles, color: questionColor || undefined }}>{displayQuestion}</span>
                      <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-200" />
                    </Accordion.Trigger>
                  </Accordion.Header>
                  <Accordion.Content className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                    <div className="pb-4 pt-0" style={{ ...answerFontStyles, color: answerColor || undefined }}>{displayAnswer}</div>
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
