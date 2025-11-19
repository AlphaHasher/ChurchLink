import { nanoid } from "nanoid";
import { create } from "zustand";
import type { AnyField, FormSchema, FieldType, OptionItem } from "./types";
import { normalizeFormWidth, DEFAULT_FORM_WIDTH } from "./types";

const DEFAULT_META = { title: "Untitled Form", description: "" };

const PAYMENT_FIELD_TYPE: FieldType = "price";

const hasPricingFields = (fields: AnyField[]): boolean => {
  return fields.some((field) => {
    if (field.type === "pricelabel") return true;
    if ((field.type === "checkbox" || field.type === "switch") && (field as any).price != null) return true;
    if ((field.type === "radio" || field.type === "select") && (field as any).options?.some((option: any) => option?.price != null)) return true;
    if (field.type === "date" && (field as any).pricing?.enabled) return true;
    return false;
  });
};

const sumPricelabelTotals = (fields: AnyField[]): number => {
  return fields
    .filter((field) => field.type === "pricelabel")
    .reduce((total, field) => {
      const amount = (field as any).amount;
      return total + (typeof amount === "number" && !Number.isNaN(amount) ? amount : 0);
    }, 0);
};

const separatePaymentField = (fields: AnyField[]) => {
  const nonPaymentFields: AnyField[] = [];
  let paymentField: AnyField | null = null;

  for (const field of fields) {
    if (field.type === PAYMENT_FIELD_TYPE) {
      if (!paymentField) {
        paymentField = field;
      }
      continue;
    }
    nonPaymentFields.push(field);
  }

  return { nonPaymentFields, paymentField };
};

// Keeps the auto-managed payment field in sync with pricing-enabled fields.
const syncPaymentField = (fields: AnyField[]): AnyField[] => {
  const { nonPaymentFields, paymentField } = separatePaymentField(fields);

  if (!hasPricingFields(nonPaymentFields)) {
    return nonPaymentFields;
  }

  const ensuredPaymentField: AnyField = paymentField ? { ...paymentField } : (newField("price") as AnyField);
  const updatedTotal = sumPricelabelTotals(nonPaymentFields);

  if (ensuredPaymentField.type === PAYMENT_FIELD_TYPE) {
    (ensuredPaymentField as any).amount = updatedTotal;
  }

  return [...nonPaymentFields, ensuredPaymentField];
};

// Ensures new fields land above the payment field so it remains at the bottom.
const insertBeforePaymentField = (fields: AnyField[], fieldToInsert: AnyField): AnyField[] => {
  const paymentIndex = fields.findIndex((field) => field.type === PAYMENT_FIELD_TYPE);
  if (paymentIndex === -1) {
    return [...fields, fieldToInsert];
  }

  return [
    ...fields.slice(0, paymentIndex),
    fieldToInsert,
    ...fields.slice(paymentIndex),
  ];
};

