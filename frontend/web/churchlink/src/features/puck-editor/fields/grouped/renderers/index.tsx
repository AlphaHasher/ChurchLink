import { ColorPickerField } from "../../ColorPickerField";
import { FontFamilyField } from "../../FontFamilyField";
import { IconPickerField } from "../../IconPickerField";
import { TextField } from "./TextField";
import { TextareaField } from "./TextareaField";
import { SelectField } from "./SelectField";
import { RadioField } from "./RadioField";
import { NumberField } from "./NumberField";
import type { FieldDefinition } from "../types";

export type FieldRendererProps = {
  value: unknown;
  onChange: (value: unknown) => void;
  fieldDef: FieldDefinition;
  label?: string;
};

export const fieldRenderers: Record<string, React.FC<FieldRendererProps>> = {
  text: TextField,
  textarea: TextareaField,
  select: SelectField,
  radio: RadioField,
  number: NumberField,
  color: ColorPickerField as React.FC<FieldRendererProps>,
  fontFamily: FontFamilyField as React.FC<FieldRendererProps>,
  icon: IconPickerField as React.FC<FieldRendererProps>,
};

export {
  TextField,
  TextareaField,
  SelectField,
  RadioField,
  NumberField,
};
