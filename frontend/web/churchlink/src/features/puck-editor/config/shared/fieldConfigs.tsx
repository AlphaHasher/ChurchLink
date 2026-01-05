import type { Field } from "@measured/puck";
import { IconPickerField } from "../../fields/IconPickerField";

// Icon field - uses custom IconPickerField component
export const iconField: Field<string> = {
  type: "custom",
  label: "Icon",
  render: ({ value, onChange }) => {
    return <IconPickerField value={value as string} onChange={onChange} />;
  },
};

// Button field - single button configuration
export const buttonField = {
  type: "object" as const,
  objectFields: {
    label: { type: "text" as const, contentEditable: true },
    url: { type: "text" as const },
    variant: {
      type: "select" as const,
      options: [
        { label: "primary", value: "default" },
        { label: "secondary", value: "secondary" },
        { label: "outline", value: "outline" },
        { label: "ghost", value: "ghost" },
        { label: "link", value: "link" },
        { label: "destructive", value: "destructive" },
      ],
    },
    size: {
      type: "select" as const,
      options: [
        { label: "default", value: "default" },
        { label: "sm", value: "sm" },
        { label: "lg", value: "lg" },
        { label: "icon", value: "icon" },
      ],
    },
    icon: iconField,
  },
};

export const buttonDefaults = {
  label: "Button",
  url: "",
  variant: "default" as const,
  size: "default" as const,
  icon: "none",
};

// Buttons field - array of buttons (max 3)
export const buttonsField = {
  type: "array" as const,
  max: 3,
  getItemSummary: (item: { label?: string }, index = 0) =>
    item.label || `Button ${index + 1}`,
  arrayFields: {
    ...buttonField.objectFields,
  },
  defaultItemProps: buttonDefaults,
};

// Badge field
export const badgeField = {
  type: "object" as const,
  objectFields: {
    label: { type: "text" as const, contentEditable: true },
    url: { type: "text" as const },
    variant: {
      type: "select" as const,
      options: [
        { label: "default", value: "default" },
        { label: "secondary", value: "secondary" },
        { label: "destructive", value: "destructive" },
        { label: "outline", value: "outline" },
      ],
    },
  },
};

export const badgeDefaults = {
  label: "Badge",
  url: "",
  variant: "default" as const,
};

// Image field
export const imageField = {
  type: "object" as const,
  objectFields: {
    src: { type: "text" as const },
    alt: { type: "text" as const },
  },
};

export const imageDefaults = {
  src: "",
  alt: "Image description",
};

// Images field - array of images
export const imagesField = {
  type: "array" as const,
  max: 10,
  getItemSummary: (item: { alt?: string; src?: string }, index = 0) => {
    if (item.alt) {
      return `${item.alt.slice(0, 12)}${item.alt.length > 12 ? "..." : ""}`;
    }
    return `Image ${index + 1}`;
  },
  arrayFields: {
    ...imageField.objectFields,
  },
  defaultItemProps: imageDefaults,
};

// Padding level field
const paddingLevelField = {
  type: "select" as const,
  options: [
    { label: "none", value: "none" },
    { label: "small", value: "small" },
    { label: "medium", value: "medium" },
    { label: "large", value: "large" },
  ],
};

// Padding field (top/bottom)
export const paddingField = {
  type: "object" as const,
  objectFields: {
    top: paddingLevelField,
    bottom: paddingLevelField,
  },
};

export const paddingDefaults = {
  top: "medium" as const,
  bottom: "medium" as const,
};

// Heading field
export const headingField = {
  type: "text" as const,
  contentEditable: true,
};

// Description field
export const descriptionField = {
  type: "textarea" as const,
  contentEditable: true,
};

// Features field - array of features with icons
export const featuresField = {
  type: "array" as const,
  max: 5,
  getItemSummary: (item: { name?: string }, index = 0) =>
    item.name || `Feature ${index + 1}`,
  arrayFields: {
    icon: iconField,
    name: { type: "text" as const, contentEditable: true },
    description: { type: "textarea" as const, contentEditable: true },
  },
  defaultItemProps: {
    icon: "check",
    name: "Feature name",
    description: "Description of the feature",
  },
};

// Content fields preset (heading, description, badge, buttons)
export const contentFields = {
  heading: headingField,
  description: descriptionField,
  badge: badgeField,
  buttons: buttonsField,
};

// Content fields with features preset
export const contentFieldsWithFeatures = {
  heading: headingField,
  description: descriptionField,
  badge: badgeField,
  features: featuresField,
  buttons: buttonsField,
};

// Helper to convert padding value to CSS
export const getPaddingValue = (level: string): string => {
  switch (level) {
    case "none":
      return "0";
    case "small":
      return "2rem"; // 32px
    case "medium":
      return "4rem"; // 64px
    case "large":
      return "6rem"; // 96px
    default:
      return "4rem";
  }
};
