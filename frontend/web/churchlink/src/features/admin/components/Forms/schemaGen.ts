import { z } from "zod";
import validator from "validator";
import { format } from "date-fns";
import { normalizeDateOnly } from '@/helpers/DateHelper'
import { evaluateVisibility } from './visibilityUtils';
import type { AnyField, CheckboxField, DateField, NumberField, SelectField, TextField, FormSchema, EmailField, PasswordField, UrlField, TelField } from "./types";

const trimString = (val: unknown): unknown => (typeof val === "string" ? val.trim() : val);
const emptyStringToUndefined = (val: unknown): unknown => {
  if (typeof val !== "string") return val;
  const trimmed = val.trim();
  return trimmed.length === 0 ? undefined : trimmed;
};

const PHONE_MAX_DIGITS = 10;
const NON_DIGIT_REGEX = /\D/g;

const normalizePhoneDigits = (val: unknown): string => {
  if (typeof val !== "string") return "";
  return val.replace(NON_DIGIT_REGEX, "").slice(0, PHONE_MAX_DIGITS);
};

const phoneDigitsOrUndefined = (val: unknown): string | undefined => {
  const digits = normalizePhoneDigits(val);
  return digits.length === 0 ? undefined : digits;
};


const truncateToDate = (value: Date | undefined): Date | null => {
  if (!value) return null;
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
};

const describeDate = (value: string | Date | undefined): string => {
  const normalized = normalizeDateOnly(value);
  return normalized ? format(normalized, "PPP") : "the specified date";
};

const parseAllowedNumbers = (allowedValues?: string): number[] => {
  if (!allowedValues) return [];
  return allowedValues
    .split(",")
    .map((x) => x.trim())
    .filter((x) => x.length > 0)
    .map((x) => Number(x))
    .filter((n) => !Number.isNaN(n));
};

const normalizeNumberInput = (val: unknown): number | undefined => {
  if (val === undefined || val === null) return undefined;
  if (typeof val === "number") {
    return Number.isNaN(val) ? Number.NaN : val;
  }
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed.length === 0) return undefined;
    const parsed = Number(trimmed);
    return Number.isNaN(parsed) ? Number.NaN : parsed;
  }
  return Number.NaN;
};

const formatNumberValue = (n: number): string => {
  return Number.isInteger(n) ? n.toFixed(0) : n.toString();
};

