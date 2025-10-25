import { nanoid } from "nanoid";
import { create } from "zustand";
import type { AnyField, FormSchema, FieldType, OptionItem } from "./types";
import { normalizeFormWidth, DEFAULT_FORM_WIDTH } from "./types";

const DEFAULT_META = { title: "Untitled Form", description: "" };

export type BuilderState = {
  schema: FormSchema;
  selectedId?: string;
  activeLocale: string; // current preview/edit locale
  translations: { [fieldId: string]: { [locale: string]: { label?: string; placeholder?: string; options?: { [optionIdx: number]: string } } } }; // field translations by field ID, locale, and property
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
  loadTranslations: (allTranslations: { [fieldId: string]: { [locale: string]: { label?: string; placeholder?: string; options?: { [optionIdx: number]: string } } } }) => void;
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
    case "price":
      return { ...base, type: "price", label: "Price", amount: 10 } as any;
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
  addField: (type: FieldType) => set((s) => ({ schema: { ...s.schema, data: [...s.schema.data, newField(type)] } })),
  removeField: (id: string) => set((s) => ({
    schema: { ...s.schema, data: s.schema.data.filter((f) => f.id !== id) },
    selectedId: s.selectedId === id ? undefined : s.selectedId,
  })),
  reorder: (from: number, to: number) => set((s) => {
    const arr = [...s.schema.data];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    return { schema: { ...s.schema, data: arr } };
  }),
  updateField: (id: string, patch: Partial<AnyField>) => set((s) => {
    // Mark field as modified if label, placeholder, or content changed
    const field = s.schema.data.find(f => f.id === id);
    if (field && (patch.label !== undefined || patch.placeholder !== undefined || (patch as any).content !== undefined)) {
      const newModified = new Set(s.modifiedFields);
      newModified.add(id);
      return {
        schema: {
          ...s.schema,
          data: s.schema.data.map((f) => (f.id === id ? ({ ...f, ...(patch as any) } as AnyField) : f)) as AnyField[],
        },
        modifiedFields: newModified,
      };
    }
    return {
      schema: {
        ...s.schema,
        data: s.schema.data.map((f) => (f.id === id ? ({ ...f, ...(patch as any) } as AnyField) : f)) as AnyField[],
      },
    };
  }),
  updateOptions: (id: string, options: OptionItem[]) => set((s) => {
    // Mark field as modified since options changed
    const newModified = new Set(s.modifiedFields);
    newModified.add(id);
    return {
      schema: {
        ...s.schema,
        data: s.schema.data.map((f) => (f.id === id ? ({ ...f, options } as AnyField) : f)) as AnyField[],
      },
      modifiedFields: newModified,
    };
  }),
  setSchema: (schema) => set({
    schema: {
      ...schema,
      supported_locales: schema.supported_locales || [],
      formWidth: normalizeFormWidth((schema as any)?.formWidth ?? (schema as any)?.form_width),
    },
    activeLocale: 'en',
  }),
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
  }),
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
