/**
 * Industry-standard drop-shadow presets for text and UI elements
 * Based on Material Design and Tailwind CSS shadow scales
 */

export type ShadowPreset = "none" | "xs" | "sm" | "md" | "lg" | "xl";

export const shadowPresets: Record<ShadowPreset, string> = {
  none: "none",
  // Extra small
  xs: "0px 1px 2px rgba(0, 0, 0, 0.3)",
  // Small
  sm: "0px 2px 4px rgba(0, 0, 0, 0.4)",
  // Medium
  md: "0px 3px 6px rgba(0, 0, 0, 0.5)",
  // Large
  lg: "0px 4px 8px rgba(0, 0, 0, 0.6)",
  // Extra large
  xl: "0px 6px 12px rgba(0, 0, 0, 0.7)",
};

export const shadowPresetLabels: Record<ShadowPreset, string> = {
  none: "None",
  xs: "Extra Small",
  sm: "Small",
  md: "Medium",
  lg: "Large",
  xl: "Extra Large",
};

/**
 * Get text-shadow CSS value for a shadow preset
 */
export function getShadowStyle(preset: ShadowPreset): React.CSSProperties {
  return {
    textShadow: shadowPresets[preset],
  };
}

/**
 * Get drop-shadow filter CSS value for images/elements
 */
export function getDropShadowStyle(preset: ShadowPreset): React.CSSProperties {
  if (preset === "none") {
    return {};
  }
  return {
    filter: `drop-shadow(${shadowPresets[preset]})`,
  };
}