export function fieldToZod(field: AnyField, enforceRequired: boolean = true): z.ZodTypeAny {
  switch (field.type) {
    case "text":
    case "textarea": {
      const f = field as TextField;
      const label = field.label || field.name || "Field";

      let base = z.string();
      if (f.minLength != null) base = base.min(f.minLength);
      if (f.maxLength != null) base = base.max(f.maxLength);
      if (f.pattern) base = base.regex(new RegExp(f.pattern));

      if (f.required && enforceRequired) {
        return base.min(1, { message: `${label} is required` });
      }

      return z.preprocess(emptyStringToUndefined, base.optional());
    }
    case "email": {
      let s = z.string().email({ message: "Invalid email address" });
      const f = field as EmailField;
      if (!f.required || !enforceRequired) s = s.optional() as any;
      return s;
    }
    case "password": {
      let s = z.string();
      const f = field as PasswordField;
      if (f.required && enforceRequired) s = s.min(1, { message: `${field.label || field.name} is required` });
      if (f.minLength != null) s = s.min(f.minLength);
      if (f.maxLength != null) s = s.max(f.maxLength);
      if (f.requireUpper) s = s.regex(/[A-Z]/, { message: "Must include an uppercase letter" });
      if (f.requireLower) s = s.regex(/[a-z]/, { message: "Must include a lowercase letter" });
      if (f.requireNumber) s = s.regex(/[0-9]/, { message: "Must include a number" });
      if (f.requireSpecial) s = s.regex(/[^A-Za-z0-9]/, { message: "Must include a special character" });
      return s;
    }
    case "url": {
      const f = field as UrlField;
      const label = field.label || field.name || "URL";
      const urlMessage = "Invalid URL";
      const validatorOptions: validator.IsURLOptions = {
        protocols: ["http", "https"],
        require_protocol: true,
        require_valid_protocol: true,
        allow_underscores: true,
        allow_trailing_dot: false,
      };

      if (f.required && enforceRequired) {
        return z.preprocess(
          trimString,
          z
            .string()
            .min(1, { message: `${label} is required` })
            .refine((val) => validator.isURL(val, validatorOptions), {
              message: urlMessage,
            })
        );
      }

      return z.preprocess(
        emptyStringToUndefined,
        z
          .string()
          .refine((val) => validator.isURL(val, validatorOptions), {
            message: urlMessage,
          })
          .optional()
      );
    }
    case "tel": {
      const f = field as TelField;
      const label = field.label || field.name || "Phone";
      const phoneMessage = "Invalid phone number";

      if (f.required && enforceRequired) {
        return z.preprocess(
          (val) => {
            const digits = normalizePhoneDigits(trimString(val));
            return digits;
          },
          z
            .string()
            .min(1, { message: `${label} is required` })
            .refine((val) => validator.isMobilePhone(val, "any"), {
              message: phoneMessage,
            })
        );
      }

      return z.preprocess(
        (val) => phoneDigitsOrUndefined(emptyStringToUndefined(val)),
        z
          .string()
          .refine((val) => validator.isMobilePhone(val, "any"), {
            message: phoneMessage,
          })
          .optional()
      );
    }
    case "number": {
      const f = field as NumberField;
      const label = field.label || field.name || "Number";
      const allowed = parseAllowedNumbers(f.allowedValues);
      const base = z.preprocess(
        normalizeNumberInput,
        z.union([z.number(), z.undefined()])
      );
      return base.superRefine((val, ctx) => {
        if (typeof val === "number" && Number.isNaN(val)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be a number` });
          return;
        }
        if (val === undefined) {
          if (f.required && enforceRequired) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} is required` });
          }
          return;
        }
        const num = val as number;
        if (f.min != null && num < f.min) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be >= ${formatNumberValue(f.min)}` });
        }
        if (f.max != null && num > f.max) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must be <= ${formatNumberValue(f.max)}` });
        }
        if (allowed.length > 0 && !allowed.includes(num)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `${label} must be one of: ${allowed.map(formatNumberValue).join(", ")}`,
          });
        }
      });
    }

    case "checkbox": {
      const f = field as CheckboxField;
      if (f.required && enforceRequired) {
        return z.literal(true, { message: `${field.label || field.name} must be checked` } as any);
      }
      return z.boolean().optional();
    }
    case "switch": {
      if (field.required && enforceRequired) {
        return z.literal(true, { message: `${field.label || field.name} must be enabled` } as any);
      }
      return z.boolean().optional();
    }
    case "select": {
      const f = field as SelectField;
      if (f.multiple) {
        if (f.required && enforceRequired) {
          return z.array(z.string()).min(1, `${field.label || field.name} is required`);
        }
        return z.array(z.string()).optional();
      }
      let s: z.ZodType<string | undefined> = z.string().optional();
      if (f.required && enforceRequired) s = z.string().min(1, `${field.label || field.name} is required`);
      return s;
    }
    case "radio": {
      let s: z.ZodType<string | undefined> = z.string().optional();
      if (field.required && enforceRequired) s = z.string().min(1, `${field.label || field.name} is required`);
      return s;
    }
    case "date": {
      const f = field as DateField;
      const label = field.label || field.name;

      if (f.mode === "range") {
        // Range mode: value is { from?: Date; to?: Date } | undefined
        let s = z
          .object({
            from: z.date().optional(),
            to: z.date().optional(),
          })
          .optional();

        // If required, both from and to must be provided (only if enforceRequired)
        if (f.required && enforceRequired) {
          s = s.refine((v) => !!v && !!v.from && !!v.to, {
            message: `${label} is required`,
          });
        }

        // Order check when both present: from <= to
        s = s.refine((v) => !v || !v.from || !v.to || v.to.getTime() >= v.from.getTime(), {
          message: `${label} end date must be on or after start date`,
        });

        // Min/Max checks for whichever endpoints exist
        const min = normalizeDateOnly(f.minDate);
        if (min) {
          const message = `${label} must be on or after ${describeDate(f.minDate)}`;
          s = s.refine((v) => {
            if (!v) return true;
            const from = truncateToDate(v.from);
            const to = truncateToDate(v.to);
            return (!from || from.getTime() >= min.getTime()) && (!to || to.getTime() >= min.getTime());
          }, { message });
        }
        const max = normalizeDateOnly(f.maxDate);
        if (max) {
          const message = `${label} must be on or before ${describeDate(f.maxDate)}`;
          s = s.refine((v) => {
            if (!v) return true;
            const from = truncateToDate(v.from);
            const to = truncateToDate(v.to);
            return (!from || from.getTime() <= max.getTime()) && (!to || to.getTime() <= max.getTime());
          }, { message });
        }

        return s;
      }

      // Single-date mode: value is a Date or undefined
      let s: z.ZodType<Date | undefined> = z.date().optional();
      if (f.required && enforceRequired) s = z.date();
      const min = normalizeDateOnly(f.minDate);
      if (min)
        s = s.refine((v: Date | undefined) => {
          const normalized = truncateToDate(v ?? undefined);
          return !normalized || normalized.getTime() >= min.getTime();
        }, {
          message: `${label} must be on or after ${describeDate(f.minDate)}`,
        });
      const max = normalizeDateOnly(f.maxDate);
      if (max)
        s = s.refine((v: Date | undefined) => {
          const normalized = truncateToDate(v ?? undefined);
          return !normalized || normalized.getTime() <= max.getTime();
        }, {
          message: `${label} must be on or before ${describeDate(f.maxDate)}`,
        });
      return s;
    }
    case "time": {
      // Store as string HH:MM, validate range if provided
      let s: z.ZodType<string | undefined> = z
        .string()
        .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time (HH:MM)" })
        .optional();
      const f: any = field as any;
      if (f.required && enforceRequired) s = z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, { message: "Invalid time (HH:MM)" });
      const toMinutes = (t: string) => {
        const [h, m] = t.split(":").map(Number);
        return h * 60 + m;
      };
      if (f.minTime)
        s = s.refine((v) => !v || toMinutes(v) >= toMinutes(f.minTime), { message: `${field.label || field.name} must be on/after ${f.minTime}` });
      if (f.maxTime)
        s = s.refine((v) => !v || toMinutes(v) <= toMinutes(f.maxTime), { message: `${field.label || field.name} must be on/before ${f.maxTime}` });
      return s;
    }
    case "color": {
      // simple #RRGGBB or #RGB pattern
      let s: z.ZodType<string | undefined> = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, { message: "Invalid color" }).optional();
      if (field.required && enforceRequired) s = z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, { message: "Invalid color" });
      return s;
    }
    case "static": {
      // No user input; not included in form values
      return z.any().optional();
    }
    case "price": {
      return z.any().optional();
    }
    case "pricelabel": {
      return z.any().optional(); // Display-only field, no validation needed
    }
    default:
      return z.any();
  }
}

