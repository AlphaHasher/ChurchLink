import type { ComponentGroupConfig } from "../types";

export const buttonBlockGroups: ComponentGroupConfig = {
  groups: [
    {
      name: "Buttons",
      icon: "mouse-pointer-click",
      fields: [],
      isArray: true,
      arrayConfig: {
        maxItems: 3,
        itemLabelField: "label",
        defaultItem: {
          label: "Button",
          url: "",
          variant: "default",
          size: "default",
          icon: "none",
          fontFamily: "",
          labelColor: "",
          backgroundColor: "",
        },
        fields: [
          {
            name: "label",
            label: "Label",
            type: "text",
          },
          {
            name: "url",
            label: "URL",
            type: "text",
          },
          {
            name: "variant",
            label: "Variant",
            type: "select",
            options: [
              { label: "Default", value: "default" },
              { label: "Secondary", value: "secondary" },
              { label: "Outline", value: "outline" },
              { label: "Ghost", value: "ghost" },
            ],
          },
          {
            name: "size",
            label: "Size",
            type: "select",
            options: [
              { label: "Default", value: "default" },
              { label: "Small", value: "sm" },
              { label: "Large", value: "lg" },
            ],
          },
          {
            name: "icon",
            label: "Icon",
            type: "icon",
          },
          {
            name: "fontFamily",
            label: "Font Family",
            type: "fontFamily",
          },
          {
            name: "labelColor",
            label: "Label Color",
            type: "color",
          },
          {
            name: "backgroundColor",
            label: "Background Color",
            type: "color",
          },
        ],
      },
    },
    {
      name: "Alignment",
      icon: "align-left",
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
