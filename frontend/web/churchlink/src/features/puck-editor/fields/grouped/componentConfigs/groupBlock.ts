import type { ComponentGroupConfig } from "../types";

export const groupBlockGroups: ComponentGroupConfig = {
  groups: [
    {
      name: "General",
      icon: "grid",
      fields: [
        {
          name: "name",
          label: "Group Name",
          type: "text",
          contentEditable: true,
        },
      ],
    },
    {
      name: "Background",
      icon: "palette",
      fields: [
        {
          name: "backgroundType",
          label: "Background Type",
          type: "radio",
          options: [
            { label: "Color", value: "color" },
            { label: "Image", value: "image" },
          ],
        },
        {
          name: "backgroundColor",
          label: "Background Color",
          type: "color",
        },
      ],
    },
    {
      name: "Background Image",
      icon: "image",
      fields: [
        {
          name: "backgroundImage.url",
          label: "Image URL",
          type: "text",
        },
        {
          name: "backgroundImage.brightness",
          label: "Brightness (%)",
          type: "number",
          min: 0,
          max: 200,
        },
        {
          name: "backgroundImage.size",
          label: "Scaling",
          type: "radio",
          options: [
            { label: "Cover", value: "cover" },
            { label: "Contain", value: "contain" },
            { label: "Auto", value: "auto" },
          ],
        },
        {
          name: "backgroundImage.position",
          label: "Position",
          type: "radio",
          options: [
            { label: "Center", value: "center" },
            { label: "Top", value: "top" },
            { label: "Bottom", value: "bottom" },
            { label: "Left", value: "left" },
            { label: "Right", value: "right" },
          ],
        },
        {
          name: "backgroundImage.maxHeight",
          label: "Max Height (px)",
          type: "number",
          min: 0,
        },
        {
          name: "backgroundImage.fixed",
          label: "Parallax Effect",
          type: "radio",
          options: [
            { label: "Yes", value: "true" },
            { label: "No", value: "false" },
          ],
        },
        {
          name: "backgroundImage.overlay",
          label: "Color Overlay",
          type: "color",
        },
      ],
    },
    {
      name: "Alignment",
      icon: "align-center",
      fields: [
        {
          name: "verticalAlign",
          label: "Vertical Alignment",
          type: "radio",
          options: [
            { label: "Top", value: "top" },
            { label: "Center", value: "center" },
            { label: "Bottom", value: "bottom" },
          ],
        },
      ],
    },
    {
      name: "Save",
      icon: "save",
      fields: [],
      isCustom: true,
    },
  ],
};
