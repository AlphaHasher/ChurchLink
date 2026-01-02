import { useMemo, useCallback, useState } from "react";
import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";
import "../styles/puck-dark-overrides.css";
import { useParams, useNavigate } from "react-router-dom";
import { buildConfigWithTemplates } from "../config/buildConfigWithTemplates";
import { usePuckPage } from "../hooks/usePuckPage";
import { useCustomTemplates } from "../hooks/useCustomTemplates";
import { TemplateProvider } from "../context/TemplateContext";
import { PuckLanguageProvider, usePuckLanguage } from "../context/PuckLanguageContext";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ModeToggle } from "@/shared/components/ModeToggle";
import { ManageGroupsDialog } from "../components/ManageGroupsDialog";
import { UndoRedoButtons } from "../components/UndoRedoButtons";
import { Button } from "@/shared/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { LayoutGrid, ArrowLeft, Eye, X, Globe } from "lucide-react";
import { createPortal } from "react-dom";
import Layout from "@/shared/layouts/Layout";
import { PuckPageRenderer } from "../components/PuckPageRenderer";
import { LANGUAGES } from "../utils/languageUtils";

export default function PuckEditor() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [manageGroupsOpen, setManageGroupsOpen] = useState(false);
  const [undoRedoPortal, setUndoRedoPortal] = useState<HTMLElement | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);

  const {
    data,
    loading,
    error,
    publishing,
    isPublished,
    updateData,
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
      <PuckLanguageProvider data={data}>
        {isPreviewMode ? (
          // PREVIEW MODE - Show as live page with header/footer
          <PreviewModeContent
            data={data}
            setIsPreviewMode={setIsPreviewMode}
          />
        ) : (
        // EDIT MODE - Normal Puck editor
        <div className="h-screen flex flex-col bg-background">
          {/* Header - Outside Puck Layout */}
          <header className="flex items-center gap-3 px-6 py-3 bg-background border-b shrink-0">
            {/* Left Section - Back Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/webbuilder")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>

            <div className="h-6 w-px bg-border" />

            {/* Center/Flex Section - Title with Status and Language Selector */}
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-base truncate">{slug || "home"}</span>
                {publishing && (
                  <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded font-medium whitespace-nowrap">
                    Publishing...
                  </span>
                )}
                {isPublished && !publishing && (
                  <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded font-medium whitespace-nowrap">
                    Live
                  </span>
                )}
              </div>

              {/* Language Selector */}
              <LanguageSelector />
            </div>

            <div className="h-6 w-px bg-border" />

            {/* Undo/Redo buttons portal target */}
            <div ref={setUndoRedoPortal} />

            <div className="h-6 w-px bg-border" />

            {/* Right Section - Tools and Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setManageGroupsOpen(true)}
              >
                <LayoutGrid className="h-4 w-4 mr-2" />
                Manage Groups
              </Button>
              <div className="h-6 w-px bg-border" />
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPreviewMode(true)}
              >
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <div className="h-6 w-px bg-border" />
              <ModeToggle />
              <Button
                size="sm"
                onClick={publish}
                disabled={publishing}
              >
                {publishing ? "Publishing..." : "Publish"}
              </Button>
            </div>
          </header>

          {/* Puck Editor - Takes remaining space */}
          <div className="flex-1 overflow-hidden">
            <Puck
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              config={dynamicConfig as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data={data as any}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onChange={(newData: any) => updateData(newData)}
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
          <ManageGroupsDialog
            open={manageGroupsOpen}
            onOpenChange={setManageGroupsOpen}
          />
        </div>
        )}
      </PuckLanguageProvider>
    </TemplateProvider>
  );
}

// Language Selector Component
function LanguageSelector() {
  const { previewLanguage, setPreviewLanguage, availableLanguages } = usePuckLanguage();

  if (availableLanguages.length <= 1) {
    return null; // Don't show selector if only default language
  }

  return (
    <Select value={previewLanguage} onValueChange={setPreviewLanguage}>
      <SelectTrigger className="w-[180px] h-8">
        <Globe className="h-4 w-4 mr-2" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {availableLanguages.map((lang) => (
          <SelectItem key={lang} value={lang}>
            {LANGUAGES[lang] || lang} ({lang})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// Preview Mode Component
function PreviewModeContent({
  data,
  setIsPreviewMode,
}: {
  data: unknown;
  setIsPreviewMode: (value: boolean) => void;
}) {
  const { previewLanguage, setPreviewLanguage, availableLanguages } = usePuckLanguage();

  return (
    <div className="relative min-h-screen">
      <Layout>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <PuckPageRenderer data={data as any} />
      </Layout>

      {/* Floating controls - top-right */}
      <div className="fixed top-4 right-4 z-9999 flex gap-2">
        {/* Language Selector in Preview */}
        {availableLanguages.length > 1 && (
          <Select value={previewLanguage} onValueChange={setPreviewLanguage}>
            <SelectTrigger className="w-[180px] bg-background border shadow-lg">
              <Globe className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableLanguages.map((lang) => (
                <SelectItem key={lang} value={lang}>
                  {LANGUAGES[lang] || lang} ({lang})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Exit Preview Button */}
        <button
          onClick={() => setIsPreviewMode(false)}
          className="p-2 bg-background border border-border rounded-md shadow-lg hover:bg-accent transition-colors"
          aria-label="Exit Preview Mode"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}