export function schemaToZodObject(schema: FormSchema) {
  const shape: Record<string, z.ZodTypeAny> = {};

  // Create validators without enforcing required validation
  // (all required validation will be handled in superRefine with visibility awareness)
  for (const f of schema.data) {
    const fieldZod = fieldToZod(f, false); // Don't enforce required in base validators
    shape[f.name] = fieldZod;

    // Add payment method field for price fields that allow both payment methods
    if (f.type === "price") {
      const priceField = f as any;
      const allowPayPal = priceField.paymentMethods?.allowPayPal !== false;
      const allowInPerson = priceField.paymentMethods?.allowInPerson !== false;

      // Only add payment method field if both methods are enabled (user needs to choose)
      if (allowPayPal && allowInPerson) {
        shape[`${f.name}_payment_method`] = z.enum(['paypal', 'in-person']).default('paypal');
      }
    }
  }

  // Create object with base schema, then apply visibility-aware validation
  let zodObj = z.object(shape);

  // Apply visibility-aware validation: required fields should only be validated if visible
  zodObj = zodObj.superRefine((data, ctx) => {
    for (const field of schema.data) {
      // Skip non-required fields
      if (!field.required) continue;

      // Determine if field is visible
      const isVisible = evaluateVisibility(field.visibleIf, data);

      // Only validate required constraint if field is visible
      if (isVisible) {
        const value = (data as any)[field.name];

        // Check for emptiness based on field type
        let isEmpty = false;

        if (field.type === 'checkbox' || field.type === 'switch') {
          // For boolean fields, required means must be true
          isEmpty = value !== true;
        } else if (field.type === 'select' && (field as SelectField).multiple) {
          // For multi-select, check if array is empty
          isEmpty = !Array.isArray(value) || value.length === 0;
        } else if (field.type === 'date' && (field as DateField).mode === 'range') {
          // For date range, both from and to must be present
          isEmpty = !value || !value.from || !value.to;
        } else {
          // For all other types, check standard emptiness
          isEmpty = value === undefined || value === null || value === '' ||
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === 'object' && value !== null && Object.keys(value).length === 0);
        }

        if (isEmpty) {
          const label = field.label || field.name;
          let message = `${label} is required`;

          // Customize message for specific field types
          if (field.type === 'checkbox') {
            message = `${label} must be checked`;
          } else if (field.type === 'switch') {
            message = `${label} must be enabled`;
          }

          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field.name],
            message,
          });
        }
      }
    }
  });

  return zodObj;
}
