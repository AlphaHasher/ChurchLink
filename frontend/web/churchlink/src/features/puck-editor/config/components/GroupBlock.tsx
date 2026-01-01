import type { ComponentConfig, Data } from "@measured/puck";
import type { ReactNode } from "react";
import { useState } from "react";
import { usePuck } from "@measured/puck";
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

export type GroupBlockProps = {
  name: string;
  id?: string;
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
    children: undefined as unknown as ReactNode,
  },
  render: ({ children }) => {
    // Render children - can be a function (slot render prop) or ReactNode
    const renderChildren = () => {
      if (typeof children === "function") {
        return (children as () => ReactNode)();
      }
      return children;
    };

    return (
      <div
        className="group-block w-full"
      >
        {/* Render the slot - children is a function that renders the DropZone */}
        <div className="group-block-content min-h-12.5">
          {renderChildren()}
        </div>
      </div>
    );
  },
};

