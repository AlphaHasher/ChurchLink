import { nanoid } from "nanoid";
import { create } from "zustand";
import type { AnyField, FormSchema, FieldType, OptionItem } from "./types";

const DEFAULT_META = { title: "Untitled Form", description: "" };

export type BuilderState = {
  schema: FormSchema;
  selectedId?: string;
  activeLocale: string; // current preview/edit locale
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
      return { ...base, type: "tel", placeholder: "+1 (555) 123-4567" } as any;
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
      return { ...base, type: "static", name: `static_${id}`, label: "Static Text", content: "Sample text", as: "p" } as any;
    case "price":
      return { ...base, type: "price", label: "Price", amount: 0 } as any;
    default:
      return { ...base, type: "text", placeholder: "Enter text" };
  }
};

export const useBuilderStore = create<BuilderState>((set, get) => ({
  schema: { title: DEFAULT_META.title, description: DEFAULT_META.description, defaultLocale: 'en', locales: [], data: [] },
  selectedId: undefined,
  activeLocale: 'en',
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
  updateField: (id: string, patch: Partial<AnyField>) => set((s) => ({
    schema: {
      ...s.schema,
      data: s.schema.data.map((f) => (f.id === id ? ({ ...f, ...(patch as any) } as AnyField) : f)) as AnyField[],
    },
  })),
  updateOptions: (id: string, options: OptionItem[]) => set((s) => ({
    schema: {
      ...s.schema,
      data: s.schema.data.map((f) => (f.id === id ? ({ ...f, options } as AnyField) : f)) as AnyField[],
    },
  })),
  setSchema: (schema) => set({
    schema: {
      defaultLocale: schema.defaultLocale || 'en',
      locales: schema.locales || [],
      ...schema,
    },
    activeLocale: schema.defaultLocale || get().activeLocale || 'en',
  }),
  setActiveLocale: (locale: string) => set({ activeLocale: locale }),
  addLocale: (locale: string) => set((s) => {
    const existing = new Set([...(s.schema.locales || [])]);
    // avoid adding defaultLocale into locales list
    const dl = s.schema.defaultLocale || 'en';
    if (locale === dl) return { schema: { ...s.schema } };
    existing.add(locale);
    return { schema: { ...s.schema, locales: Array.from(existing) } };
  }),
  removeLocale: (locale: string) => set((s) => ({
    schema: { ...s.schema, locales: (s.schema.locales || []).filter((l) => l !== locale) },
    // If removing currently active locale, fallback to default
    activeLocale: get().activeLocale === locale ? (s.schema.defaultLocale || 'en') : get().activeLocale,
  })),
}));