export type BuilderState = {
  schema: FormSchema;
  selectedId?: string;
  activeLocale: string; // current preview/edit locale
  translations: {
    [fieldId: string]: {
      [locale: string]: {
        label?: string;
        placeholder?: string;
        options?: { [optionIdx: number]: string };
        helpText?: string;
        content?: string;
      };
    };
  };
  customLocales: Set<string>; // Track manually-entered locales (excluded from bulk translate)
  modifiedFields: Set<string>; // Track field IDs that have been modified since last translation
  select: (id?: string) => void;
  addField: (type: FieldType) => void;
  removeField: (id: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  updateField: (id: string, patch: Partial<AnyField>) => void;
  updateOptions: (id: string, options: OptionItem[]) => void;
  setSchema: (schema: FormSchema) => void;
  setActiveLocale: (locale: string) => void;
  addLocale: (locale: string) => void;
  removeLocale: (locale: string) => void;
  updateSchemaMeta: (patch: Partial<FormSchema>) => void;
  setTranslations: (fieldId: string, locale: string, property: string, value: string) => void;
  setTranslationsIfEmpty: (fieldId: string, locale: string, property: string, value: string) => boolean;
  loadTranslations: (allTranslations: {
    [fieldId: string]: {
      [locale: string]: {
        label?: string;
        placeholder?: string;
        options?: { [optionIdx: number]: string };
        helpText?: string;
        content?: string;
      };
    };
  }) => void;
  addCustomLocale: (locale: string) => void;
  removeCustomLocale: (locale: string) => void;
  clearCustomLocales: (locales: string[]) => void;
  markFieldModified: (fieldId: string) => void;
  clearModifiedFields: (fieldIds?: string[]) => void;
};

const newField = (type: FieldType): AnyField => {
  const id = nanoid(8);
  const base = {
    id,
    type,
    name: `${type}_${id}`,
    label: `${type[0].toUpperCase()}${type.slice(1)} Field`,
    width: "full" as const,
    required: false,
  };
  switch (type) {
    case "text":
      return { ...base, type: "text", placeholder: "Enter text" };
    case "email":
      return { ...base, type: "email", placeholder: "you@example.com" } as any;
    case "url":
      return { ...base, type: "url", placeholder: "https://" } as any;
    case "tel":
      return { ...base, type: "tel", placeholder: "(555) 123-4567" } as any;
    case "textarea":
      return { ...base, type: "textarea", placeholder: "Enter long text" };
    case "number":
      return { ...base, type: "number", placeholder: "0", allowedValues: "" } as any;
    case "checkbox":
      return { ...base, type: "checkbox" };
    case "switch":
      return { ...base, type: "switch", placeholder: "On/Off" } as any;
    case "select":
      return { ...base, type: "select", options: [{ label: "Option 1", value: "option1" }] } as AnyField;
    case "radio":
      return { ...base, type: "radio", options: [{ label: "Option 1", value: "option1" }] } as AnyField;
    case "date":
      return { ...base, type: "date" };
    case "time":
      return { ...base, type: "time", placeholder: "HH:MM" } as any;
    case "static":
      return { ...base, type: "static", name: `static_${id}`, label: "Static Text", as: "p" } as any;
    case "pricelabel":
      return { ...base, type: "pricelabel", label: "Price Item", amount: 5 } as any;
    case "price":
      return { ...base, type: "price", label: "Payment Method", amount: 0, paymentMethods: { 'allowInPerson': true, allowPayPal: true } } as any;
    default:
      return { ...base, type: "text", placeholder: "Enter text" };
  }
};

export const useBuilderStore = create<BuilderState>((set, get) => ({
  schema: { title: DEFAULT_META.title, description: DEFAULT_META.description, supported_locales: [], formWidth: DEFAULT_FORM_WIDTH, data: [] },
  selectedId: undefined,
  activeLocale: 'en',
  translations: {},
  customLocales: new Set(),
  modifiedFields: new Set(),
  select: (id?: string) => set({ selectedId: id }),
  addField: (type: FieldType) => set((s) => {
    if (type === PAYMENT_FIELD_TYPE) {
      return s;
    }

    const createdField = newField(type);
    const insertedFields = insertBeforePaymentField(s.schema.data, createdField);
    const normalizedFields = syncPaymentField(insertedFields);

    return { schema: { ...s.schema, data: normalizedFields } };
  }),
  removeField: (id: string) => set((s) => {
    const fieldToRemove = s.schema.data.find(f => f.id === id);
    if (fieldToRemove?.type === PAYMENT_FIELD_TYPE) {
      return s;
    }

    const filteredFields = s.schema.data.filter((f) => f.id !== id);
    const normalizedFields = syncPaymentField(filteredFields);

    return {
      schema: { ...s.schema, data: normalizedFields },
      selectedId: s.selectedId === id ? undefined : s.selectedId,
    };
  }),
  reorder: (from: number, to: number) => set((s) => {
    // Prevent reordering the Payment Method field
    const fromField = s.schema.data[from];
    const toField = s.schema.data[to];

    // If either field is a price field, don't allow reordering
    if (fromField?.type === PAYMENT_FIELD_TYPE || toField?.type === PAYMENT_FIELD_TYPE) {
      return s;
    }

    const arr = [...s.schema.data];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    return { schema: { ...s.schema, data: arr } };
  }),
  updateField: (id: string, patch: Partial<AnyField>) => set((s) => {
    const field = s.schema.data.find((f) => f.id === id);
    const shouldMarkModified = Boolean(
      field && (
        patch.label !== undefined ||
        patch.placeholder !== undefined ||
        (patch as any).content !== undefined
      )
    );

    const updatedFields = s.schema.data.map((f) =>
      f.id === id ? ({ ...f, ...(patch as any) } as AnyField) : f
    ) as AnyField[];

    const normalizedFields = syncPaymentField(updatedFields);

    return {
      schema: {
        ...s.schema,
        data: normalizedFields,
      },
      modifiedFields: shouldMarkModified
        ? new Set([...s.modifiedFields, id])
        : s.modifiedFields,
    };
  }),
  updateOptions: (id: string, options: OptionItem[]) => set((s) => {
    const updatedFields = s.schema.data.map((f) =>
      f.id === id ? ({ ...f, options } as AnyField) : f
    ) as AnyField[];

    const normalizedFields = syncPaymentField(updatedFields);

    return {
      schema: {
        ...s.schema,
        data: normalizedFields,
      },
      modifiedFields: new Set([...s.modifiedFields, id]),
    };
  }),
  setSchema: (schema) => {
    const cleanedData = syncPaymentField(schema.data);

    return set({
      schema: {
        ...schema,
        data: cleanedData,
        supported_locales: schema.supported_locales || [],
        formWidth: normalizeFormWidth((schema as any)?.formWidth ?? (schema as any)?.form_width),
      },
      activeLocale: 'en',
    });
  },
  setActiveLocale: (locale: string) => set({ activeLocale: locale }),
  updateSchemaMeta: (patch) => set((s) => {
    const next: Partial<FormSchema> = { ...patch };
    if (Object.prototype.hasOwnProperty.call(next, 'formWidth')) {
      next.formWidth = normalizeFormWidth((next as any).formWidth as string | null | undefined);
    }
    return { schema: { ...s.schema, ...next } };
  }),
  addLocale: (locale: string) => set((s) => {
    const existing = new Set([...(s.schema.supported_locales || [])]);
    // avoid adding if already present
    if (locale === 'en') return { schema: { ...s.schema } };
    existing.add(locale);
    return { schema: { ...s.schema, supported_locales: Array.from(existing) } };
  }),
  removeLocale: (locale: string) => set((s) => ({
    schema: { ...s.schema, supported_locales: (s.schema.supported_locales || []).filter((l: string) => l !== locale) },
    // If removing currently active locale, fallback to default 'en'
    activeLocale: get().activeLocale === locale ? 'en' : get().activeLocale,
  })),
  setTranslations: (fieldId: string, locale: string, property: string, value: string) => set((s) => {
    const fieldTrans = s.translations[fieldId] || {};
    const localeTrans = fieldTrans[locale] || {};

    // Check if this is a price field - price fields should never be marked as custom
    const field = s.schema.data.find((f: AnyField) => f.id === fieldId);
    const isPriceField = field?.type === 'price';

    // Ensure the locale is tracked as a custom (manually-entered) locale (except for price fields)
    const newCustom = new Set(s.customLocales);
    if (!isPriceField) {
      newCustom.add(locale);
    }

    // If property is option_N, store in options object (overwrite unconditionally)
    const optionMatch = property.match(/^option_(\d+)$/);
    if (optionMatch) {
      const idx = Number(optionMatch[1]);
      const options = { ...(localeTrans.options || {}) };
      options[idx] = value;
      return {
        translations: {
          ...s.translations,
          [fieldId]: {
            ...fieldTrans,
            [locale]: {
              ...localeTrans,
              options,
            },
          },
        },
        customLocales: newCustom,
      };
    } else {
      // Set standard properties unconditionally
      const allowedProperties = [
        'label', 'placeholder', 'helpText', 'content',
        // Price field payment method properties
        'paypal_required', 'paypal_description', 'paypal_option', 'paypal_hint',
        'inperson_required', 'inperson_description', 'inperson_option', 'inperson_hint',
        'choose_method', 'no_methods', 'paypal_submit', 'inperson_submit'
      ];

      if (allowedProperties.includes(property)) {
        return {
          translations: {
            ...s.translations,
            [fieldId]: {
              ...fieldTrans,
              [locale]: {
                ...localeTrans,
                [property]: value,
              },
            },
          },
          customLocales: newCustom,
        };
      } else {
        // Ignore unsupported properties
        return {};
      }
    }
  }),
  setTranslationsIfEmpty: (fieldId: string, locale: string, property: string, value: string) => {
    let didSet = false;
    set((s) => {
      const fieldTrans = s.translations[fieldId] || {};
      const localeTrans = fieldTrans[locale] || {};
      const optionMatch = property.match(/^option_(\d+)$/);
      if (optionMatch) {
        const idx = Number(optionMatch[1]);
        const options = { ...(localeTrans.options || {}) };
        if (!options.hasOwnProperty(idx) || !options[idx]) {
          options[idx] = value;
          didSet = true;
          return {
            translations: {
              ...s.translations,
              [fieldId]: {
                ...fieldTrans,
                [locale]: {
                  ...localeTrans,
                  options,
                },
              },
            },
          };
        }
        return {};
      } else {
        if (property === 'label' || property === 'placeholder' || property === 'helpText' || property === 'content') {
          const localeTransAny = localeTrans as Record<string, any>;
          if (!localeTransAny[property] || String(localeTransAny[property]).trim().length === 0) {
            didSet = true;
            return {
              translations: {
                ...s.translations,
                [fieldId]: {
                  ...fieldTrans,
                  [locale]: {
                    ...localeTrans,
                    [property]: value,
                  },
                },
              },
            };
          }
        }
        return {};
      }
    });
    return didSet;
  },
  loadTranslations: (allTranslations) => set({ translations: allTranslations }),
  addCustomLocale: (locale: string) => set((s) => {
    const newCustom = new Set(s.customLocales);
    newCustom.add(locale);
    return { customLocales: newCustom };
  }),
  removeCustomLocale: (locale: string) => set((s) => {
    const newCustom = new Set(s.customLocales);
    newCustom.delete(locale);
    return { customLocales: newCustom };
  }),
  clearCustomLocales: (locales: string[]) => set((s) => {
    const newCustom = new Set(s.customLocales);
    locales.forEach(locale => newCustom.delete(locale));
    return { customLocales: newCustom };
  }),
  markFieldModified: (fieldId: string) => set((s) => {
    const newModified = new Set(s.modifiedFields);
    newModified.add(fieldId);
    return { modifiedFields: newModified };
  }),
  clearModifiedFields: (fieldIds?: string[]) => set((s) => {
    if (!fieldIds) {
      return { modifiedFields: new Set() };
    }
    const newModified = new Set(s.modifiedFields);
    fieldIds.forEach(id => newModified.delete(id));
    return { modifiedFields: newModified };
  }),
}));
