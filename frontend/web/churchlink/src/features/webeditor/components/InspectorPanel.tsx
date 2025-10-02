import React, { useMemo, useEffect } from "react";
import { Node, PageV2, SectionV2 } from "@/shared/types/pageV2";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/shared/components/ui/sheet";
import { Separator } from "@/shared/components/ui/separator";
import { ColorPicker, ColorPickerAlpha, ColorPickerHue, ColorPickerSelection, ColorPickerOutput } from "@/shared/components/ui/shadcn-io/color-picker";
import { NumericDragInput } from "@/shared/components/NumericDragInput";
import ElementTree from "./ElementTree";
import FontPicker from "./FontPicker";

interface InspectorPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedSectionId: string | null;
  selection: { sectionId?: string; nodeId?: string } | null;
  sections: SectionV2[];
  setSections: React.Dispatch<React.SetStateAction<SectionV2[]>>;
  highlightNodeId: string | null;
  setHighlightNodeId: (id: string | null) => void;
  updateSelectedNode: (updater: (node: Node) => Node) => void;
  page: PageV2 | null;
  setPage: React.Dispatch<React.SetStateAction<PageV2 | null>>;
  fontManager: any; // Font manager hook return type
  // gridSize removed from props, compute inside
}

const InspectorPanel: React.FC<InspectorPanelProps> = ({
  open,
  onOpenChange,
  selectedSectionId,
  selection,
  sections,
  setSections,
  setHighlightNodeId,
  updateSelectedNode,
  page,
  fontManager,
}) => {
  // Handle font selection for sections - save to section styleTokens
  const handleSectionFontSelect = React.useCallback((fontFamily: string) => {
    if (!selectedSectionId) return;
    
    setSections((prev) =>
      prev.map((s) =>
        s.id === selectedSectionId
          ? {
              ...s,
              styleTokens: {
                ...(s.styleTokens || {}),
                fontFamily: fontFamily || undefined,
              },
            }
          : s
      )
    );
  }, [selectedSectionId, setSections]);

  const findSelectedNode = useMemo(() => {
    return (sections: SectionV2[]): Node | undefined => {
      for (const s of sections) {
        if (s.id === selection?.sectionId) {
          const walk = (nodes: Node[]): Node | undefined => {
            for (const n of nodes) {
              if (n.id === selection?.nodeId) return n;
              if (n.children) {
                const found = walk(n.children);
                if (found) return found;
              }
            }
            return undefined;
          };
          return walk(s.children);
        }
      }
      return undefined;
    };
  }, [sections, selection]);

  const selectedNode = findSelectedNode(sections);

  // Get default wu/hu based on type
  const getDefaultWu = (type?: string): number => {
    switch (type) {
      case 'container': return 12;
      case 'text': return 8;
      case 'button': return 4;
      case 'eventList': return 12;
      default: return 8;
    }
  };
  const getDefaultHu = (type?: string): number => {
    switch (type) {
      case 'container': return 8;
      case 'text': return 2;
      case 'button': return 1;
      case 'eventList': return 6;
      default: return 2;
    }
  };

  // Current wu/hu values used via selectedNode directly below

  // Ensure selectedNode has layout if missing - run on selection change
  useEffect(() => {
    if (selection?.nodeId && selectedNode && !selectedNode.layout) {
      updateSelectedNode((n) => ({
        ...n,
        layout: { 
          units: { 
            xu: n.layout?.units?.xu ?? 0, 
            yu: n.layout?.units?.yu ?? 0, 
            wu: getDefaultWu(n.type), 
            hu: getDefaultHu(n.type) 
          } 
        }
      }));
    }
  }, [selection?.nodeId, selectedNode, updateSelectedNode, getDefaultWu, getDefaultHu]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" className="w-[460px] sm:w-[540px] p-0" onInteractOutside={(e) => e.preventDefault()}>
        <SheetHeader>
          <SheetTitle>Inspector</SheetTitle>
          <SheetDescription>
            Configure properties for the selected section or element.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          {selectedSectionId ? (
            <>
              <div className="space-y-3">
                <label className="text-sm font-medium">Section Font</label>
                <p className="text-xs text-muted-foreground">This font will apply to all elements in this section</p>
                <FontPicker
                  page={{
                    ...page,
                    styleTokens: {
                      defaultFontFamily: sections.find(s => s.id === selectedSectionId)?.styleTokens?.fontFamily,
                    },
                  } as PageV2}
                  setPage={(updater) => {
                    if (typeof updater === 'function') {
                      const updated = updater({ styleTokens: { defaultFontFamily: sections.find(s => s.id === selectedSectionId)?.styleTokens?.fontFamily } } as any);
                      handleSectionFontSelect(updated?.styleTokens?.defaultFontFamily || '');
                    }
                  }}
                  {...fontManager}
                />
              </div>
              <Separator />
              <div className="text-sm text-gray-500">Section: {selectedSectionId}</div>
              <Separator />
              <div className="space-y-4">
                <div>
                  <label className="text-sm mb-2 block">Background Color</label>
                  <div className="h-52 rounded border overflow-hidden p-3">
                    <ColorPicker
                      value={sections.find((s) => s.id === selectedSectionId)?.background?.style?.backgroundColor || "#ffffff"}
                      onChange={(c) => {
                        const css = typeof c === 'string' ? c : (typeof (c as any)?.string === 'function' ? (c as any).string() : String(c));
                        const currentCss = sections.find((s) => s.id === selectedSectionId)?.background?.style?.backgroundColor;
                        if (currentCss === css) return;
                        setSections((prev) =>
                          prev.map((s) =>
                            s.id === selectedSectionId
                              ? { ...s, background: { ...(s.background || {}), style: { ...(s.background?.style || {}), backgroundColor: css } } }
                              : s
                          )
                        );
                      }}
                      className="flex flex-col gap-2 h-full"
                    >
                      <div className="grid grid-rows-[1fr_1rem_1rem] gap-2 flex-1">
                        <ColorPickerSelection />
                        <ColorPickerHue />
                        <ColorPickerAlpha />
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <ColorPickerOutput />
                      </div>
                    </ColorPicker>
                  </div>
                </div>

                {/* Section height controls */}
                <div>
                  <label className="text-sm mb-2 block">Section Height (% of viewport)</label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min={10}
                      max={200}
                      step={5}
                      value={sections.find((s) => s.id === selectedSectionId)?.heightPercent ?? 100}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setSections((prev) =>
                          prev.map((s) =>
                            s.id === selectedSectionId
                              ? { ...s, heightPercent: val }
                              : s
                          )
                        );
                      }}
                      className="w-full"
                    />
                    <div className="flex items-center gap-2">
                      <NumericDragInput
                        min={10}
                        max={200}
                        step={5}
                        value={sections.find((s) => s.id === selectedSectionId)?.heightPercent ?? 100}
                        onChange={(val) => {
                          setSections((prev) =>
                            prev.map((s) =>
                              s.id === selectedSectionId
                                ? { ...s, heightPercent: Math.max(10, Math.min(200, val)) }
                                : s
                            )
                          );
                        }}
                        className="w-24"
                      />
                      <span className="text-xs text-muted-foreground">vh</span>
                    </div>
                  </div>
                </div>

                {/* Grid controls */}
                <div>
                  <label className="text-sm mb-2 block">Grid Settings (Builder Only)</label>
                  <div className="space-y-3">
                    <div>
                      <input
                        type="checkbox"
                        checked={sections.find((s) => s.id === selectedSectionId)?.builderGrid?.showGrid ?? true}
                        onChange={(e) => setSections((prev) =>
                          prev.map((s) =>
                            s.id === selectedSectionId
                              ? { ...s, builderGrid: { ...(s.builderGrid || {}), showGrid: e.target.checked } }
                              : s
                          )
                        )}
                      />
                      <span className="ml-2 text-sm">Show Grid Overlay</span>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Grid Size (px)</div>
                      <NumericDragInput
                        min={8}
                        max={64}
                        step={4}
                        value={sections.find((s) => s.id === selectedSectionId)?.builderGrid?.gridSize ?? 16}
                        onChange={(val) => {
                          setSections((prev) =>
                            prev.map((s) =>
                              s.id === selectedSectionId
                                ? { ...s, builderGrid: { ...(s.builderGrid || {}), gridSize: val } }
                                : s
                            )
                          );
                        }}
                        className="w-full"
                      />
                      <div className="text-xs text-muted-foreground mt-1">Grid cell size in pixels (8-64)</div>
                    </div>
                  </div>
                </div>
                <Separator />

                {/* Padding controls */}
                <div>
                  <label className="text-sm mb-2 block">Padding</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Padding X</div>
                      <input
                        type="range"
                        min={0}
                        max={6}
                        step={2}
                        value={
                          sections.find((s) => s.id === selectedSectionId)?.children?.[0]?.type === 'container'
                            ? ((sections.find((s) => s.id === selectedSectionId)?.children?.[0] as any)?.props?.paddingX ?? 4)
                            : 4
                        }
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setHighlightNodeId(
                            (sections.find((s) => s.id === selectedSectionId)?.children?.[0] as any)?.id || null
                          );
                          setSections((prev) =>
                            prev.map((s) => {
                              if (s.id !== selectedSectionId) return s;
                              const first = s.children?.[0] as any;
                              if (!first || first.type !== 'container') return s;
                              return {
                                ...s,
                                children: [
                                  { ...first, props: { ...(first.props || {}), paddingX: val } },
                                  ...(s.children?.slice(1) || []),
                                ] as Node[],
                              } as SectionV2;
                            })
                          );
                        }}
                        onMouseUp={() => setHighlightNodeId(null)}
                        onTouchEnd={() => setHighlightNodeId(null)}
                      />
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground mb-1">Padding Y</div>
                      <input
                        type="range"
                        min={0}
                        max={6}
                        step={2}
                        value={
                          sections.find((s) => s.id === selectedSectionId)?.children?.[0]?.type === 'container'
                            ? ((sections.find((s) => s.id === selectedSectionId)?.children?.[0] as any)?.props?.paddingY ?? 6)
                            : 6
                        }
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setHighlightNodeId(
                            (sections.find((s) => s.id === selectedSectionId)?.children?.[0] as any)?.id || null
                          );
                          setSections((prev) =>
                            prev.map((s) => {
                              if (s.id !== selectedSectionId) return s;
                              const first = s.children?.[0] as any;
                              if (!first || first.type !== 'container') return s;
                              return {
                                ...s,
                                children: [
                                  { ...first, props: { ...(first.props || {}), paddingY: val } },
                                  ...(s.children?.slice(1) || []),
                                ] as Node[],
                              } as SectionV2;
                            })
                          );
                        }}
                        onMouseUp={() => setHighlightNodeId(null)}
                        onTouchEnd={() => setHighlightNodeId(null)}
                      />
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Values map to Tailwind: 0,2,4,6 → px/py-0..px/py-6</div>
                </div>
                <Separator />
                <div>
                  <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">Elements</div>
                  <ElementTree
                    nodes={sections.find((s) => s.id === selectedSectionId)?.children ?? []}
                    onHover={setHighlightNodeId}
                    onLeave={() => setHighlightNodeId(null)}
                  />
                </div>
              </div>
            </>
          ) : selection?.nodeId ? (
            <>
              <div className="text-sm text-gray-500">Node ID: {selection.nodeId}</div>
              <Separator />
              {/* FORCED Width/Height sliders - always render for node selection */}
              <div className="border border-red-500 rounded-lg p-4 bg-yellow-50">
                <div className="text-sm font-bold mb-3 text-red-800">WIDTH & HEIGHT CONTROLS</div>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-sm">Width (units)</label>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={selectedNode?.layout?.units?.wu ?? 12}
                      onChange={(e) => {
                        const wu = Number(e.target.value);
                        if (selectedNode) {
                          updateSelectedNode((n) => ({
                            ...n,
                            layout: {
                              ...n.layout,
                              units: { 
                                ...n.layout?.units,
                                wu,
                                xu: n.layout?.units?.xu ?? 0,
                                yu: n.layout?.units?.yu ?? 0,
                                hu: n.layout?.units?.hu ?? 8
                              }
                            }
                          }));
                        }
                      }}
                      className="w-full"
                    />
                    <span className="text-xs text-muted-foreground">12 units (~192px)</span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm">Height (units)</label>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      step={1}
                      value={selectedNode?.layout?.units?.hu ?? 8}
                      onChange={(e) => {
                        const hu = Number(e.target.value);
                        if (selectedNode) {
                          updateSelectedNode((n) => ({
                            ...n,
                            layout: {
                              ...n.layout,
                              units: { 
                                ...n.layout?.units,
                                hu,
                                xu: n.layout?.units?.xu ?? 0,
                                yu: n.layout?.units?.yu ?? 0,
                                wu: n.layout?.units?.wu ?? 12
                              }
                            }
                          }));
                        }
                      }}
                      className="w-full"
                    />
                    <span className="text-xs text-muted-foreground">8 units (~128px)</span>
                  </div>
                </div>
              </div>
              <Separator />
              {/* Rest of type-specific fields */}
              {selectedNode?.type === 'text' && (
                <div className="space-y-2">
                  <label className="text-sm">Text / HTML</label>
                  <textarea
                    className="w-full h-28 border rounded p-2"
                    defaultValue={(selectedNode as any).props?.html ?? ''}
                    onChange={(e) =>
                      updateSelectedNode((n) => ({
                        ...n,
                        props: { ...(n.props || {}), html: e.target.value }
                      }))
                    }
                  />
                </div>
              )}
              {selectedNode?.type === 'button' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm">Button Label</label>
                    <input
                      className="w-full border rounded p-2"
                      defaultValue={(selectedNode as any).props?.label ?? ''}
                      onChange={(e) =>
                        updateSelectedNode((n) => ({
                          ...n,
                          props: { ...(n.props || {}), label: e.target.value }
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm">Button Link</label>
                    <input
                      className="w-full border rounded p-2"
                      defaultValue={(selectedNode as any).props?.href ?? ''}
                      onChange={(e) =>
                        updateSelectedNode((n) => ({
                          ...n,
                          props: { ...(n.props || {}), href: e.target.value }
                        }))
                      }
                    />
                  </div>
                </>
              )}
              {selectedNode?.type === 'container' && (
                <>
                  {/* Container-specific below sliders */}
                  <div className="space-y-2">
                    <label className="text-sm">Max Width Preset</label>
                    <select
                      value={(selectedNode as any).props?.maxWidth ?? 'xl'}
                      onChange={(e) => updateSelectedNode((n) => ({
                        ...n,
                        props: { ...(n.props || {}), maxWidth: e.target.value }
                      }))}
                      className="w-full border rounded p-2"
                    >
                      <option value="full">Full</option>
                      <option value="2xl">2XL</option>
                      <option value="xl">XL</option>
                      <option value="lg">LG</option>
                      <option value="md">MD</option>
                      <option value="sm">SM</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm">Padding X</label>
                      <input
                        type="range"
                        min={0}
                        max={6}
                        step={2}
                        value={(selectedNode as any).props?.paddingX ?? 4}
                        onChange={(e) => updateSelectedNode((n) => ({
                          ...n,
                          props: { ...(n.props || {}), paddingX: Number(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-sm">Padding Y</label>
                      <input
                        type="range"
                        min={0}
                        max={6}
                        step={2}
                        value={(selectedNode as any).props?.paddingY ?? 6}
                        onChange={(e) => updateSelectedNode((n) => ({
                          ...n,
                          props: { ...(n.props || {}), paddingY: Number(e.target.value) }
                        }))}
                        className="w-full"
                      />
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="text-sm text-gray-500">Select a section or element.</div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default InspectorPanel;
