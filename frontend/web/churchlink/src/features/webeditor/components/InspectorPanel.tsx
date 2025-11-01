import React, { useMemo, useEffect } from "react";
import { Input } from "@/shared/components/ui/input";
import { Node, PageV2, SectionV2 } from "@/shared/types/pageV2";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/shared/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { Separator } from "@/shared/components/ui/separator";
import { ColorPicker, ColorPickerAlpha, ColorPickerHue, ColorPickerSelection, ColorPickerOutput } from "@/shared/components/ui/shadcn-io/color-picker";
import { Label } from "@/shared/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { NumericDragInput } from "@/shared/components/NumericDragInput";
import ElementTree from "./ElementTree";
import FontPicker from "./FontPicker";
import { BuilderState } from "@/features/webeditor/state/BuilderState";
import { Button } from "@/shared/components/ui/button";
import { unitsToPx, pxToUnits } from "@/features/webeditor/grid/gridMath";

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
  onRequestDeleteSection?: (id: string) => void;
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
  onRequestDeleteSection,
}) => {

  const oldGridSizeRef = React.useRef<number | null>(null);

  
  const capturePixelPositions = React.useCallback((section: SectionV2, oldGridSize: number) => {
    const walk = (nodes: Node[], sectionId: string) => {
      nodes.forEach((node) => {
        if (node.layout?.units) {
          const { xu, yu, wu, hu } = node.layout.units;
          const px = {
            x: unitsToPx(xu ?? 0, oldGridSize),
            y: unitsToPx(yu ?? 0, oldGridSize),
            ...(typeof wu === 'number' ? { w: unitsToPx(wu, oldGridSize) } : {}),
            ...(typeof hu === 'number' ? { h: unitsToPx(hu, oldGridSize) } : {}),
          };
          BuilderState.setNodePixelLayout(sectionId, node.id, px);
        }
        if (node.children && node.children.length > 0) {
          walk(node.children, sectionId);
        }
      });
    };
    walk(section.children || [], section.id);
  }, []);

  // Helper function to convert pixel positions back to grid units (returns updated sections)
  const convertPixelsToUnits = React.useCallback((sectionId: string, newGridSize: number, prevSections: SectionV2[]): SectionV2[] => {
    return prevSections.map((s) => {
      if (s.id !== sectionId) return s;
      const walk = (nodes: Node[]): Node[] =>
        nodes.map((n): Node => {
          const cachedPx = BuilderState.getNodePixelLayout(n.id);
          if (cachedPx && cachedPx.sectionId === sectionId && n.layout?.units) {
            // Convert cached pixels to new grid units
            const newUnits = {
              xu: pxToUnits(cachedPx.x, newGridSize),
              yu: pxToUnits(cachedPx.y, newGridSize),
              wu: typeof cachedPx.w === 'number' ? pxToUnits(cachedPx.w, newGridSize) : n.layout.units.wu,
              hu: typeof cachedPx.h === 'number' ? pxToUnits(cachedPx.h, newGridSize) : n.layout.units.hu,
            };
            // Clear pixel cache
            BuilderState.clearNodePixelLayout(sectionId, n.id);
            return {
              ...n,
              layout: { units: newUnits },
            } as Node;
          }
          if (n.children && n.children.length > 0) {
            return { ...n, children: walk(n.children) } as Node;
          }
          return n;
        });
      return { ...s, children: walk(s.children || []) };
    });
  }, []);

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

  const [secBgOpen, setSecBgOpen] = React.useState(false);

  // Background editor for Sections (solid, gradient, custom CSS)
  const SectionBackgroundEditor: React.FC<{ open: boolean }> = React.useCallback(({ open }) => {
    const section = sections.find((s) => s.id === selectedSectionId);
    const style = (section?.background?.style || {}) as any;
    const bgString = String((style.background ?? style.backgroundImage ?? '') as string).trim();
    const hasBackground = bgString.length > 0;
    const isLinear = /linear-gradient\(/i.test(bgString);

    const extractColorOnly = React.useCallback((input: string | undefined): string => {
      if (!input) return '#4f46e5';
      const s = String(input).trim();
      const m = s.match(/(#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|hsl|oklch|lab|lch)\([^\)]+\))/);
      if (m && m[1]) return m[1].trim();
      return s.split(/\s+/)[0];
    }, []);

    const toCssColor = React.useCallback((value: any): string => {
      if (typeof value === 'string') return value;
      if (value && typeof value.string === 'function') {
        try { return value.string(); } catch {}
      }
      if (value && typeof value.hexa === 'function') {
        try { return value.hexa(); } catch {}
      }
      if (value && typeof value.hex === 'function') {
        try { return value.hex(); } catch {}
      }
      return String(value ?? '');
    }, []);

    const parseLinearGradient = React.useCallback((): { angle: number; c1: string; c2: string } => {
      if (!isLinear) return { angle: 90, c1: '#4f46e5', c2: '#3b82f6' };
      const raw = bgString;
      const start = raw.toLowerCase().indexOf('linear-gradient(');
      const end = raw.lastIndexOf(')');
      if (start === -1 || end === -1) return { angle: 90, c1: '#4f46e5', c2: '#3b82f6' };
      const inner = raw.slice(start + 'linear-gradient('.length, end);
      const parts: string[] = [];
      let depth = 0; let buf = '';
      for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (ch === '(') depth++;
        if (ch === ')') depth = Math.max(0, depth - 1);
        if (ch === ',' && depth === 0) { parts.push(buf.trim()); buf = ''; continue; }
        buf += ch;
      }
      if (buf.trim()) parts.push(buf.trim());

      const first = parts[0] || '';
      const isAngleToken = /deg|turn|rad|grad|^to\s+/i.test(first);
      const angleVal = (() => {
        if (!isAngleToken) return 90;
        const m = first.match(/([-+]?\d*\.?\d+)/);
        const n = m ? parseFloat(m[1]) : 90;
        return Number.isFinite(n) ? Math.max(0, Math.min(360, n)) : 90;
      })();

      const stop1 = isAngleToken ? (parts[1] || '#4f46e5') : (parts[0] || '#4f46e5');
      const stop2 = isAngleToken ? (parts[2] || '#3b82f6') : (parts[1] || '#3b82f6');
      return { angle: angleVal, c1: extractColorOnly(stop1), c2: extractColorOnly(stop2) };
    }, [isLinear, bgString, extractColorOnly]);

    const { angle: parsedAngle, c1: parsedC1, c2: parsedC2 } = React.useMemo(() => parseLinearGradient(), [parseLinearGradient]);

    const [mode, setMode] = React.useState<string>(
      hasBackground ? (isLinear ? 'gradient' : 'custom') : 'solid'
    );
    const [angle, setAngle] = React.useState<number>(parsedAngle);
    const [c1, setC1] = React.useState<string>(parsedC1);
    const [c2, setC2] = React.useState<string>(parsedC2);
    const [custom, setCustom] = React.useState<string>(hasBackground ? bgString : '');

    // Ignore ColorPicker's initial notify on mount/open to prevent feedback loops
    const skipInitialRef = React.useRef(true);
    React.useEffect(() => {
      const id = window.setTimeout(() => {
        skipInitialRef.current = false;
      }, 0);
      return () => {
        window.clearTimeout(id);
        skipInitialRef.current = true;
      };
    }, []);

    // Schedule updates to avoid flooding React with state changes while dragging
    const scheduleRef = React.useRef<number | null>(null);
    const scheduleSetSections = React.useCallback((updater: React.SetStateAction<SectionV2[]>) => {
      if (scheduleRef.current) window.clearTimeout(scheduleRef.current);
      scheduleRef.current = window.setTimeout(() => {
        setSections(updater);
        scheduleRef.current = null;
      }, 16);
    }, [setSections]);
    React.useEffect(() => {
      return () => {
        if (scheduleRef.current) {
          window.clearTimeout(scheduleRef.current);
          scheduleRef.current = null;
        }
      };
    }, [selectedSectionId]);

    // Remove Tailwind background utilities (e.g., bg-*, from-*, via-*, to-*, bg-gradient-to-*)
    const stripBgUtilities = React.useCallback((cls?: string): string | undefined => {
      if (!cls) return undefined;
      const cleaned = cls
        .split(/\s+/)
        .filter(Boolean)
        .filter((t) => !/^bg-/.test(t) && !/^from-/.test(t) && !/^via-/.test(t) && !/^to-/.test(t))
        .join(' ')
        .trim();
      return cleaned || undefined;
    }, []);

    const applySolid = React.useCallback((css: string) => {
      if (!selectedSectionId) return;
      scheduleSetSections((prev) => {
        let changed = false;
        const next = prev.map((s) => {
          if (s.id !== selectedSectionId) return s;
          const current = (s.background?.style || {}) as any;
          if (current.backgroundColor === css && !current.background && !current.backgroundImage) return s;
          const { background, backgroundImage, ...rest } = current;
          const prevClass = (s.background?.className || '') as string;
          const nextClass = stripBgUtilities(prevClass);
          changed = true;
          return {
            ...s,
            background: {
              ...(s.background || {}),
              className: nextClass,
              style: { ...rest, backgroundColor: css },
            },
          } as SectionV2;
        });
        return changed ? next : prev;
      });
    }, [selectedSectionId, scheduleSetSections, stripBgUtilities]);

    const applyGradient = React.useCallback((nextAngle: number, nextC1: string, nextC2: string) => {
      if (!selectedSectionId) return;
      const gradient = `linear-gradient(${Math.round(nextAngle)}deg, ${nextC1}, ${nextC2})`;
      scheduleSetSections((prev) => {
        let changed = false;
        const next = prev.map((s) => {
          if (s.id !== selectedSectionId) return s;
          const current = (s.background?.style || {}) as any;
          if (((current.background ?? current.backgroundImage) === gradient) && !current.backgroundColor) return s;
          const { backgroundColor, backgroundImage, ...rest } = current;
          const prevClass = (s.background?.className || '') as string;
          const nextClass = stripBgUtilities(prevClass);
          changed = true;
          return {
            ...s,
            background: {
              ...(s.background || {}),
              className: nextClass,
              style: { ...rest, background: gradient },
            },
          } as SectionV2;
        });
        return changed ? next : prev;
      });
    }, [selectedSectionId, scheduleSetSections, stripBgUtilities]);

    const applyCustom = React.useCallback((css: string) => {
      if (!selectedSectionId) return;
      scheduleSetSections((prev) => {
        let changed = false;
        const next = prev.map((s) => {
          if (s.id !== selectedSectionId) return s;
          const current = (s.background?.style || {}) as any;
          if (((current.background ?? current.backgroundImage) === css) && !current.backgroundColor) return s;
          const { backgroundColor, backgroundImage, ...rest } = current;
          const prevClass = (s.background?.className || '') as string;
          const nextClass = stripBgUtilities(prevClass);
          changed = true;
          return {
            ...s,
            background: {
              ...(s.background || {}),
              className: nextClass,
              style: { ...rest, background: css },
            },
          } as SectionV2;
        });
        return changed ? next : prev;
      });
    }, [selectedSectionId, scheduleSetSections, stripBgUtilities]);

    const handleSolidChange = React.useCallback((c: any) => {
      if (!open || skipInitialRef.current) return;
      const css = toCssColor(c);
      applySolid(css);
    }, [toCssColor, applySolid, open]);

    const handleC1Change = React.useCallback((c: any) => {
      if (!open || skipInitialRef.current) return;
      const css = toCssColor(c);
      setC1(css);
      applyGradient(angle, css, c2);
    }, [toCssColor, applyGradient, angle, c2, open]);

    const handleC2Change = React.useCallback((c: any) => {
      if (!open || skipInitialRef.current) return;
      const css = toCssColor(c);
      setC2(css);
      applyGradient(angle, c1, css);
    }, [toCssColor, applyGradient, angle, c1, open]);

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="min-w-24">Mode</Label>
          <Select value={mode} onValueChange={(v) => setMode(v)}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Mode" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="solid">Solid</SelectItem>
              <SelectItem value="gradient">Gradient</SelectItem>
              <SelectItem value="custom">Custom CSS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {mode === 'solid' && (
          <div className="space-y-2">
            <ColorPicker
              value={style.backgroundColor?.trim()?.length ? style.backgroundColor : '#ffffff'}
              onChange={handleSolidChange}
              className="flex flex-col gap-2"
            >
              <div className="grid grid-rows-[180px_1rem_1rem] gap-2">
                <ColorPickerSelection />
                <ColorPickerHue />
                <ColorPickerAlpha />
              </div>
              <div className="mt-1 flex items-center gap-2">
                <ColorPickerOutput />
              </div>
            </ColorPicker>
          </div>
        )}

        {mode === 'gradient' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Color 1</Label>
                <ColorPicker value={c1} onChange={handleC1Change} className="flex flex-col gap-2">
                  <div className="grid grid-rows-[120px_1rem] gap-2">
                    <ColorPickerSelection />
                    <ColorPickerHue />
                  </div>
                </ColorPicker>
              </div>
              <div className="space-y-1">
                <Label>Color 2</Label>
                <ColorPicker value={c2} onChange={handleC2Change} className="flex flex-col gap-2">
                  <div className="grid grid-rows-[120px_1rem] gap-2">
                    <ColorPickerSelection />
                    <ColorPickerHue />
                  </div>
                </ColorPicker>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sec-angle">Angle (deg)</Label>
              <NumericDragInput
                id="sec-angle"
                min={0}
                max={360}
                step={1}
                value={angle}
                onChange={(val) => {
                  const next = typeof val === 'number' ? val : angle;
                  setAngle(next);
                  applyGradient(next, c1, c2);
                }}
              />
            </div>
          </div>
        )}

        {mode === 'custom' && (
          <div className="space-y-2">
            <Label htmlFor="sec-custom-bg">CSS background</Label>
            <input
              id="sec-custom-bg"
              className="w-full border rounded p-2 text-xs"
              placeholder="e.g. radial-gradient(...), conic-gradient(...), url(...), etc"
              value={custom}
              onChange={(e) => {
                const css = e.target.value;
                setCustom(css);
                applyCustom(css);
              }}
            />
          </div>
        )}
      </div>
    );
  }, [sections, selectedSectionId, setSections]);

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
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="section-name-input">Section Name</label>
                <Input
                  id="section-name-input"
                  placeholder="e.g. Hero, Welcome, Events"
                  value={(() => {
                    const section = sections.find((s) => s.id === selectedSectionId);
                    const tokenName = section && (section.styleTokens as any)?.name;
                    return typeof tokenName === "string" ? tokenName : "";
                  })()}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSections((prev) =>
                      prev.map((section) => {
                        if (section.id !== selectedSectionId) return section;
                        const nextTokens = { ...(section.styleTokens || {}) } as Record<string, unknown>;
                        nextTokens.name = value;
                        return { ...section, styleTokens: nextTokens } as SectionV2;
                      })
                    );
                  }}
                />
                <p className="text-xs text-muted-foreground">Used for labeling in the sidebar only. Leave blank for automatic numbering.</p>
              </div>
              <Separator />
              <div className="space-y-4">
                <div>
                  <label className="text-sm mb-2 block">Background</label>
                  <Popover open={secBgOpen} onOpenChange={(open) => setSecBgOpen(open)}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start gap-2 h-10">
                        {(() => {
                          const section = sections.find((s) => s.id === selectedSectionId);
                          const style = (section?.background?.style || {}) as any;
                          const bg = style.background || style.backgroundImage || style.backgroundColor || 'transparent';
                          return (
                            <>
                              <div className="h-6 w-6 rounded border border-gray-300" style={{ background: bg }} />
                              <span className="text-sm truncate">{String(bg)}</span>
                            </>
                          );
                        })()}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[360px] p-3 space-y-3" align="start">
                      <SectionBackgroundEditor open={secBgOpen} />
                    </PopoverContent>
                  </Popover>
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
                        onFocus={() => {
                          if (!selectedSectionId) return;
                          const section = sections.find((s) => s.id === selectedSectionId);
                          if (section) {
                            const oldGridSize = section.builderGrid?.gridSize ?? 16;
                            oldGridSizeRef.current = oldGridSize;
                            capturePixelPositions(section, oldGridSize);
                            BuilderState.startAdjustingGrid(selectedSectionId);
                          }
                        }}
                        onMouseDown={() => {
                          if (!selectedSectionId) return;
                          const section = sections.find((s) => s.id === selectedSectionId);
                          if (section) {
                            const oldGridSize = section.builderGrid?.gridSize ?? 16;
                            oldGridSizeRef.current = oldGridSize;
                            capturePixelPositions(section, oldGridSize);
                            BuilderState.startAdjustingGrid(selectedSectionId);
                          }
                        }}
                        onChange={(val) => {
                          setSections((prev) =>
                            prev.map((s) =>
                              s.id === selectedSectionId
                                ? { ...s, builderGrid: { ...(s.builderGrid || {}), gridSize: val } }
                                : s
                            )
                          );
                        }}
                        onBlur={() => {
                          if (!selectedSectionId || oldGridSizeRef.current === null) return;
                          setSections((prev) => {
                            const section = prev.find((s) => s.id === selectedSectionId);
                            if (section) {
                              const newGridSize = section.builderGrid?.gridSize ?? 16;
                              oldGridSizeRef.current = null;
                              BuilderState.stopAdjustingGrid(selectedSectionId);
                              return convertPixelsToUnits(selectedSectionId, newGridSize, prev);
                            }
                            return prev;
                          });
                        }}
                        onMouseUp={() => {
                          if (!selectedSectionId || oldGridSizeRef.current === null) return;
                          setSections((prev) => {
                            const section = prev.find((s) => s.id === selectedSectionId);
                            if (section) {
                              const newGridSize = section.builderGrid?.gridSize ?? 16;
                              oldGridSizeRef.current = null;
                              BuilderState.stopAdjustingGrid(selectedSectionId);
                              return convertPixelsToUnits(selectedSectionId, newGridSize, prev);
                            }
                            return prev;
                          });
                        }}
                        onTouchStart={() => {
                          if (!selectedSectionId) return;
                          const section = sections.find((s) => s.id === selectedSectionId);
                          if (section) {
                            const oldGridSize = section.builderGrid?.gridSize ?? 16;
                            oldGridSizeRef.current = oldGridSize;
                            capturePixelPositions(section, oldGridSize);
                            BuilderState.startAdjustingGrid(selectedSectionId);
                          }
                        }}
                        onTouchEnd={() => {
                          if (!selectedSectionId || oldGridSizeRef.current === null) return;
                          setSections((prev) => {
                            const section = prev.find((s) => s.id === selectedSectionId);
                            if (section) {
                              const newGridSize = section.builderGrid?.gridSize ?? 16;
                              oldGridSizeRef.current = null;
                              BuilderState.stopAdjustingGrid(selectedSectionId);
                              return convertPixelsToUnits(selectedSectionId, newGridSize, prev);
                            }
                            return prev;
                          });
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
              <div className="flex justify-end space-x-2 pt-4">
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => onRequestDeleteSection?.(selectedSectionId!)}
                >
                  Delete Section
                </Button>
              </div>
            </>
          ) : selection?.nodeId ? (
            <>
              <div className="text-sm text-gray-500">Node ID: {selection.nodeId}</div>
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
