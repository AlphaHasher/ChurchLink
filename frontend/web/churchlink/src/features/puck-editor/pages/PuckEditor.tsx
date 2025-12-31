import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import { useParams, useNavigate } from "react-router-dom";
import { config } from "../config";
import { usePuckPage } from "../hooks/usePuckPage";
import { Skeleton } from "@/shared/components/ui/skeleton";

export default function PuckEditor() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();

  const {
    data,
    loading,
    error,
    saveStatus,
    isPublished,
    save,
    publish,
  } = usePuckPage(slug || "home");

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
    <div className="h-screen">
      <Puck
        config={config}
        data={data}
        onPublish={async (publishData) => {
          try {
            await save(publishData);
            await publish();
            // Show success message or redirect
          } catch (err) {
            console.error("Publish failed:", err);
          }
        }}
        onChange={save}
        headerTitle={slug || "home"}
        headerPath={`/${slug || ""}`}
        overrides={{
          header: ({ actions }) => (
            <header className="flex items-center justify-between px-4 py-2 bg-background border-b">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate("/admin/webbuilder")}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back
                </button>
                <span className="font-medium">{slug || "home"}</span>
                <SaveStatusBadge status={saveStatus} />
                {isPublished && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                    Live
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {actions}
              </div>
            </header>
          ),
        }}
      />
    </div>
  );
}

function SaveStatusBadge({ status }: { status: "idle" | "saving" | "saved" | "error" }) {
  if (status === "idle") return null;

  const styles = {
    saving: "bg-yellow-100 text-yellow-700",
    saved: "bg-green-100 text-green-700",
    error: "bg-red-100 text-red-700",
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
