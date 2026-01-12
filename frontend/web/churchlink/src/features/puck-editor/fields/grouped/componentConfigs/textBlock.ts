import type { ComponentGroupConfig } from "../types";

export const textBlockGroups: ComponentGroupConfig = {
  groups: [
    {
      name: "Content",
      icon: "align-left",
      fields: [
        {
          name: "text",
          label: "Text",
          type: "textarea",
          contentEditable: true,
        },
      ],
    },
    {
      name: "Typography",
      icon: "type",
      fields: [
        {
          name: "typography.fontFamily",
          label: "Font Family",
          type: "fontFamily",
        },
        {
          name: "typography.color",
          label: "Color",
          type: "color",
        },
      ],
    },
    {
      name: "Sizing & Spacing",
      icon: "layout-grid",
      fields: [
        {
          name: "size",
          label: "Size",
          type: "radio",
          options: [
            { label: "S", value: "s" },
            { label: "M", value: "m" },
          ],
        },
        {
          name: "maxWidth",
          label: "Max Width (px)",
          type: "number",
        },
      ],
    },
    {
      name: "Alignment & Color",
      icon: "palette",
      fields: [
        {
          name: "align",
          label: "Alignment",
          type: "radio",
          options: [
            { label: "Left", value: "left" },
            { label: "Center", value: "center" },
            { label: "Right", value: "right" },
          ],
        },
        {
          name: "color",
          label: "Color",
          type: "radio",
          options: [
            { label: "Default", value: "default" },
            { label: "Muted", value: "muted" },
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
