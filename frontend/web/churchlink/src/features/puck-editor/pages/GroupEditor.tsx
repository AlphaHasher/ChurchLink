import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { Puck, Data as PuckData, type ComponentData } from "@measured/puck";
import "@measured/puck/puck.css";
import "../styles/puck-dark-overrides.css";
import { X } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ModeToggle } from "@/shared/components/ModeToggle";
import { UndoRedoButtons } from "../components/UndoRedoButtons";
import { config } from "../config";
import api from "@/api/api";
import { createPortal } from "react-dom";

type SaveStatus = "idle" | "saving" | "saved" | "error";

// Generate unique ID for components (same format Puck uses)
function generateId(type: string): string {
  return `${type}-${Math.random().toString(36).substring(2, 11)}`;
}

// Recursively add IDs to components that don't have them
function ensureComponentIds(components: ComponentData[]): ComponentData[] {
  return components.map((comp) => {
    const props = { ...comp.props };

    // Add ID if missing
    if (!props.id) {
      props.id = generateId(comp.type);
    }

    // Recursively handle children (for nested slots)
    if (Array.isArray(props.children)) {
      props.children = ensureComponentIds(props.children as ComponentData[]);
    }

    return {
      type: comp.type,
      props,
    };
  });
}

// Save status badge component
function SaveStatusBadge({ status }: { status: SaveStatus }) {
  if (status === "idle") return null;

  const styles = {
    saving: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    saved: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    error: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };

  const labels = {
    saving: "Saving...",
    saved: "Saved",
    error: "Save failed",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

export default function GroupEditor() {
  const { groupId } = useParams<{ groupId: string }>();

  const [puckData, setPuckData] = useState<PuckData | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [groupName, setGroupName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [undoRedoPortal, setUndoRedoPortal] = useState<HTMLElement | null>(null);

  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const latestDataRef = useRef<PuckData | null>(null);

  // Fetch group template directly from API (like usePuckPage does for pages)
  useEffect(() => {
    if (!groupId) return;

    let cancelled = false;

    const loadGroup = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await api.get(`/v1/page-components/${groupId}`);
        if (cancelled) return;

        const template = response.data;
        setGroupName(template.name);

        // Convert template format to Puck data format
        // Template stores: { type: "GroupBlock", props: { name, children: [] } }
        // Puck needs: { content: [], root: { props: {} } }
        const rawChildren = template.puckData?.props?.children || [];

        // Ensure all components have unique IDs (they're stripped when saving)
        const children = ensureComponentIds(rawChildren as ComponentData[]);

        // Create fresh Puck data structure
        const freshData: PuckData = {
          content: children,
          root: { props: {} },
        };

        setPuckData(freshData);
        latestDataRef.current = freshData;
      } catch (err) {
        if (cancelled) return;
        console.error("Failed to load group:", err);
        setError("Failed to load group");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadGroup();

    return () => {
      cancelled = true;
    };
  }, [groupId]);

  // Auto-save handler with debounce
  const handleSave = useCallback(
    (data: PuckData) => {
      if (!groupId) return;

      latestDataRef.current = data;
      setPuckData(data);

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Set saving status immediately
      setSaveStatus("saving");

      // Debounce the actual save
      saveTimeoutRef.current = setTimeout(async () => {
        try {
          // Convert Puck data back to template format
          const templateFormat = {
            type: "GroupBlock",
            props: {
              name: groupName,
              children: latestDataRef.current?.content || [],
            },
          };

          await api.put(`/v1/page-components/${groupId}`, {
            puckData: templateFormat,
          });

          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } catch (err) {
          console.error("Failed to save group:", err);
          setSaveStatus("error");
          setTimeout(() => setSaveStatus("idle"), 3000);
        }
      }, 800);
    },
    [groupId, groupName]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  const handleClose = () => {
    window.close();
  };

  if (loading) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium">Loading group...</div>
        </div>
      </div>
    );
  }

  if (error || !puckData) {
    return (
      <div className="h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-medium text-destructive">
            {error || "Failed to load group"}
          </div>
          <Button variant="outline" className="mt-4" onClick={handleClose}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header - Outside Puck Layout */}
      <header className="flex items-center gap-3 px-6 py-3 bg-background border-b shrink-0">
        {/* Left Section - Close Button */}
        <Button variant="ghost" size="sm" onClick={handleClose}>
          <X className="h-4 w-4 mr-2" />
          Close
        </Button>

        <div className="h-6 w-px bg-border" />

        {/* Center/Flex Section - Title with Save Status */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-semibold text-base truncate">
            Editing Group: {groupName}
          </span>
          <SaveStatusBadge status={saveStatus} />
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Undo/Redo buttons portal target */}
        <div ref={setUndoRedoPortal} />

        <div className="h-6 w-px bg-border" />

        {/* Right Section - Mode Toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <ModeToggle />
        </div>
      </header>

      {/* Puck Editor - Takes remaining space */}
      <div className="flex-1 overflow-hidden">
        <Puck
          config={config}
          data={puckData}
          onChange={handleSave}
          overrides={{
            header: () => {
              // Render UndoRedoButtons into portal if available
              if (undoRedoPortal) {
                return createPortal(<UndoRedoButtons />, undoRedoPortal);
              }
              return <></>;
            },
          }}
        />
      </div>
    </div>
  );
}
