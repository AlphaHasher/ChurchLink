"use client";

import React from "react";
import type { ComponentGroupConfig } from "./types";
import { FieldAccordion } from "./FieldAccordion";
import { ArrayItemAccordion } from "./ArrayItemAccordion";
import { fieldRenderers } from "./renderers";
import { getValueAtPath, setValueAtPath } from "./utils";
import { TranslationsField } from "../TranslationsField";

interface GroupedFieldsPanelProps {
  value: Record<string, unknown>;
  onChange: (newValue: Record<string, unknown>) => void;
  config: ComponentGroupConfig;
}

export const GroupedFieldsPanel: React.FC<GroupedFieldsPanelProps> = ({
  value,
  onChange,
  config,
}) => {
  const handleFieldChange = (fieldPath: string, fieldValue: unknown) => {
    const newValue = setValueAtPath(value, fieldPath, fieldValue);
    onChange(newValue);
  };

  const handleArrayChange = (arrayPath: string, newArray: unknown[]) => {
    const newValue = setValueAtPath(value, arrayPath, newArray);
    onChange(newValue);
  };

  // Build translatable fields list from all groups
  const translatableFields = React.useMemo(() => {
    const fields: Array<{ name: string; type?: "text" | "textarea"; label: string }> = [];
    const NON_TRANSLATABLE_NAMES = ['url', 'embedUrl', 'src', 'href', 'link', 'id'];

    config.groups.forEach((group) => {
      if (group.isCustom) return;

      // Handle array groups
      if (group.isArray && group.arrayConfig) {
        const arrayKey = group.name.toLowerCase().replace(/\s+/g, "_");
        const arrayValue = getValueAtPath(value, arrayKey) as unknown[];
        const arrayFields = group.arrayConfig.fields || group.fields;

        // Generate fields for each array item
        (arrayValue || []).forEach((_item, index) => {
          arrayFields.forEach((field) => {
            // Only include text/textarea fields, exclude URLs
            if (
              (field.type === "text" || field.type === "textarea") &&
              !NON_TRANSLATABLE_NAMES.includes(field.name)
            ) {
              fields.push({
                name: `${arrayKey}.${index}.${field.name}`,
                type: field.type,
                label: `${group.name} ${index + 1}: ${field.label}`,
              });
            }
          });
        });
      } else {
        // Handle regular fields
        group.fields.forEach((field) => {
          if (
            (field.type === "text" || field.type === "textarea") &&
            !NON_TRANSLATABLE_NAMES.includes(field.name)
          ) {
            fields.push({
              name: field.name,
              type: field.type,
              label: field.label,
            });
          }
        });
      }
    });

    return fields;
  }, [config, value]); // Add 'value' dependency to regenerate when array items change

  return (
    <div className="w-full space-y-2">
      {config.groups.map((group, groupIndex) => {
        // Special handling for custom fields like Translations
        if (group.isCustom) {
          return (
            <FieldAccordion
              key={groupIndex}
              label={group.name}
              icon={group.icon}
              defaultOpen={groupIndex === 0}
            >
              <div className="px-4 pb-4">
                <TranslationsField
                  value={(value.translations as Record<string, Record<string, string>>) || {}}
                  onChange={(translations) =>
                    handleFieldChange("translations", translations)
                  }
                  translatableFields={translatableFields}
                />
              </div>
            </FieldAccordion>
          );
        }

        // Array field group
        if (group.isArray && group.arrayConfig) {
          const arrayKey = group.name.toLowerCase().replace(/\s+/g, "_");
          const arrayValue = getValueAtPath(value, arrayKey) as unknown[];

          return (
            <FieldAccordion
              key={groupIndex}
              label={group.name}
              icon={group.icon}
              badge={
                arrayValue?.length
                  ? `${arrayValue.length}/${group.arrayConfig.maxItems}`
                  : undefined
              }
              defaultOpen={groupIndex === 0}
            >
              <div className="px-4 pb-4">
                <ArrayItemAccordion
                  items={arrayValue || []}
                  fields={group.arrayConfig.fields || group.fields}
                  arrayPath={arrayKey}
                  itemLabelField={group.arrayConfig.itemLabelField}
                  maxItems={group.arrayConfig.maxItems}
                  defaultItem={group.arrayConfig.defaultItem}
                  onChange={(newItems) =>
                    handleArrayChange(arrayKey, newItems)
                  }
                />
              </div>
            </FieldAccordion>
          );
        }

        // Regular field group
        return (
          <FieldAccordion
            key={groupIndex}
            label={group.name}
            icon={group.icon}
            defaultOpen={groupIndex === 0}
          >
            <div className="space-y-4 px-4 pb-4">
              {group.fields.map((field) => {
                const FieldRenderer = fieldRenderers[field.type];
                if (!FieldRenderer) {
                  return (
                    <div
                      key={field.name}
                      className="text-sm text-muted-foreground"
                    >
                      Unknown field type: {field.type}
                    </div>
                  );
                }

                const fieldValue = getValueAtPath(value, field.name);

                return (
                  <FieldRenderer
                    key={field.name}
                    value={fieldValue}
                    onChange={(newValue) =>
                      handleFieldChange(field.name, newValue)
                    }
                    fieldDef={field}
                    label={field.label}
                  />
                );
              })}
            </div>
          </FieldAccordion>
        );
      })}
    </div>
  );
};
