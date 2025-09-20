import { z } from "zod";
import type { AnyField, CheckboxField, DateField, NumberField, SelectField, TextField, FormSchema } from "./types";

export function fieldToZod(field: AnyField): z.ZodTypeAny {
  switch (field.type) {
    case "text":
    case "textarea": {
      let s = z.string();
      const f = field as TextField;
      if (f.required) s = s.min(1, { message: `${field.label || field.name} is required` });
      if (f.minLength != null) s = s.min(f.minLength);
      if (f.maxLength != null) s = s.max(f.maxLength);
      if (f.pattern) s = s.regex(new RegExp(f.pattern));
      return s;
    }
    case "number": {
      let s = z.coerce.number();
      const f = field as NumberField;
  if (f.required) s = s.refine((v: unknown) => v !== undefined && v !== null && !Number.isNaN(v as number), `${field.label || field.name} is required`);
      if (f.min != null) s = s.min(f.min);
      if (f.max != null) s = s.max(f.max);
      return s;
    }
    case "checkbox": {
      const f = field as CheckboxField;
      if (f.required) {
        return z.literal(true, { message: `${field.label || field.name} must be checked` } as any);
      }
      return z.boolean().optional();
    }
    case "select": {
      const f = field as SelectField;
      if (f.multiple) {
        let s = z.array(z.string());
        if (f.required) s = s.min(1, `${field.label || field.name} is required`);
        return s;
      }
      let s: z.ZodType<string | undefined> = z.string().optional();
      if (f.required) s = z.string().min(1, `${field.label || field.name} is required`);
      return s;
    }
    case "radio": {
      let s: z.ZodType<string | undefined> = z.string().optional();
      if (field.required) s = z.string().min(1, `${field.label || field.name} is required`);
      return s;
    }
    case "date": {
      const f = field as DateField;
      const label = field.label || field.name;

      // Helper to compare YYYY-MM-DD strings lexicographically, avoiding timezone issues
      const gte = (a: string, b: string) => a >= b;
      const lte = (a: string, b: string) => a <= b;

      if (f.mode === "range") {
        // Range mode: value is { from?: string; to?: string } | undefined
        let s = z
          .object({
            from: z.string().optional(),
            to: z.string().optional(),
          })
          .optional();

        // If required, both from and to must be provided
        if (f.required) {
          s = s.refine((v) => !!v && !!v.from && !!v.to, {
            message: `${label} is required`,
          });
        }

        // Order check when both present: from <= to
        s = s.refine((v) => !v || !v.from || !v.to || gte(v.to, v.from), {
          message: `${label} end date must be on or after start date`,
        });

        // Min/Max checks for whichever endpoints exist
        if (f.minDate) {
          const min = f.minDate;
          s = s.refine((v) => !v || (!v.from || gte(v.from, min)) && (!v.to || gte(v.to, min)), {
            message: `${label} must be on or after ${f.minDate}`,
          });
        }
        if (f.maxDate) {
          const max = f.maxDate;
          s = s.refine((v) => !v || (!v.from || lte(v.from, max)) && (!v.to || lte(v.to, max)), {
            message: `${label} must be on or before ${f.maxDate}`,
          });
        }

        return s;
      }

      // Single-date mode: value is a string (YYYY-MM-DD) or undefined
      let s: z.ZodType<string | undefined> = z.string().optional();
      if (f.required) s = z.string().min(1, `${label} is required`);
      if (f.minDate)
        s = s.refine((v: string | undefined) => !v || gte(v, f.minDate!), {
          message: `${label} must be on or after ${f.minDate}`,
        });
      if (f.maxDate)
        s = s.refine((v: string | undefined) => !v || lte(v, f.maxDate!), {
          message: `${label} must be on or before ${f.maxDate}`,
        });
      return s;
    }
    default:
      return z.any();
  }
}

export function schemaToZodObject(schema: FormSchema) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const f of schema.fields) {
    shape[f.name] = fieldToZod(f);
  }
  return z.object(shape);
}
