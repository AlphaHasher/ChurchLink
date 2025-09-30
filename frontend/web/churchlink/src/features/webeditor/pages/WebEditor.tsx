import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { DynamicPageV2RendererBuilder } from "@/features/webeditor/grid/DynamicPageV2RendererBuilder";
import { ModeToggle } from "@/shared/components/ModeToggle";
import EditorSidebar from "@/features/webeditor/components/EditorSidebar";
import { SidebarInset, SidebarProvider } from "@/shared/components/ui/sidebar";
import { Checkbox } from "@/shared/components/ui/checkbox";
import NavBar from "@/shared/components/NavBar";
import Footer from "@/shared/components/Footer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader as ADHeader, AlertDialogTitle } from "@/shared/components/ui/alert-dialog";
import InspectorPanel from "../components/InspectorPanel";
import ElementInspector from "../components/ElementInspector";
import { usePageManager } from "../hooks/usePageManager";
import { useSectionManager } from "../hooks/useSectionManager";
import { useFontManager } from "../hooks/useFontManager";
import { ELEMENTS, SECTION_PRESETS } from "../utils/sectionHelpers";
import { Node } from "@/shared/types/pageV2";

const WebEditor: React.FC = () => {
  const { slug: encoded } = useParams();
  const slug = useMemo(() => (encoded ? decodeURIComponent(encoded) : ""), [encoded]);
  const navigate = useNavigate();

  // Page management
  const {
    page,
    setPage,
    sections,
    setSections: setPageSections,
    showHeader,
    setShowHeader,
    showFooter,
    setShowFooter,
    publish,
  } = usePageManager(slug);

  // Section management
  const {
    sections: managedSections,
    setSections,
    selection,
    setSelection,
    selectedSectionId,
    setSelectedSectionId,
    highlightNodeId,
    setHighlightNodeId,
    hoveredNodeId,
    setHoveredNodeId,
    deleteSectionId,
    setDeleteSectionId,
    addSection,
    addSectionPreset,
    addElement,
    onSelectNode,
    updateSelectedNode,
    deleteSection,
    updateNodeLayout,
  } = useSectionManager();

  // Font management
  const fontManager = useFontManager(page, setPage);

  // Sync sections between page manager and section manager
  React.useEffect(() => {
    if (sections.length > 0 && managedSections.length === 0) {
      setSections(sections);
    }
  }, [sections, managedSections.length, setSections]);

  React.useEffect(() => {
    if (managedSections.length > 0) {
      setPageSections(managedSections);
    }
  }, [managedSections, setPageSections]);

  const [openInspector, setOpenInspector] = React.useState(false);
  const [openElementInspector, setOpenElementInspector] = React.useState(false);

  const handleFocusSection = (id: string) => {
    const el = document.getElementById(`section-${id}`) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setSelectedSectionId(id);
    setSelection(null);
    setOpenInspector(true);
    setOpenElementInspector(false);
  };

  const handleNodeClick = React.useCallback((sectionId: string, nodeId: string) => {
    onSelectNode(sectionId, nodeId);
    setSelectedSectionId(null);
    setOpenInspector(false);
    setOpenElementInspector(true);
    setHighlightNodeId(nodeId);
  }, [onSelectNode, setSelectedSectionId, setHighlightNodeId]);

  const handleNodeHover = React.useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
  }, [setHoveredNodeId]);

  // Find the selected node from the sections tree
  const findNode = React.useCallback((nodeId: string): Node | null => {
    const walk = (nodes: Node[]): Node | null => {
      for (const node of nodes) {
        if (node.id === nodeId) return node;
        if (node.children) {
          const found = walk(node.children);
          if (found) return found;
        }
      }
      return null;
    };
    
    for (const section of managedSections) {
      const found = walk(section.children);
      if (found) return found;
    }
    return null;
  }, [managedSections]);

  const selectedNode = selection?.nodeId ? findNode(selection.nodeId) : null;

  // Debug: log font changes (must be before conditional return)
  React.useEffect(() => {
    if (page) {
      console.log("Page styleTokens:", page.styleTokens);
    }
  }, [page?.styleTokens]);

  if (!page) return <div className="p-6">Loading...</div>;

  return (
    <SidebarProvider
      style={{
        ["--sidebar-width" as any]: "14rem",
        ["--sidebar-width-icon" as any]: "2.75rem",
      }}
    >
      {/* Full-width fixed top bar */}
      <div className="fixed inset-x-0 top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
        <div className="flex h-12 items-center justify-between px-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/admin/webbuilder')}>Back to Admin</Button>
            <div className="hidden sm:flex items-center gap-3 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={showHeader} onCheckedChange={(v) => setShowHeader(Boolean(v))} />
                <span>Header</span>
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={showFooter} onCheckedChange={(v) => setShowFooter(Boolean(v))} />
                <span>Footer</span>
              </label>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={`/${slug ? slug.replace(/^\/+/, '') : ''}?staging=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 h-9 px-4 py-2 rounded-md text-sm"
            >
              Preview
            </a>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={publish}>Publish</Button>
            <ModeToggle />
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <EditorSidebar
        onAddSection={addSection}
        elements={ELEMENTS}
        onAddElement={(t) => addElement(t as any)}
        sectionPresets={SECTION_PRESETS}
        onAddSectionPreset={addSectionPreset}
        currentSections={managedSections.map((s, i) => ({ id: s.id, label: s.kind === 'section' ? `Section ${i + 1}` : s.id }))}
        onFocusSection={handleFocusSection}
        onDeleteSection={(id) => setDeleteSectionId(id)}
        pageTitle={page.title}
        slug={slug}
      />

      {/* Canvas - full available width/height */}
      <SidebarInset className="h-[calc(100vh-48px)] mt-12 overflow-auto bg-white text-gray-900">
        <div className="min-h-full">
          {showHeader && (
            <div className="border-b">
              <NavBar />
            </div>
          )}
          {managedSections.map((s) => (
            <div id={`section-${s.id}`} key={s.id} className={s.fullHeight ? "min-h-screen border-b group/section relative" : "border-b group/section relative"}>
              <button
                className="opacity-0 group-hover/section:opacity-100 transition-opacity absolute top-2 right-2 z-10 rounded bg-red-600 text-white text-xs px-2 py-1"
                onClick={() => setDeleteSectionId(s.id)}
                title="Delete section"
              >
                Delete
              </button>
              {/* Builder renderer with grid and draggable support */}
              <DynamicPageV2RendererBuilder
                page={{ ...page, sections: [s] }}
                highlightNodeId={highlightNodeId || undefined}
                hoveredNodeId={hoveredNodeId}
                selectedNodeId={selection?.nodeId || null}
                onUpdateNodeLayout={updateNodeLayout}
                onNodeHover={handleNodeHover}
                onNodeClick={handleNodeClick}
              />
            </div>
          ))}
          {showFooter && (
            <div className="border-t">
              <Footer />
            </div>
          )}
        </div>
      </SidebarInset>

      {/* Right Inspector Sheet - Section */}
      <InspectorPanel
        open={openInspector}
        onOpenChange={setOpenInspector}
        selectedSectionId={selectedSectionId}
        selection={selection}
        sections={managedSections}
        setSections={setSections}
        highlightNodeId={highlightNodeId}
        setHighlightNodeId={setHighlightNodeId}
        updateSelectedNode={updateSelectedNode}
        page={page}
        setPage={setPage}
        fontManager={fontManager}
      />

      {/* Right Inspector Sheet - Element */}
      <ElementInspector
        open={openElementInspector}
        onOpenChange={(open) => {
          setOpenElementInspector(open);
          if (!open) {
            setSelection(null);
            setHighlightNodeId(null);
          }
        }}
        selectedNode={selectedNode}
        onUpdateNode={updateSelectedNode}
        fontManager={fontManager}
      />

      {/* Delete Section Confirm */}
      <AlertDialog open={!!deleteSectionId} onOpenChange={(open) => !open && setDeleteSectionId(null)}>
        <AlertDialogContent>
          <ADHeader>
            <AlertDialogTitle>Delete this section?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The section will be permanently removed from this page.
            </AlertDialogDescription>
          </ADHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteSectionId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={deleteSection}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
};

export default WebEditor;
