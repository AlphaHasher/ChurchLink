import type { ComponentGroupConfig } from "../types";

export const eventSectionBlockGroups: ComponentGroupConfig = {
  groups: [
    {
      name: "Title",
      icon: "heading1",
      fields: [
        {
          name: "title",
          label: "Section Title",
          type: "text",
          contentEditable: true,
        },
        {
          name: "titleFont",
          label: "Font Family",
          type: "fontFamily",
        },
        {
          name: "titleColor",
          label: "Color",
          type: "color",
        },
      ],
    },
    {
      name: "Display Options",
      icon: "eye",
      fields: [
        {
          name: "showTitle",
          label: "Show Title",
          type: "radio",
          options: [
            { label: "Yes", value: "true" },
            { label: "No", value: "false" },
          ],
        },
        {
          name: "showFilters",
          label: "Show Filters",
          type: "radio",
          options: [
            { label: "Yes", value: "true" },
            { label: "No", value: "false" },
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
