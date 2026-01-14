import type { ComponentGroupConfig } from "../types";

export const imageBlockGroups: ComponentGroupConfig = {
  groups: [
    {
      name: "Image",
      icon: "image",
      fields: [
        {
          name: "src",
          label: "Image URL",
          type: "text",
        },
        {
          name: "alt",
          label: "Alt Text",
          type: "text",
          contentEditable: true,
        },
      ],
    },
    {
      name: "Display",
      icon: "layout-grid",
      fields: [
        {
          name: "objectFit",
          label: "Object Fit",
          type: "select",
          options: [
            { label: "Contain", value: "contain" },
            { label: "Cover", value: "cover" },
            { label: "Fill", value: "fill" },
            { label: "None", value: "none" },
          ],
        },
        {
          name: "aspectRatio",
          label: "Aspect Ratio",
          type: "select",
          options: [
            { label: "Auto", value: "auto" },
            { label: "Square (1:1)", value: "1/1" },
            { label: "Standard (4:3)", value: "4/3" },
            { label: "Widescreen (16:9)", value: "16/9" },
            { label: "Ultra-wide (21:9)", value: "21/9" },
          ],
        },
        {
          name: "rounded",
          label: "Border Radius",
          type: "select",
          options: [
            { label: "None", value: "none" },
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
            { label: "Full", value: "full" },
          ],
        },
        {
          name: "maxHeight",
          label: "Max Height (px)",
          type: "number",
          min: 0,
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
        {
          name: "dropShadow",
          label: "Drop Shadow",
          type: "select",
          options: [
            { label: "None", value: "none" },
            { label: "Extra Small", value: "xs" },
            { label: "Small", value: "sm" },
            { label: "Medium", value: "md" },
            { label: "Large", value: "lg" },
            { label: "Extra Large", value: "xl" },
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
