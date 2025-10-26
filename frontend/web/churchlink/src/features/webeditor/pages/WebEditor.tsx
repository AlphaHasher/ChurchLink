import React, { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { DynamicPageV2RendererBuilder } from "@/features/webeditor/grid/DynamicPageV2RendererBuilder";
import { ModeToggle } from "@/shared/components/ModeToggle";
import MultiStateBadge from "@/shared/components/MultiStageBadge";
import EditorSidebar from "@/features/webeditor/components/EditorSidebar";
import { SidebarInset, SidebarProvider } from "@/shared/components/ui/sidebar";
import NavBar from "@/shared/components/NavBar";
import Footer from "@/shared/components/Footer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader as ADHeader, AlertDialogTitle } from "@/shared/components/ui/alert-dialog";
import InspectorPanel from "../components/InspectorPanel";
import ElementInspector from "../components/ElementInspector";
import { usePageManager } from "../hooks/usePageManager";
import { useSectionManager } from "../hooks/useSectionManager";
import { useFontManager } from "../hooks/useFontManager";
import { ELEMENTS, SECTION_PRESETS } from "../utils/sectionHelpers";
import { Node, SectionV2 } from "@/shared/types/pageV2";
import { BuilderState } from "@/features/webeditor/state/BuilderState";

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
    liveVisible,
    inSyncWithLive,
    saveState,
    publishState,
    publish,
    addLocale,
    activeLocale,
    setActiveLocale,
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
    deleteNodeId,
    setDeleteNodeId,
    deleteNode,
    copySelected,
    pasteClipboard,
    deleteSelectedNode,
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
  const [addLocaleOpen, setAddLocaleOpen] = React.useState(false);


  const computedLocales = useMemo(() => {
    const set = new Set<string>();
    const dl = String((page as any)?.defaultLocale || 'en');
    if (dl) set.add(dl);
    for (const l of (page?.locales || [])) {
      if (l) set.add(String(l));
    }
    const findFirstWithI18n = (nodes?: Node[] | null): Record<string, any> | null => {
      if (!nodes) return null;
      for (const n of nodes) {
        const i18n = (n as any)?.i18n as Record<string, any> | undefined;
        if (i18n && typeof i18n === 'object' && Object.keys(i18n).length) return i18n;
        const child = findFirstWithI18n((n as any)?.children);
        if (child) return child;
      }
      return null;
    };
    let i18nMap: Record<string, any> | null = null;
    for (const s of (managedSections.length ? managedSections : (page?.sections || []))) {
      i18nMap = findFirstWithI18n((s as SectionV2).children as any);
      if (i18nMap) break;
    }
    if (i18nMap) {
      for (const key of Object.keys(i18nMap)) {
        if (key) set.add(String(key));
      }
    }
    const result = Array.from(set);
    result.sort((a, b) => (a === dl ? -1 : b === dl ? 1 : a.localeCompare(b)));
    return result.length ? result : ['en'];
  }, [page, managedSections]);  

  // Collect translatable text pairs from current sections



  const handleFocusSection = (id: string) => {
    const el = document.getElementById(`section-${id}`) as HTMLElement | null;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setSelectedSectionId(id);
    setSelection(null);
    // Focus does not open inspector; open on double click instead
    setOpenInspector(false);
    setOpenElementInspector(false);
  };

  // Single click on canvas: select only; do not open element inspector
  const handleNodeClick = React.useCallback((sectionId: string, nodeId: string) => {
    onSelectNode(sectionId, nodeId);
    setSelectedSectionId(null);
    setOpenInspector(false);
    setOpenElementInspector(false);
    setHighlightNodeId(nodeId);
    BuilderState.stopEditing();
  }, [onSelectNode, setSelectedSectionId, setHighlightNodeId]);

  // Single click from sidebar: open element inspector immediately
  const handleSidebarNodeFocus = React.useCallback((sectionId: string, nodeId: string) => {
    onSelectNode(sectionId, nodeId);
    setSelectedSectionId(null);
    setOpenInspector(false);
    setOpenElementInspector(true);
    setHighlightNodeId(nodeId);
    BuilderState.stopEditing();
  }, [onSelectNode, setSelectedSectionId, setHighlightNodeId]);

  // Double click: open element inspector
  const handleNodeDoubleClick = React.useCallback((sectionId: string, nodeId: string) => {
    onSelectNode(sectionId, nodeId);
    setSelectedSectionId(null);
    setOpenInspector(false);
    setOpenElementInspector(true);
    setHighlightNodeId(nodeId);
    BuilderState.stopEditing();
  }, [onSelectNode, setSelectedSectionId, setHighlightNodeId]);

  const handleNodeHover = React.useCallback((nodeId: string | null) => {
    setHoveredNodeId(nodeId);
  }, [setHoveredNodeId]);

  const handleCanvasMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const draggable = target.closest('[data-draggable="true"]');
    if (draggable) return;

    if (target.closest('button')) return;
    if (target.closest('[data-toolbar-ignore="true"]')) return;

    const targetSectionId = target.closest('[data-section-id]')?.getAttribute('data-section-id');
    if (targetSectionId) {
      if (selectedSectionId !== targetSectionId) {
        setSelectedSectionId(targetSectionId);
      }
      setSelection(null);
      setHighlightNodeId(null);
      setHoveredNodeId(null);
      setOpenElementInspector(false);
      // Single click selects section only; open inspector on double click
      setOpenInspector(false);
      BuilderState.clearSelection();
      BuilderState.stopEditing();
      return;
    }

    BuilderState.clearSelection();
    setSelection(null);
    setSelectedSectionId(null);
    setHighlightNodeId(null);
    setHoveredNodeId(null);
    setOpenElementInspector(false);
    BuilderState.stopEditing();
  }, [selectedSectionId, setSelection, setHighlightNodeId, setHoveredNodeId, setSelectedSectionId, setOpenElementInspector, setOpenInspector]);

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
  const selectedSectionForNode = selection?.sectionId ? managedSections.find(s => s.id === selection.sectionId) : undefined;
  const selectedGridSize = selectedSectionForNode?.builderGrid?.gridSize ?? 16;

  // Global keyboard shortcuts for copy/paste selected element
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputLike = !!target && (
        target.tagName.toLowerCase() === 'input' ||
        target.tagName.toLowerCase() === 'textarea' ||
        target.isContentEditable
      );
      if (isInputLike) return;

      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      const key = e.key.toLowerCase();
      if (key === 'c') {
        e.preventDefault();
        copySelected();
      } else if (key === 'v') {
        e.preventDefault();
        pasteClipboard();
      } else if (key === 'z') {
        e.preventDefault();
        const isRedo = e.shiftKey;
        const action = isRedo ? BuilderState.redo() : BuilderState.undo();
        if (!action) return;
        // Apply the action by mutating editor state without recording new history
        if (action.type === 'layout') {
          BuilderState.withoutHistory(() => {
            setSections((prev) => prev.map((s) => {
              if (s.id !== action.sectionId) return s;
              const walk = (nodes: Node[]): Node[] => nodes.map((n) => {
                if (n.id === action.nodeId) {
                  const target = isRedo ? action.next : action.prev;
                  BuilderState.clearNodePixelLayout(action.sectionId, action.nodeId);
                  return { ...n, layout: { units: { ...target } } } as Node;
                }
                if (n.children && n.children.length) return { ...n, children: walk(n.children) } as Node;
                return n;
              });
              return { ...s, children: walk(s.children) };
            }));
          });
        } else if (action.type === 'node') {
          BuilderState.withoutHistory(() => {
            setSections((prev) => prev.map((s) => {
              if (s.id !== action.sectionId) return s;
              const walk = (nodes: Node[]): Node[] => nodes.map((n) => {
                if (n.id === action.nodeId) {
                  const target = (isRedo ? action.next : action.prev) as Node;
                  // Replace entire node snapshot (units only, no px cache)
                  return { ...target } as Node;
                }
                if (n.children && n.children.length) return { ...n, children: walk(n.children) } as Node;
                return n;
              });
              return { ...s, children: walk(s.children) };
            }));
          });
        } else if (action.type === 'select') {
          const targetSel = isRedo ? action.next : action.prev;
          setSelection(targetSel);
          BuilderState.setSelectionSilent(targetSel);
        }
      } else if (key === 'y') {
        e.preventDefault();
        const action = BuilderState.redo();
        if (!action) return;
        if (action.type === 'layout') {
          BuilderState.withoutHistory(() => {
            setSections((prev) => prev.map((s) => {
              if (s.id !== action.sectionId) return s;
              const walk = (nodes: Node[]): Node[] => nodes.map((n) => {
                if (n.id === action.nodeId) {
                  BuilderState.clearNodePixelLayout(action.sectionId, action.nodeId);
                  return { ...n, layout: { units: { ...action.next } } } as Node;
                }
                if (n.children && n.children.length) return { ...n, children: walk(n.children) } as Node;
                return n;
              });
              return { ...s, children: walk(s.children) };
            }));
          });
        } else if (action.type === 'node') {
          BuilderState.withoutHistory(() => {
            setSections((prev) => prev.map((s) => {
              if (s.id !== action.sectionId) return s;
              const walk = (nodes: Node[]): Node[] => nodes.map((n) => {
                if (n.id === action.nodeId) {
                  return { ...(action.next as Node) } as Node;
                }
                if (n.children && n.children.length) return { ...n, children: walk(n.children) } as Node;
                return n;
              });
              return { ...s, children: walk(s.children) };
            }));
          });
        } else if (action.type === 'select') {
          setSelection(action.next);
          BuilderState.setSelectionSilent(action.next);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [copySelected, pasteClipboard]);

  // Delete/Backspace to delete selected element
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputLike = !!target && (
        target.tagName.toLowerCase() === 'input' ||
        target.tagName.toLowerCase() === 'textarea' ||
        target.isContentEditable
      );
      if (isInputLike) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        // Only delete element if an element is selected; don't interfere with section text inputs
        if (selection?.nodeId) {
          e.preventDefault();
          deleteSelectedNode();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selection?.nodeId, deleteSelectedNode]);

  const sanitizeLabel = (value: unknown, fallback: string): string => {
    if (typeof value !== "string") return fallback;
    const stripped = value.replace(/<[^>]+>/g, '').trim();
    if (!stripped) return fallback;
    return stripped.length > 40 ? `${stripped.slice(0, 37)}…` : stripped;
  };

  const resolveSectionLabel = (section: SectionV2, index: number): string => {
    const tokenName = (section.styleTokens as any)?.name;
    if (typeof tokenName === 'string' && tokenName.trim()) {
      return tokenName.trim();
    }
    return `Section ${index + 1}`;
  };

  const buildSidebarTree = React.useCallback((section: SectionV2, index: number) => {
    const walk = (nodes: Node[], owningSectionId: string): Array<{ id: string; label: string; type: 'section' | 'container' | 'node'; sectionId: string; children?: any[] }> =>
      nodes.map((node) => {
        const baseLabel = node.type === 'container'
          ? 'Container'
          : node.type === 'text'
          ? 'Text'
          : node.type === 'button'
          ? 'Button'
          : node.type === 'eventList'
          ? 'Event List'
          : 'Element';

        const candidate = (node as any).props?.label
          ?? (node as any).props?.variant
          ?? (node as any).props?.html
          ?? baseLabel;

        return {
          id: node.id,
          label: sanitizeLabel(candidate, baseLabel),
          type: node.type === 'container' ? 'container' : 'node',
          sectionId: owningSectionId,
          children: node.children ? walk(node.children, owningSectionId) : undefined,
        };
      });

    return {
      id: section.id,
      label: resolveSectionLabel(section, index),
      type: 'section' as const,
      sectionId: section.id,
      children: section.children ? walk(section.children, section.id) : [],
    };
  }, []);

  // Debug: log font changes (must be before conditional return)
  React.useEffect(() => {
    if (page) {
      console.log("Page styleTokens:", page.styleTokens);
    }
  }, [page?.styleTokens]);

  // Control left sidebar open to avoid initial hover flicker
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const lastOpenTsRef = React.useRef(0);
  const handleSidebarOpenChange = React.useCallback((next: boolean) => {
    if (next) {
      lastOpenTsRef.current = Date.now();
      setSidebarOpen(true);
      return;
    }
    // Grace period to prevent immediate close flicker on first hover
    if (Date.now() - lastOpenTsRef.current < 200) return;
    setSidebarOpen(false);
  }, []);

  if (!page) return <div className="p-6">Loading...</div>;

  return (
    <SidebarProvider
      open={sidebarOpen}
      onOpenChange={handleSidebarOpenChange}
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
            {/* Locale switcher */}
            <div className="hidden md:flex items-center gap-2 mr-2">
              <Select value={computedLocales.includes(String((page as any)?.defaultLocale || 'en')) ? (activeLocale || (page as any)?.defaultLocale || 'en') : (activeLocale || 'en')} onValueChange={(val) => setActiveLocale(val)}>
                <SelectTrigger className="w-[120px]"><SelectValue placeholder="Locale" /></SelectTrigger>
                <SelectContent>
                  {computedLocales.map((lc) => (
                    <SelectItem key={lc} value={lc}>{lc}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <AddLocaleDialog
                open={addLocaleOpen}
                onOpenChange={setAddLocaleOpen}
                siteLocales={computedLocales}
                addSiteLocale={() => {}}
                refreshSiteLocales={() => {}}
                onAddLocale={async (code: string) => {
                  addLocale(code);
                  const src = String((page as any)?.defaultLocale || 'en');
                  const pairs = collectTranslatablePairs(managedSections);
                  const items = Array.from(new Set(pairs.map((p: { id: string; key: string; value: string }) => p.value).filter(Boolean)));
                  if (items.length) {
                    const res = await translateStrings(items, [code], src);
                    const map = res;
                    setSections(ensurePageLocale(managedSections, code, map));
                  }
                }}
              />
            </div>
            {/* Save status badge */}
            <MultiStateBadge
              state={saveState}
              customComponent={
                <span
                  className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                    saveState === "processing"
                      ? "bg-amber-500/20 text-amber-600 dark:bg-amber-400 dark:text-amber-900"
                      : saveState === "error"
                      ? "bg-red-500/20 text-red-600 dark:bg-red-400 dark:text-red-900"
                      : saveState === "success"
                      ? "bg-green-500/20 text-green-600 dark:bg-green-400 dark:text-green-900"
                      : "bg-gray-500/10 text-gray-600 dark:text-gray-300"
                  }`}
                >
                  {saveState === "processing" ? "Saving…" : saveState === "success" ? "Saved" : saveState === "error" ? "Save Failed" : "Idle"}
                </span>
              }
            />

            {/* Live visibility indicator (considers in-sync) */}
            <MultiStateBadge
              state="custom"
              customComponent={
                <span
                  className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                    liveVisible && inSyncWithLive
                      ? "bg-green-500/20 text-green-600 dark:bg-green-400 dark:text-green-900"
                      : "bg-red-500/20 text-red-600 dark:bg-red-400 dark:text-red-900"
                  }`}
                >
                  {liveVisible && inSyncWithLive ? "Live" : "Not Live"}
                </span>
              }
            />
            <a
              href={`/${slug ? slug.replace(/^\/+/, '') : ''}?staging=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 h-9 px-4 py-2 rounded-md text-sm"
            >
              Preview
            </a>
            <MultiStateBadge
              state={publishState}
              onClick={publish}
              customComponent={
                <Button className="bg-blue-600 hover:bg-blue-700">Publish</Button>
              }
            />
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
        currentSections={managedSections.map((section, index) => buildSidebarTree(section, index))}
        onFocusSection={handleFocusSection}
        onFocusNode={handleSidebarNodeFocus}
        onDeleteSection={(id) => setDeleteSectionId(id)}
        pageTitle={page.title}
        slug={slug}
      />

      

      {/* Canvas - full available width/height */}
      <SidebarInset className="h-[calc(100vh-48px)] mt-12 overflow-auto bg-white text-gray-900">
        <div className="min-h-full" onMouseDown={handleCanvasMouseDown}>
          {showHeader && (
            <div className="border-b">
              <NavBar />
            </div>
          )}
          {managedSections.map((s) => (
            <div
              id={`section-${s.id}`}
              key={s.id}
              data-section-id={s.id}
              className={"border-b group/section relative h-full"}
              style={{ minHeight: `${(s.heightPercent ?? 100)}vh` }}
              onDoubleClick={(e) => {
                e.stopPropagation();
                setSelectedSectionId(s.id);
                setSelection(null);
                setOpenElementInspector(false);
                setOpenInspector(true);
              }}
            >
              <button
                className="opacity-0 group-hover/section:opacity-100 transition-opacity absolute top-2 right-2 z-10 rounded bg-red-600 text-white text-xs px-2 py-1"
                onClick={() => {
                  if (selection?.sectionId === s.id && selection?.nodeId) {
                    setDeleteNodeId({ sectionId: s.id, nodeId: selection.nodeId });
                  } else {
                    setDeleteSectionId(s.id);
                  }
                }}
                title="Delete section"
              >
                Delete
              </button>
              {/* Builder renderer with grid and draggable support */}
              <DynamicPageV2RendererBuilder
                page={{ ...page, sections: [s] }}
                activeLocale={activeLocale}
                defaultLocale={(page as any)?.defaultLocale || 'en'}
                highlightNodeId={highlightNodeId || undefined}
                hoveredNodeId={hoveredNodeId}
                selectedNodeId={selection?.nodeId || null}
                onUpdateNodeLayout={updateNodeLayout}
                onNodeHover={handleNodeHover}
                onNodeClick={handleNodeClick}
                onNodeDoubleClick={handleNodeDoubleClick}
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
        onRequestDeleteSection={setDeleteSectionId}
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
        activeLocale={activeLocale}
        defaultLocale={(page as any)?.defaultLocale || 'en'}
        fontManager={fontManager}
        gridSize={selectedGridSize}
        onRequestDeleteNode={() => {
          if (selection?.sectionId && selection?.nodeId) {
            setDeleteNodeId({ sectionId: selection.sectionId, nodeId: selection.nodeId });
          }
        }}
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

      {/* Delete Node Confirm */}
      <AlertDialog open={!!deleteNodeId} onOpenChange={(open) => !open && setDeleteNodeId(null)}>
        <AlertDialogContent>
          <ADHeader>
            <AlertDialogTitle>Delete this element?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The element will be permanently removed from this page.
            </AlertDialogDescription>
          </ADHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteNodeId(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={deleteNode}
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
