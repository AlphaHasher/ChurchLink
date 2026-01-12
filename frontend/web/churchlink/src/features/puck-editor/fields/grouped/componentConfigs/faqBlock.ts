import type { ComponentGroupConfig } from "../types";

export const faqBlockGroups: ComponentGroupConfig = {
  groups: [
    {
      name: "FAQs",
      icon: "help-circle",
      fields: [],
      isArray: true,
      arrayConfig: {
        maxItems: 15,
        itemLabelField: "question",
        defaultItem: {
          question: "Question?",
          answer: "Answer to the question.",
        },
        fields: [
          {
            name: "question",
            label: "Question",
            type: "text",
          },
          {
            name: "answer",
            label: "Answer",
            type: "textarea",
          },
        ],
      },
    },
    {
      name: "Question Style",
      icon: "type",
      fields: [
        {
          name: "questionFont",
          label: "Font Family",
          type: "fontFamily",
        },
        {
          name: "questionColor",
          label: "Color",
          type: "color",
        },
      ],
    },
    {
      name: "Answer Style",
      icon: "type",
      fields: [
        {
          name: "answerFont",
          label: "Font Family",
          type: "fontFamily",
        },
        {
          name: "answerColor",
          label: "Color",
          type: "color",
        },
      ],
    },
    {
      name: "Layout",
      icon: "layout-grid",
      fields: [
        {
          name: "columnLayout",
          label: "Column Layout",
          type: "select",
          options: [
            { label: "Single Column", value: "single-column" },
            { label: "Two Column", value: "two-column" },
          ],
        },
        {
          name: "mode",
          label: "Mode",
          type: "select",
          options: [
            { label: "Single Answer (one open at a time)", value: "single-answer" },
            { label: "Multi Answer (multiple can be open)", value: "multi-answer" },
          ],
        },
        {
          name: "padding.top",
          label: "Top Padding",
          type: "select",
          options: [
            { label: "none", value: "none" },
            { label: "small", value: "small" },
            { label: "medium", value: "medium" },
            { label: "large", value: "large" },
          ],
        },
        {
          name: "padding.bottom",
          label: "Bottom Padding",
          type: "select",
          options: [
            { label: "none", value: "none" },
            { label: "small", value: "small" },
            { label: "medium", value: "medium" },
            { label: "large", value: "large" },
          ],
        },
      ],
    },
    {
      name: "Translations",
      icon: "languages",
      fields: [],
      isCustom: true,
    },
  ],
};
