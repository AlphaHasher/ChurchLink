export type FieldDefinition = {
  name: string;      // dot-path: "badge.label", "heading"
  label: string;
  type: "text" | "textarea" | "select" | "radio" | "number" | "color" | "fontFamily" | "icon";
  options?: Array<{ label: string; value: string }>;
  min?: number;
  max?: number;
  contentEditable?: boolean;
};

export type FieldGroup = {
  name: string;           // "Heading", "Buttons"
  icon?: string;          // lucide icon name
  fields: FieldDefinition[];
  isArray?: boolean;
  arrayConfig?: {
    maxItems: number;
    itemLabelField: string;
    defaultItem: Record<string, unknown>;
    fields?: FieldDefinition[];  // Fields for each array item
  };
  isCustom?: boolean;     // true for special fields like Translations
};

export type ComponentGroupConfig = {
  groups: FieldGroup[];
};
