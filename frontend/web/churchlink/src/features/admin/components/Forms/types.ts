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
  | "static"
  | "price";

export type Width = "full" | "half" | "third" | "quarter";

export type FormWidthOption = "100" | "85" | "70" | "55" | "40" | "25" | "15";

export const FORM_WIDTH_VALUES: FormWidthOption[] = ["100", "85", "70", "55", "40", "25", "15"];

export const DEFAULT_FORM_WIDTH: FormWidthOption = "55";

const LEGACY_FORM_WIDTH_MAP: Record<string, FormWidthOption> = {
  full: "100",
  "100": "100",
  "100%": "100",
  half: "55",
  "50": "55",
  "50%": "55",
  third: "40",
  "33": "40",
  "33%": "40",
  quarter: "25",
  "25%": "25",
};

export const normalizeFormWidth = (value?: string | null): FormWidthOption => {
  if (!value) return DEFAULT_FORM_WIDTH;
  const trimmed = String(value).trim();
  const normalized = trimmed.endsWith("%") ? trimmed.slice(0, -1) : trimmed;
  if (FORM_WIDTH_VALUES.includes(normalized as FormWidthOption)) {
    return normalized as FormWidthOption;
  }
  const legacyKey = normalized.toLowerCase();
  if (legacyKey in LEGACY_FORM_WIDTH_MAP) {
    return LEGACY_FORM_WIDTH_MAP[legacyKey];
  }
  return DEFAULT_FORM_WIDTH;
};

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
  price?: number; // optional price for this option
}

export interface SelectField extends BaseField {
  type: "select" | "radio";
  options: OptionItem[];
  multiple?: boolean; // only for select
}

export interface CheckboxField extends BaseField {
  type: "checkbox";
  defaultChecked?: boolean;
  price?: number; // price when checked
}

export interface SwitchField extends BaseField {
  type: "switch";
  price?: number;
  onText?: string;
  offText?: string;
}

export interface DateField extends BaseField {
  type: "date";
  minDate?: string;
  maxDate?: string;
  mode?: "single" | "range";
  pricing?: {
    enabled?: boolean;
    basePerDay?: number; // default price per selected day
    // per-weekday overrides (0=Sun..6=Sat)
    weekdayOverrides?: { 0?: number; 1?: number; 2?: number; 3?: number; 4?: number; 5?: number; 6?: number };
    // specific date overrides in yyyy-MM-dd for easy editing/serialization
    specificDates?: { date: string; price: number }[];
  };
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
  content?: string;
  as?: "p" | "h1" | "h2" | "h3" | "h4" | "small";
  color?: string; // CSS color string (e.g. #000000)
  bold?: boolean;
  underline?: boolean;
}

export interface PriceField extends BaseField {
  type: "price";
  amount: number; // flat amount to add to total when visible
  paymentMethods?: {
    allowPayPal?: boolean;
    allowInPerson?: boolean;
  };
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
  | StaticTextField
  | PriceField;

export interface FormSchemaMeta {
  title?: string;
  ministries?: string[];
  description?: string;
}

// Canonical form schema: top-level metadata with a single 'data' array
export interface FormSchema {
  title?: string;
  ministries?: string[];
  description?: string;
  // List of additional locales supported by this form (excluding default 'en')
  supported_locales?: string[];
  formWidth?: FormWidthOption;
  data: AnyField[];
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

export const formWidthToClass = (w?: string) => {
  const normalized = normalizeFormWidth(w);
  switch (normalized) {
    case "15":
      return "max-w-full lg:max-w-[15%]";
    case "25":
      return "max-w-full lg:max-w-[25%]";
    case "40":
      return "max-w-full lg:max-w-[40%]";
    case "55":
      return "max-w-full lg:max-w-[55%]";
    case "70":
      return "max-w-full lg:max-w-[70%]";
    case "85":
      return "max-w-full lg:max-w-[85%]";
    case "100":
    default:
      return "max-w-full";
  }
};

export const collectAvailableLocales = (schema: FormSchema | undefined | null): string[] => {
  if (!schema) return ['en'];
  const set = new Set<string>();
  set.add('en'); // English is always available as the default
  for (const l of schema.supported_locales || []) {
    if (l) set.add(l);
  }
  return Array.from(set);
};
