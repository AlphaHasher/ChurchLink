import type { ComponentGroupConfig } from "../types";

export const heroBlockGroups: ComponentGroupConfig = {
  groups: [
    {
      name: "Badge",
      icon: "badge",
      fields: [
        {
          name: "badge.label",
          label: "Label",
          type: "text",
          contentEditable: true,
        },
        {
          name: "badge.url",
          label: "URL",
          type: "text",
        },
        {
          name: "badge.variant",
          label: "Variant",
          type: "select",
          options: [
            { label: "default", value: "default" },
            { label: "secondary", value: "secondary" },
            { label: "destructive", value: "destructive" },
            { label: "outline", value: "outline" },
          ],
        },
      ],
    },
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
      name: "Features",
      icon: "list-check",
      fields: [],
      isArray: true,
      arrayConfig: {
        maxItems: 5,
        itemLabelField: "name",
        defaultItem: {
          icon: "check",
          name: "Feature name",
          description: "Description of the feature",
        },
        fields: [
          {
            name: "name",
            label: "Title",
            type: "text",
          },
          {
            name: "description",
            label: "Description",
            type: "textarea",
          },
          {
            name: "icon",
            label: "Icon",
            type: "icon",
          },
        ],
      },
    },
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
        ],
      },
    },
    {
      name: "Button Style",
      icon: "type",
      fields: [
        {
          name: "buttonFont",
          label: "Font Family",
          type: "fontFamily",
        },
      ],
    },
    {
      name: "Images",
      icon: "image",
      fields: [
        {
          name: "images",
          label: "Images",
          type: "text",
        },
      ],
      isArray: true,
      arrayConfig: {
        maxItems: 10,
        itemLabelField: "alt",
        defaultItem: {
          src: "",
          alt: "Image description",
        },
      },
    },
    {
      name: "Image Layout",
      icon: "layout-grid",
      fields: [
        {
          name: "imageLayout",
          label: "Image Layout",
          type: "select",
          options: [
            { label: "None", value: "none" },
            { label: "Single Square (1x1)", value: "1x1" },
            { label: "Three Image Cluster (1x1-9x16-1x1)", value: "1x1-9x16-1x1" },
            { label: "Wide Banner (16x9)", value: "16x9" },
          ],
        },
        {
          name: "imageAspectRatio",
          label: "Image Aspect Ratio",
          type: "select",
          options: [
            { label: "16:9 (Landscape)", value: "16x9" },
            { label: "1:1 (Square)", value: "1x1" },
            { label: "9:16 (Portrait)", value: "9x16" },
          ],
        },
      ],
    },
    {
      name: "Layout",
      icon: "layout-grid",
      fields: [
        {
          name: "contentAlign",
          label: "Content Alignment",
          type: "select",
          options: [
            { label: "Center", value: "center" },
            { label: "Left", value: "left" },
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
