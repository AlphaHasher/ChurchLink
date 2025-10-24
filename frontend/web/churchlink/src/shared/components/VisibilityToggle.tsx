import { useState } from "react";
import MultiStateBadge from "@/shared/components/MultiStageBadge";

interface VisibilityToggleProps {
  /** The current visibility state */
  visible: boolean;
  /** Callback function to update visibility. Should return a Promise that resolves when the API call completes. */
  onToggle: (newVisibility: boolean) => Promise<void>;
  /** Optional: Custom labels for visible/hidden states */
  labels?: {
    visible?: string;
    hidden?: string;
  };
  /** Optional: Additional CSS classes */
  className?: string;
}

/**
 * A reusable visibility toggle component with animated state transitions.
 * 
 * Features:
 * - Animated transitions between states (visible/hidden/processing/success/error)
 * - Automatic state management for loading and success states
 * - Error handling with automatic recovery
 * - Accessible and keyboard-friendly
 * 
 * @example
 * ```tsx
 * <VisibilityToggle
 *   visible={item.visible}
 *   onToggle={async (newVisibility) => {
 *     await api.put(`/items/${item.id}`, { visible: newVisibility });
 *   }}
 * />
 * ```
 */
export function VisibilityToggle({
  visible,
  onToggle,
  labels = { visible: "Visible", hidden: "Hidden" },
  className = "",
}: VisibilityToggleProps) {
  const [badgeState, setBadgeState] = useState<"custom" | "processing" | "success" | "error">("custom");

  const handleToggle = async () => {
    // Prevent clicking while processing
    if (badgeState !== "custom") return;

    const newVisibility = !visible;
    setBadgeState("processing");

    try {
      await onToggle(newVisibility);
      setBadgeState("success");
      
      // Auto-revert to custom state after success animation
      setTimeout(() => {
        setBadgeState("custom");
      }, 900);
    } catch (error) {
      console.error("Error toggling visibility:", error);
      setBadgeState("error");
      
      // Auto-revert to custom state after error animation
      setTimeout(() => {
        setBadgeState("custom");
      }, 1200);
    }
  };

  return (
    <div className={`flex items-center justify-center h-full w-full overflow-visible ${className}`}>
      <MultiStateBadge
        state={badgeState}
        onClick={handleToggle}
        customComponent={
          <span
            className={`inline-block px-2 py-1 text-xs rounded-full font-medium cursor-pointer ${
              visible
                ? "bg-green-500/20 text-green-400 dark:bg-green-400 dark:text-green-900"
                : "bg-red-500/20 text-red-400 dark:bg-red-400 dark:text-red-900"
            }`}
          >
            {visible ? labels.visible : labels.hidden}
          </span>
        }
      />
    </div>
  );
}

/**
 * Cell renderer component for use with AG Grid tables.
 * 
 * @example
 * ```tsx
 * // In your column definitions:
 * {
 *   headerName: "Visibility",
 *   field: "visible",
 *   cellRenderer: VisibilityToggleCellRenderer,
 *   cellStyle: { display: 'grid', placeItems: 'center', padding: 0 },
 * }
 * 
 * // In your AG Grid context:
 * context={{
 *   onToggleVisibility: async (id: string, newVisibility: boolean) => {
 *     await api.put(`/items/${id}`, { visible: newVisibility });
 *     // Update local state
 *     setItems(prev => prev.map(item => 
 *       item.id === id ? { ...item, visible: newVisibility } : item
 *     ));
 *   }
 * }}
 * ```
 */
export function VisibilityToggleCellRenderer(props: any) {
  const { data, value, context } = props;
  if (!data) return null;

  const { onToggleVisibility } = context || {};
  
  if (!onToggleVisibility) {
    console.warn("VisibilityToggleCellRenderer: onToggleVisibility not provided in context");
    return null;
  }

  return (
    <VisibilityToggle
      visible={value}
      onToggle={async (newVisibility) => {
        await onToggleVisibility(data.id || data._id, newVisibility);
      }}
    />
  );
}
