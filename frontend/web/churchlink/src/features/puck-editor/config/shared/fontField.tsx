import { FontFamilyField } from "../../fields/FontFamilyField";
import type { CustomField } from "@puckeditor/core";

export const fontFamilyField: CustomField<string | undefined> = {
  type: "custom",
  label: "Font Family",
  render: ({ value, onChange }) => (
    <FontFamilyField value={value || ""} onChange={(val) => onChange(val || "")} />
  ),
};
