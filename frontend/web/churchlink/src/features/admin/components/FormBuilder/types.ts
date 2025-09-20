// Schema types for the form builder
// These define the persisted JSON and runtime props

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "password"
  | "url"
  | "tel"
  | "switch"
  | "time"
  | "color"
  | "select"
  | "checkbox"
  | "radio"
  | "date"
  | "static";

export type Width = "full" | "half" | "third" | "quarter";

export interface BaseField {
  id: string;
  type: FieldType;
  name: string; // form key
  label: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  width?: Width;
  visibleIf?: string;
}

export interface NumberField extends BaseField {
  type: "number";
  min?: number;
  max?: number;
  step?: number;
  // Comma-separated list of allowed numeric values, e.g., "6, 11, 42"
  allowedValues?: string;
}

export interface TextField extends BaseField {
  type: "text" | "textarea";
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export interface EmailField extends BaseField {
  type: "email";
}

export interface PasswordField extends BaseField {
  type: "password";
  minLength?: number;
  maxLength?: number;
  requireUpper?: boolean;
  requireLower?: boolean;
  requireNumber?: boolean;
  requireSpecial?: boolean;
}

export interface UrlField extends BaseField {
  type: "url";
}

export interface TelField extends BaseField {
  type: "tel";
}

export interface OptionItem {
  label: string;
  value: string;
}

export interface SelectField extends BaseField {
  type: "select" | "radio";
  options: OptionItem[];
  multiple?: boolean; // only for select
}

export interface CheckboxField extends BaseField {
  type: "checkbox";
  defaultChecked?: boolean;
}

export interface SwitchField extends BaseField {
  type: "switch";
}

export interface DateField extends BaseField {
  type: "date";
  minDate?: Date;
  maxDate?: Date;
  mode?: "single" | "range";
}

export interface TimeField extends BaseField {
  type: "time";
  minTime?: string; // HH:MM
  maxTime?: string; // HH:MM
}

export interface ColorField extends BaseField {
  type: "color";
}

export interface StaticTextField extends BaseField {
  type: "static";
  content: string;
  as?: "p" | "h1" | "h2" | "h3" | "h4" | "small";
  color?: string; // CSS color string (e.g. #000000)
  bold?: boolean;
  underline?: boolean;
}

export type AnyField =
  | NumberField
  | TextField
  | EmailField
  | PasswordField
  | UrlField
  | TelField
  | SelectField
  | CheckboxField
  | SwitchField
  | DateField
  | TimeField
  | ColorField
  | StaticTextField;

export interface FormSchemaMeta {
  title?: string;
  description?: string;
}

export interface FormSchema {
  meta: FormSchemaMeta;
  fields: AnyField[];
}

export const widthToCols = (w?: Width) => {
  switch (w) {
    case "quarter":
      return "sm:col-span-3";
    case "third":
      return "sm:col-span-4";
    case "half":
      return "sm:col-span-6";
    case "full":
    default:
      return "sm:col-span-12";
  }
};
