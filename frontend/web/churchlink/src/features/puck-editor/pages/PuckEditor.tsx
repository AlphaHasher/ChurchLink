import { useMemo, useCallback, useState } from "react";
import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import "../styles/puck-dark-overrides.css";
import { useParams, useNavigate } from "react-router-dom";
import { buildConfigWithTemplates } from "../config/buildConfigWithTemplates";
import { usePuckPage } from "../hooks/usePuckPage";
import { useCustomTemplates } from "../hooks/useCustomTemplates";
import { TemplateProvider } from "../context/TemplateContext";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ModeToggle } from "@/shared/components/ModeToggle";
import { ManageGroupsDialog } from "../components/ManageGroupsDialog";
import { Button } from "@/shared/components/ui/button";
import { LayoutGrid, ArrowLeft } from "lucide-react";

export default function PuckEditor() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [manageGroupsOpen, setManageGroupsOpen] = useState(false);

  const {
    data,
    loading,
    error,
    saveStatus,
    isPublished,
    save,
    publish,
  } = usePuckPage(slug || "home");

  const {
    templates,
    loading: templatesLoading,
    saveTemplate,
  } = useCustomTemplates();

  // Build config with templates - memoized to avoid recreating on every render
  // Always build with templates (even if empty array)
  // Loading state above ensures we don't render until templates are ready
  const dynamicConfig = useMemo(() => {
    return buildConfigWithTemplates(templates);
  }, [templates]);

    // Handler for saving a component as template
  const handleSaveAsTemplate = useCallback(
    async (puckData: object, name: string, description?: string) => {
      await saveTemplate(name, puckData, description);
    },
    [saveTemplate]
  );

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  // Wait for templates to load to avoid race condition with template component registration
  if (templatesLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-destructive text-lg">{error}</p>
          <button
            onClick={() => navigate("/admin/webbuilder")}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Back to Pages
          </button>
        </div>
      </div>
    );
  }

  return (
    <TemplateProvider saveAsTemplate={handleSaveAsTemplate}>
      <div className="h-screen bg-background">
        <Puck
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          config={dynamicConfig as any}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data={data as any}
          onPublish={async (publishData) => {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              await save(publishData as any);
              await publish();
              // Show success message or redirect
            } catch (err) {
              console.error("Publish failed:", err);
            }
          }}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onChange={save as any}
          headerTitle={slug || "home"}
          headerPath={`/${slug || ""}`}
          overrides={{
            header: ({ actions }) => (
              <header className="flex items-center justify-between px-6 py-3 bg-background border-b">
                {/* Left Section */}
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate("/admin/webbuilder")}
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                  </Button>

                  <div className="h-6 w-px bg-border" />

                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-base">{slug || "home"}</span>
                    <SaveStatusBadge status={saveStatus} />
                    {isPublished && (
                      <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded font-medium">
                        Live
                      </span>
                    )}
                  </div>
                </div>

                {/* Right Section */}
                <div className="flex items-center gap-2">
                  <ModeToggle />
                  <div className="h-6 w-px bg-border mx-1" />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManageGroupsOpen(true)}
                  >
                    <LayoutGrid className="h-4 w-4 mr-2" />
                    Manage Groups
                  </Button>
                  <div className="h-6 w-px bg-border mx-1" />
                  {actions}
                </div>
              </header>
            ),
          }}
        />
        <ManageGroupsDialog
          open={manageGroupsOpen}
          onOpenChange={setManageGroupsOpen}
        />
      </div>
    </TemplateProvider>
  );
}

function SaveStatusBadge({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
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
