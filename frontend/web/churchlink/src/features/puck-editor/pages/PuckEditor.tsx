import { useMemo, useCallback, useState, useEffect, Component, type ReactNode, type ErrorInfo } from "react";
import { Puck } from "@puckeditor/core";
import type { ComponentData } from "@puckeditor/core";
import "@puckeditor/core/no-external.css";
import "../styles/puck-dark-overrides.css";
import "../styles/puck-fonts.css";
import { useParams, useNavigate } from "react-router-dom";
import { buildConfigWithTemplates } from "../config/buildConfigWithTemplates";
import { usePuckPage } from "../hooks/usePuckPage";
import { useCustomTemplates, type CustomTemplate } from "../hooks/useCustomTemplates";
import { TemplateProvider } from "../context/TemplateContext";
import { PuckLanguageProvider, usePuckLanguage } from "../context/PuckLanguageContext";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { ManageGroupsDialog } from "../components/ManageGroupsDialog";
import { PuckHeaderOverride } from "../components/PuckHeaderOverride";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Globe, X } from "lucide-react";
import Layout from "@/shared/layouts/Layout";
import { PuckPageRenderer } from "../components/PuckPageRenderer";
import { LANGUAGES } from "../utils/languageUtils";
import { loadGoogleFont, extractFontsFromData } from "../utils/fontLoader";

// Error boundary to catch Puck internal errors (e.g., during deletion)
class PuckErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; onReset: () => void }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Puck error caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full flex items-center justify-center bg-background">
          <div className="text-center space-y-4 p-8">
            <p className="text-destructive text-lg">Editor encountered an error</p>
            <p className="text-muted-foreground text-sm">{this.state.error?.message}</p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                this.props.onReset();
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
            >
              Reload Editor
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Loading skeleton for editor loading states
function LoadingSkeleton() {
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

// Transform Template_* components to GroupBlock
// This allows custom groups to use GroupBlock's behavior (delete, save, etc.)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformTemplatesToGroups(data: any, templates: CustomTemplate[]): any {
  // Build map of Template_* type names to template names
  const templateNames = new Map(
    templates.map(t => [
      `Template_${t.name.replace(/[^a-zA-Z0-9]/g, "")}`,
      t.name
    ])
  );

  // Recursively transform a component and its children
  const transformComponent = (comp: ComponentData): ComponentData => {
    // Check if this is a Template_* component
    if (comp.type.startsWith("Template_") && templateNames.has(comp.type)) {
      // Convert to GroupBlock with same props
      return {
        type: "GroupBlock",
        props: {
          ...comp.props,
          name: templateNames.get(comp.type) || "My Group",
        }
      };
    }

    // Recursively handle children slots
    if (Array.isArray(comp.props?.children)) {
      return {
        ...comp,
        props: {
          ...comp.props,
          children: (comp.props.children as ComponentData[]).map(transformComponent)
        }
      };
    }

    return comp;
  };

  // Transform all content components
  return {
    ...data,
    content: data.content?.map(transformComponent) || [],
  };
}

export default function PuckEditor() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [manageGroupsOpen, setManageGroupsOpen] = useState(false);
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

  // Extract fonts from page data for iframe injection
  const pageFonts = useMemo(() => extractFontsFromData(data), [data]);

  // Also load fonts in main document (for preview mode)
  useEffect(() => {
    pageFonts.forEach((fontValue) => {
      loadGoogleFont(fontValue);
    });
  }, [pageFonts]);

  // Handler for saving a component as template
  const handleSaveAsTemplate = useCallback(
    async (puckData: object, name: string, description?: string) => {
      await saveTemplate(name, puckData, description);
    },
    [saveTemplate]
  );

  // Wait for page data and templates to load
  if (loading || templatesLoading) {
    return <LoadingSkeleton />;
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
          // EDIT MODE - Puck with header override
          <div className="h-screen flex flex-col">
            <PuckErrorBoundary onReset={() => window.location.reload()}>
              <Puck
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                config={dynamicConfig as any}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                data={data as any}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                onChange={(newData: any) => {
                  // Transform Template_* to GroupBlock so they use GroupBlock's behavior
                  const transformed = transformTemplatesToGroups(newData, templates);
                  updateData(transformed);
                }}
                overrides={{
                  header: () => (
                    <PuckHeaderOverride
                      slug={slug || "home"}
                      onBack={() => navigate("/admin/webbuilder")}
                      onPreview={() => setIsPreviewMode(true)}
                      onManageGroups={() => setManageGroupsOpen(true)}
                      onPublish={publish}
                      publishing={publishing}
                      isPublished={isPublished}
                    />
                  ),
                }}
              />
            </PuckErrorBoundary>
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
