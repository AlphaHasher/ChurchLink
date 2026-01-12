import type { ComponentGroupConfig } from "../types";

export const headingBlockGroups: ComponentGroupConfig = {
  groups: [
    {
      name: "Content",
      icon: "heading1",
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
      name: "Styling",
      icon: "palette",
      fields: [
        {
          name: "size",
          label: "Size",
          type: "select",
          options: [
            { label: "XXXL", value: "xxxl" },
            { label: "XXL", value: "xxl" },
            { label: "XL", value: "xl" },
            { label: "L", value: "l" },
            { label: "M", value: "m" },
            { label: "S", value: "s" },
            { label: "XS", value: "xs" },
          ],
        },
        {
          name: "level",
          label: "Level",
          type: "select",
          options: [
            { label: "None", value: "none" },
            { label: "H1", value: "1" },
            { label: "H2", value: "2" },
            { label: "H3", value: "3" },
            { label: "H4", value: "4" },
            { label: "H5", value: "5" },
            { label: "H6", value: "6" },
          ],
        },
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
