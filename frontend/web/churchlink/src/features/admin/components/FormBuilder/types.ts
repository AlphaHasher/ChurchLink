// Schema types for the form builder
// These define the persisted JSON and runtime props

export type FieldType =
  | "text"
  | "textarea"
  | "number"
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
}

export interface TextField extends BaseField {
  type: "text" | "textarea";
  minLength?: number;
  maxLength?: number;
  pattern?: string;
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

export interface DateField extends BaseField {
  type: "date";
  minDate?: Date;
  maxDate?: Date;
  mode?: "single" | "range";
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
  | SelectField
  | CheckboxField
  | DateField
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
