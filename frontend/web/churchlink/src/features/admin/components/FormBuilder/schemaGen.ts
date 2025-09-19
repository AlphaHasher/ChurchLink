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
      let s: z.ZodType<string | undefined> = z.string().optional();
      const f = field as DateField;
      if (f.required) s = z.string().min(1, `${field.label || field.name} is required`);
      if (f.minDate)
        s = s.refine((v: string | undefined) => !v || new Date(v) >= new Date(f.minDate!), {
          message: `${field.label || field.name} must be on or after ${f.minDate}`,
        });
      if (f.maxDate)
        s = s.refine((v: string | undefined) => !v || new Date(v) <= new Date(f.maxDate!), {
          message: `${field.label || field.name} must be on or before ${f.maxDate}`,
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
