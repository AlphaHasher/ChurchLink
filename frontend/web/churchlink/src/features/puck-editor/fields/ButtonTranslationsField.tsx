import { createUsePuck } from "@puckeditor/core";
import { TranslationsField } from "./TranslationsField";
import type { TranslationMap } from "../utils/languageUtils";

// Selector-based hook for performance
const usePuckContent = createUsePuck();

// Constant empty array to avoid creating new references
const EMPTY_BUTTONS: Array<{ label: string }> = [];

interface ButtonTranslationsFieldProps {
  value: TranslationMap;
  onChange: (value: TranslationMap) => void;
  id: string; // Puck passes field ID like "ButtonBlock-abc123:translations"
}

// Find component by ID in content tree - returns null if not found (stable reference)
function findComponentButtons(
  items: Array<{ type: string; props: Record<string, unknown> }>,
  componentId: string
): Array<{ label: string }> | null {
  for (const item of items) {
    if ((item.props as { id?: string }).id === componentId) {
      const buttons = item.props?.buttons as Array<{ label: string }> | undefined;
      return buttons && buttons.length > 0 ? buttons : null;
    }
    // Check children (for nested components)
    const children = item.props?.children as Array<{ type: string; props: Record<string, unknown> }> | undefined;
    if (Array.isArray(children)) {
      const found = findComponentButtons(children, componentId);
      if (found) return found;
    }
  }
  return null;
}

export function ButtonTranslationsField({ value, onChange, id }: ButtonTranslationsFieldProps) {
  // Extract component ID from field ID (format: "ComponentType-id:fieldName")
  const componentId = id.split(":")[0];

  // Only select the specific component's buttons - uses selector for performance
  // Returns null for empty to maintain stable reference
  const buttonsOrNull = usePuckContent((s) =>
    findComponentButtons(
      s.appState.data.content as Array<{ type: string; props: Record<string, unknown> }>,
      componentId
    )
  );
  const buttons = buttonsOrNull || EMPTY_BUTTONS;

  // Generate translatable fields based on actual button count
  const translatableFields = buttons.map((button, i) => ({
    name: `buttons.${i}.label`,
    type: "text" as const,
    label: `Button ${i + 1}: "${button.label}"`,
  }));

  if (translatableFields.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        Add buttons first, then you can translate their labels.
      </div>
    );
  }

  return (
    <TranslationsField
      value={value}
      onChange={onChange}
      translatableFields={translatableFields}
    />
  );
}
