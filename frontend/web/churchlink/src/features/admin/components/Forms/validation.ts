import type { AnyField, FormSchema } from "./types";
import { normalizeDateOnly } from '@/helpers/DateHelper'

export interface BoundsViolation {
  fieldId: string;
  fieldName: string;
  fieldLabel?: string;
  message: string;
  type: string;
}

export interface OptionViolation {
  fieldId: string;
  fieldLabel: string;
  hasEmptyValues: boolean;
  hasEmptyLabels: boolean;
}
const toDate = (value: Date | string | undefined): Date | null => {
  const d = normalizeDateOnly(value as any);
  return d ?? null;
};

const toMinutes = (value: string | undefined): number | null => {
  if (!value) return null;
  const parts = value.split(":");
  if (parts.length !== 2) return null;
  const hours = Number(parts[0]);
  const minutes = Number(parts[1]);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  return hours * 60 + minutes;
};

const pushViolation = (
  arr: BoundsViolation[],
  field: AnyField,
  message: string
) => {
  arr.push({
    fieldId: field.id,
    fieldName: field.name,
    fieldLabel: field.label,
    message,
    type: field.type,
  });
};

export const getBoundsViolations = (schema: FormSchema | undefined | null): BoundsViolation[] => {
  if (!schema || !Array.isArray(schema.data)) return [];
  const violations: BoundsViolation[] = [];
  
  for (const field of schema.data) {
    switch (field.type) {
      case "number": {
        const min = (field as any).min;
        const max = (field as any).max;
        if (typeof min === "number" && typeof max === "number" && max <= min) {
          pushViolation(violations, field, "Max must be greater than min.");
        }
        break;
      }
      case "text":
      case "textarea":
      case "password": {
        const minLength = (field as any).minLength;
        const maxLength = (field as any).maxLength;
        if (typeof minLength === "number" && typeof maxLength === "number" && maxLength <= minLength) {
          pushViolation(violations, field, "Max length must be greater than min length.");
        }
        break;
      }
      case "time": {
        const minMinutes = toMinutes((field as any).minTime);
        const maxMinutes = toMinutes((field as any).maxTime);
        if (minMinutes !== null && maxMinutes !== null) {
          if (maxMinutes <= minMinutes) {
            pushViolation(violations, field, "Max time must be later than min time.");
          }
        }
        break;
      }
      case "date": {
        const minDate = toDate((field as any).minDate);
        const maxDate = toDate((field as any).maxDate);
        if (minDate && maxDate && maxDate.getTime() <= minDate.getTime()) {
          pushViolation(violations, field, "Max date must be after min date.");
        }
        break;
      }
      default:
        break;
    }
  }
  return violations;
};

export const getOptionViolations = (schema: FormSchema | undefined | null): OptionViolation[] => {
  if (!schema || !Array.isArray(schema.data)) return [];
  
  return (schema.data as AnyField[])
    .filter((f: any) => (f.type === 'select' || f.type === 'radio') && Array.isArray(f.options) && f.options.length > 0)
    .map((f: any) => {
      const emptyValues = (f.options || []).some((o: any) => {
        const val = (o?.value ?? '').toString().trim();
        return val === '';
      });
      const emptyLabels = (f.options || []).some((o: any) => {
        const lbl = (o?.label ?? '').toString().trim();
        return lbl === '';
      });
      return {
        fieldId: f.id,
        fieldLabel: f.label || f.name,
        hasEmptyValues: emptyValues,
        hasEmptyLabels: emptyLabels
      };
    })
    .filter((r) => r.hasEmptyValues || r.hasEmptyLabels);
};
