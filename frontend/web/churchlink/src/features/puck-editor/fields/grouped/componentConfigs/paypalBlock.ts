import type { ComponentGroupConfig } from "../types";

export const paypalBlockGroups: ComponentGroupConfig = {
  groups: [
    {
      name: "Heading",
      icon: "heading1",
      fields: [
        {
          name: "heading",
          label: "Heading",
          type: "text",
          contentEditable: true,
        },
        {
          name: "headingFont",
          label: "Font Family",
          type: "fontFamily",
        },
        {
          name: "headingColor",
          label: "Color",
          type: "color",
        },
      ],
    },
    {
      name: "Description",
      icon: "align-left",
      fields: [
        {
          name: "description",
          label: "Description",
          type: "textarea",
          contentEditable: true,
        },
        {
          name: "descriptionFont",
          label: "Font Family",
          type: "fontFamily",
        },
        {
          name: "descriptionColor",
          label: "Color",
          type: "color",
        },
      ],
    },
    {
      name: "Defaults",
      icon: "settings",
      fields: [
        {
          name: "defaultAmount",
          label: "Default Amount",
          type: "number",
          min: 1,
        },
        {
          name: "defaultCurrency",
          label: "Currency",
          type: "select",
          options: [{ label: "USD", value: "USD" }],
        },
        {
          name: "defaultInterval",
          label: "Default Recurring Interval",
          type: "select",
          options: [
            { label: "Weekly", value: "WEEK" },
            { label: "Monthly", value: "MONTH" },
            { label: "Yearly", value: "YEAR" },
          ],
        },
      ],
    },
    {
      name: "Layout",
      icon: "layout-grid",
      fields: [
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
