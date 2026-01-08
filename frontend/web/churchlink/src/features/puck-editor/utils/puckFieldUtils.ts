/**
 * Extract component ID from Puck field ID
 * Field ID format: {componentId}_custom_{fieldName}
 */
export function extractComponentId(fieldId: string | undefined): string | undefined {
  if (!fieldId) return undefined;
  const match = fieldId.match(/^(.+?)_custom_/);
  return match ? match[1] : fieldId;
}
