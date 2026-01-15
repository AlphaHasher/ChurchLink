import type { ComponentConfig, Data } from "@puckeditor/core";
import type { ReactNode } from "react";
import { useState } from "react";
import { usePuck } from "@puckeditor/core";
import { useTemplateContext } from "../../context/TemplateContext";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/shared/components/ui/Dialog";
import { Save } from "lucide-react";
import { ColorPickerField } from "../../fields/ColorPickerField";

export type GroupBlockProps = {
  name: string;
  id?: string;
  backgroundType: "color" | "image";
  backgroundColor?: string;
  backgroundImage?: {
    url: string;
    brightness: number;
    size: "cover" | "contain" | "auto";
    position: "center" | "top" | "bottom" | "left" | "right";
    maxHeight?: number;
    fixed: boolean;
    overlay?: string;
  };
  verticalAlign: "top" | "center" | "bottom";
  // The slot for nested components - Puck handles this as a special field type
  children: ReactNode;
};

// Type for Puck component data structure
type PuckComponent = {
  type: string;
  props: Record<string, unknown>;
};

// Component for the save group dialog and button
// eslint-disable-next-line react-refresh/only-export-components
function SaveGroupDialog({ groupName, componentId }: { groupName: string; componentId: string }) {
  const templateContext = useTemplateContext();
  const { appState } = usePuck();
  const [open, setOpen] = useState(false);
  const [groupTemplateName, setGroupTemplateName] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!templateContext) {
    return null;
  }

  const handleSave = async () => {
    if (!groupTemplateName.trim()) {
      setError("Name is required");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Get the full Puck data structure
      const puckData = appState.data as Data;

      // Find this GroupBlock component in the data
      // In Puck, each component has props.id as the unique identifier
      let groupComponent: PuckComponent | undefined = puckData.content?.find(
        (item: PuckComponent) => item.props.id === componentId
      );

      if (!groupComponent && puckData.zones) {
        // Search in all zones if not found in root content
        for (const zoneKey in puckData.zones) {
          const found = puckData.zones[zoneKey]?.find(
            (item: PuckComponent) => item.props.id === componentId
          );
          if (found) {
            groupComponent = found;
            break;
          }
        }
      }

      if (!groupComponent) {
        setError(`Could not find group component with ID: ${componentId}`);
        setSaving(false);
        return;
      }

      let children: PuckComponent[] = [];

      if (groupComponent.props.children && Array.isArray(groupComponent.props.children)) {
        // Puck 0.19+ Slots API - children stored in props
        children = groupComponent.props.children as PuckComponent[];
      } else {
        // Fallback: Try legacy zones approach (DropZone API)
        const childrenZoneKey = `${componentId}:children`;
        children = (puckData.zones?.[childrenZoneKey] || []) as PuckComponent[];
      }

      // Helper function to deep clone and strip IDs from components for template
      // This ensures each instantiation gets new unique IDs
      const stripComponentIds = (components: PuckComponent[]): PuckComponent[] => {
        return components.map(comp => {
          const { id: _id, ...restProps } = comp.props as Record<string, unknown>;
          const newProps: Record<string, unknown> = { ...restProps };

          // If this component has children (slot), recursively strip IDs from them too
          if (Array.isArray(newProps.children)) {
            newProps.children = stripComponentIds(newProps.children as PuckComponent[]);
          }

          return {
            type: comp.type,
            props: newProps
          };
        });
      };

      // Strip IDs from children so new IDs will be generated when instantiated
      const templateChildren = stripComponentIds(children);

      const completeGroupData = {
        type: "GroupBlock",
        props: {
          name: groupName,
          children: templateChildren
        }
      };

      await templateContext.saveAsTemplate(completeGroupData, groupTemplateName.trim(), description.trim() || undefined);
      setOpen(false);
      setGroupTemplateName("");
      setDescription("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save group";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      setGroupTemplateName("");
      setDescription("");
      setError(null);
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <Save className="w-4 h-4 mr-2" />
        Save as Group
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save as Group</DialogTitle>
            <DialogDescription>
              Save this group as a reusable component. It will appear in the "Custom Groups" category.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Group Name</label>
              <Input
                value={groupTemplateName}
                onChange={(e) => {
                  setGroupTemplateName(e.target.value);
                  setError(null);
                }}
                placeholder="e.g., Hero with CTA"
                disabled={saving}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Description (optional)</label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this group"
                disabled={saving}
              />
            </div>

            {error && (
              <div className="text-sm text-destructive">{error}</div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving || !groupTemplateName.trim()}>
              {saving ? "Saving..." : "Save Group"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export const GroupBlock: ComponentConfig<GroupBlockProps> = {
  label: "Group",
  fields: {
    name: {
      type: "text",
      label: "Group Name",
    },
    backgroundType: {
      type: "radio",
      label: "Background Type",
      options: [
        { label: "Color", value: "color" },
        { label: "Image", value: "image" },
      ],
    },
    backgroundColor: {
      type: "custom",
      label: "Background Color",
      render: ({ value, onChange }) => (
        <ColorPickerField value={value as string} onChange={onChange} />
      ),
    },
    backgroundImage: {
      type: "object",
      objectFields: {
        url: { type: "text", label: "Image URL" },
        brightness: { type: "number", label: "Brightness (%)", min: 0, max: 200 },
        size: {
          type: "radio",
          label: "Scaling",
          options: [
            { label: "Cover", value: "cover" },
            { label: "Contain", value: "contain" },
            { label: "Auto", value: "auto" },
          ],
        },
        position: {
          type: "radio",
          label: "Position",
          options: [
            { label: "Center", value: "center" },
            { label: "Top", value: "top" },
            { label: "Bottom", value: "bottom" },
            { label: "Left", value: "left" },
            { label: "Right", value: "right" },
          ],
        },
        maxHeight: { type: "number", label: "Max Height (px)", min: 0 },
        fixed: {
          type: "radio",
          label: "Parallax Effect",
          options: [
            { label: "Yes", value: true as any },
            { label: "No", value: false as any },
          ],
        },
        overlay: {
          type: "custom",
          label: "Color Overlay",
          render: ({ value, onChange }) => (
            <ColorPickerField value={value as string} onChange={onChange} />
          ),
        },
      },
    },
    verticalAlign: {
      type: "radio",
      label: "Vertical Alignment",
      options: [
        { label: "Top", value: "top" },
        { label: "Center", value: "center" },
        { label: "Bottom", value: "bottom" },
      ],
    },
    children: {
      type: "slot",
      // No allow/disallow restrictions - any component can be placed inside
    },
    // @ts-expect-error - Custom field type for save button
    saveAsGroup: {
      type: "custom",
      label: "Save this group",
      render: ({ value, id }: { value: unknown; id: string }) => {
        // Extract component ID from field ID
        // Field ID format: "GroupBlock-xxx_custom_saveAsGroup"
        // Component ID format: "GroupBlock-xxx"
        const componentId = id.replace(/_custom_saveAsGroup$/, '');
        const groupName = typeof value === 'string' ? value : "My Group";
        return <SaveGroupDialog groupName={groupName} componentId={componentId} />;
      },
    },
  },
  defaultProps: {
    name: "My Group",
    backgroundType: "color",
    backgroundColor: "",
    backgroundImage: {
      url: "",
      brightness: 100,
      size: "cover",
      position: "center",
      maxHeight: undefined,
      fixed: false,
      overlay: "",
    },
    verticalAlign: "center",
    children: [] as unknown as ReactNode,
  },
  // Ensure children is always valid to prevent crashes during deletion
  resolveData: async ({ props }) => {
    return {
      props: {
        ...props,
        children: props.children ?? [],
      },
    };
  },
  render: ({ children, backgroundType, backgroundColor, backgroundImage, verticalAlign }) => {
    // Defensive: handle case where children is null/undefined during deletion
    if (children === null || children === undefined) {
      return <div className="group-block w-full"><div className="group-block-content min-h-12.5" /></div>;
    }

    // Render children - can be a function (slot render prop) or ReactNode
    const renderChildren = () => {
      try {
        if (typeof children === "function") {
          return (children as () => ReactNode)();
        }
        return children;
      } catch {
        // Catch errors during slot rendering (e.g., during deletion)
        return null;
      }
    };

    // Build styles
    const wrapperStyles: React.CSSProperties = {
      position: "relative",
      display: "flex",
      flexDirection: "column",
      justifyContent:
        verticalAlign === "top" ? "flex-start" :
        verticalAlign === "bottom" ? "flex-end" :
        "center",  // default center
      alignItems: "stretch", // Allow children to take full width for text alignment
    };

    const backgroundLayerStyles: React.CSSProperties = {};
    const overlayStyles: React.CSSProperties = {};

    // Apply min height to wrapper if specified (expands group but allows content to grow)
    if (backgroundType === "image" && backgroundImage?.maxHeight) {
      wrapperStyles.minHeight = `${backgroundImage.maxHeight}px`;
    }

    if (backgroundType === "color") {
      wrapperStyles.backgroundColor = backgroundColor || "transparent";
    } else if (backgroundType === "image" && backgroundImage?.url) {
      // Background layer - separate from content so filter doesn't affect children
      backgroundLayerStyles.position = "absolute";
      backgroundLayerStyles.inset = "0";
      backgroundLayerStyles.backgroundImage = `url(${backgroundImage.url})`;
      backgroundLayerStyles.backgroundSize = backgroundImage.size || "cover";
      backgroundLayerStyles.backgroundPosition = backgroundImage.position || "center";
      backgroundLayerStyles.backgroundRepeat = "no-repeat";
      backgroundLayerStyles.backgroundAttachment = backgroundImage.fixed ? "fixed" : "scroll";
      backgroundLayerStyles.filter = `brightness(${(backgroundImage.brightness || 100) / 100})`;
      backgroundLayerStyles.zIndex = 0;

      // Overlay (if specified) - goes on top of background, below content
      if (backgroundImage.overlay) {
        overlayStyles.position = "absolute";
        overlayStyles.inset = "0";
        overlayStyles.backgroundColor = backgroundImage.overlay;
        overlayStyles.zIndex = 1;
      }
    }

    return (
      <div className="group-block w-full" style={wrapperStyles}>
        {/* Background image layer (only shown for image type) */}
        {backgroundType === "image" && backgroundImage?.url && (
          <div style={backgroundLayerStyles} />
        )}
        {/* Color overlay layer (only shown when overlay is specified) */}
        {backgroundType === "image" && backgroundImage?.overlay && (
          <div style={overlayStyles} />
        )}
        {/* Content layer - z-index higher than background/overlay */}
        <div className="group-block-content min-h-12.5 relative" style={{ zIndex: 10, width: "100%" }}>
          {renderChildren()}
        </div>
      </div>
    );
  },
};

