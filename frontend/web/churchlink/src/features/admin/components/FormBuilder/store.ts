import { nanoid } from "nanoid";
import { create } from "zustand";
import type { AnyField, FormSchema, FieldType, OptionItem } from "./types";

const DEFAULT_META = { title: "Untitled Form", description: "" };

export type BuilderState = {
  schema: FormSchema;
  selectedId?: string;
  select: (id?: string) => void;
  addField: (type: FieldType) => void;
  removeField: (id: string) => void;
  reorder: (fromIndex: number, toIndex: number) => void;
  updateField: (id: string, patch: Partial<AnyField>) => void;
  updateOptions: (id: string, options: OptionItem[]) => void;
  setSchema: (schema: FormSchema) => void;
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
    case "textarea":
      return { ...base, type: "textarea", placeholder: "Enter long text" };
    case "number":
      return { ...base, type: "number", placeholder: "0" };
    case "checkbox":
      return { ...base, type: "checkbox" };
    case "select":
      return { ...base, type: "select", options: [{ label: "Option 1", value: "option1" }] } as AnyField;
    case "radio":
      return { ...base, type: "radio", options: [{ label: "Option 1", value: "option1" }] } as AnyField;
    case "date":
      return { ...base, type: "date" };
  }
};

export const useBuilderStore = create<BuilderState>((set) => ({
  schema: { meta: DEFAULT_META, fields: [] },
  selectedId: undefined,
  select: (id?: string) => set({ selectedId: id }),
  addField: (type: FieldType) => set((s) => ({ schema: { ...s.schema, fields: [...s.schema.fields, newField(type)] } })),
  removeField: (id: string) => set((s) => ({
    schema: { ...s.schema, fields: s.schema.fields.filter((f) => f.id !== id) },
    selectedId: s.selectedId === id ? undefined : s.selectedId,
  })),
  reorder: (from: number, to: number) => set((s) => {
    const arr = [...s.schema.fields];
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    return { schema: { ...s.schema, fields: arr } };
  }),
  updateField: (id: string, patch: Partial<AnyField>) => set((s) => ({
    schema: {
      ...s.schema,
      fields: s.schema.fields.map((f) => (f.id === id ? ({ ...f, ...(patch as any) } as AnyField) : f)) as AnyField[],
    },
  })),
  updateOptions: (id: string, options: OptionItem[]) => set((s) => ({
    schema: {
      ...s.schema,
      fields: s.schema.fields.map((f) => (f.id === id ? ({ ...f, options } as AnyField) : f)) as AnyField[],
    },
  })),
  setSchema: (schema) => set({ schema }),
}));
