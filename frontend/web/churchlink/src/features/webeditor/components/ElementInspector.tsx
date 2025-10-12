import React from "react";

import { Button } from "@/shared/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { ColorPicker, ColorPickerAlpha, ColorPickerHue, ColorPickerOutput, ColorPickerSelection } from "@/shared/components/ui/shadcn-io/color-picker";
import { Label } from "@/shared/components/ui/label";
import { NumericDragInput } from "@/shared/components/NumericDragInput";
import { Separator } from "@/shared/components/ui/separator";
import { Node, TextNode } from "@/shared/types/pageV2";
import { BuilderState } from "@/features/webeditor/state/BuilderState";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";

import { ButtonInspector } from "./element-inspector/ButtonInspector";
import { ContainerInspector } from "./element-inspector/ContainerInspector";
import { EventListInspector } from "./element-inspector/EventListInspector";
import { ImageInspector } from "./element-inspector/ImageInspector";
import { LayoutSizeControls } from "./element-inspector/LayoutSizeControls";
import { PositionControls } from "./element-inspector/PositionControls";
import { TextInspector } from "./element-inspector/TextInspector";

interface ElementInspectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedNode: Node | null;
  onUpdateNode: (updater: (node: Node) => Node) => void;
  fontManager?: any; // Font manager from useFontManager hook
  gridSize?: number; // px per grid unit for converting wu/hu ⇄ px/rem
  onRequestDeleteNode?: () => void;
}

export const ElementInspector: React.FC<ElementInspectorProps> = ({
  open,
  onOpenChange,
  selectedNode,
  onUpdateNode,
  fontManager,
  gridSize,
  onRequestDeleteNode,
}) => {
  const [bgOpen, setBgOpen] = React.useState(false);
  const bgPrevRef = React.useRef<Node | null>(null);
  const lastNodeIdRef = React.useRef<string | null>(null);
  const skipBgCommitRef = React.useRef(false);

  // Close background popover without committing if selection changes while open
  React.useEffect(() => {
    const currentId = selectedNode?.id ?? null;
    const lastId = lastNodeIdRef.current;
    if (bgOpen && lastId && currentId && lastId !== currentId) {
      skipBgCommitRef.current = true;
      setBgOpen(false);
    }
    lastNodeIdRef.current = currentId;
  }, [selectedNode?.id, bgOpen]);

  // If the entire inspector closes while the background popover is open,
  // force-close the popover and skip committing any pending change to avoid loops.
  React.useEffect(() => {
    if (!open && bgOpen) {
      skipBgCommitRef.current = true;
      setBgOpen(false);
    }
  }, [open, bgOpen]);

  // Local child responsible purely for background editing to keep Hook order stable in parent
  const BackgroundEditor: React.FC<{ node: Node; open: boolean; onUpdateNode: (updater: (node: Node) => Node) => void }> = React.useCallback(({ node, open, onUpdateNode }) => {
    const style = (node as any)?.style || {};
    const bgString = String((style.background ?? style.backgroundImage ?? '') as string).trim();
    const hasBackground = bgString.length > 0;
    const isLinear = /linear-gradient\(/i.test(bgString);

    const extractColorOnly = React.useCallback((input: string | undefined): string => {
      if (!input) return '#4f46e5';
      const s = String(input).trim();
      // Try to match functional colors or hex specifically
      const m = s.match(/(#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|hsl|oklch|lab|lch)\([^\)]+\))/);
      if (m && m[1]) return m[1].trim();
      // Fallback: take first token before any space or percentage
      return s.split(/\s+/)[0];
    }, []);

    const toCssColor = React.useCallback((value: any): string => {
      if (typeof value === 'string') return value;
      // Prefer string() so alpha is preserved (rgba/hsla)
      if (value && typeof value.string === 'function') {
        try { return value.string(); } catch {}
      }
      // Fallbacks
      if (value && typeof value.hexa === 'function') {
        try { return value.hexa(); } catch {}
      }
      if (value && typeof value.hex === 'function') {
        try { return value.hex(); } catch {}
      }
      return String(value ?? '');
    }, []);

    const stripBgUtilityClasses = React.useCallback((cls?: string): string | undefined => {
      if (!cls || typeof cls !== 'string') return cls;
      const next = cls.replace(/\bbg-[^\s]+/g, '').replace(/\s+/g, ' ').trim();
      return next || undefined;
    }, []);

    const parseLinearGradient = React.useCallback((): { angle: number; c1: string; c2: string } => {
      if (!isLinear) return { angle: 90, c1: '#4f46e5', c2: '#3b82f6' };
      const raw = bgString;
      const start = raw.toLowerCase().indexOf('linear-gradient(');
      const end = raw.lastIndexOf(')');
      if (start === -1 || end === -1) return { angle: 90, c1: '#4f46e5', c2: '#3b82f6' };
      const inner = raw.slice(start + 'linear-gradient('.length, end);
      const parts: string[] = [];
      let depth = 0;
      let buf = '';
      for (let i = 0; i < inner.length; i++) {
        const ch = inner[i];
        if (ch === '(') depth++;
        if (ch === ')') depth = Math.max(0, depth - 1);
        if (ch === ',' && depth === 0) {
          parts.push(buf.trim());
          buf = '';
          continue;
        }
        buf += ch;
      }
      if (buf.trim()) parts.push(buf.trim());

      // Determine if the first token is an angle/direction
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

    const [mode, setMode] = React.useState<string>(hasBackground ? (isLinear ? 'gradient' : 'custom') : 'solid');
    const [angle, setAngle] = React.useState<number>(parsedAngle);
    const [c1, setC1] = React.useState<string>(parsedC1);
    const [c2, setC2] = React.useState<string>(parsedC2);
    const [custom, setCustom] = React.useState<string>(hasBackground ? bgString : '');

    const scheduleRef = React.useRef<number | null>(null);
    const scheduleUpdate = React.useCallback((updater: (node: Node) => Node) => {
      if (scheduleRef.current) window.clearTimeout(scheduleRef.current);
      scheduleRef.current = window.setTimeout(() => {
        onUpdateNode(updater);
        scheduleRef.current = null;
      }, 16);
    }, [onUpdateNode]);

    // Clear any pending scheduled update if the target node changes or unmounts
    React.useEffect(() => {
      return () => {
        if (scheduleRef.current) {
          window.clearTimeout(scheduleRef.current);
          scheduleRef.current = null;
        }
      };
    }, [node.id]);

    // Place change handlers after apply* definitions

    const applyGradient = React.useCallback((nextAngle: number, nextC1: string, nextC2: string) => {
      const gradient = `linear-gradient(${Math.round(nextAngle)}deg, ${nextC1}, ${nextC2})`;
      scheduleUpdate((n) => ({
        ...n,
        style: { ...(n as any).style, background: gradient, backgroundColor: undefined },
      }));
    }, [scheduleUpdate, node.id]);

    const applySolid = React.useCallback((css: string) => {
      onUpdateNode((n) => {
        const next = {
          ...n,
          style: {
            ...(n as any).style,
            className: stripBgUtilityClasses((n as any).style?.className),
            backgroundColor: css,
            background: undefined,
          },
        } as Node;
        return next;
      });
    }, [onUpdateNode, node.id, stripBgUtilityClasses]);

    const applyCustom = React.useCallback((css: string) => {
      onUpdateNode((n) => ({
        ...n,
        style: { ...(n as any).style, background: css, backgroundColor: undefined },
      }));
    }, [onUpdateNode, node.id]);

    // Stable change handlers to avoid triggering ColorPicker's "notify parent" effect on every render
    const handleSolidChange = React.useCallback((c: any) => {
      if (!open) return;
      const css = toCssColor(c);
      applySolid(css);
    }, [toCssColor, applySolid, open]);

    const handleC1Change = React.useCallback((c: any) => {
      if (!open) return;
      const css = toCssColor(c);
      setC1(css);
      applyGradient(angle, css, c2);
    }, [toCssColor, applyGradient, angle, c2, open]);

    const handleC2Change = React.useCallback((c: any) => {
      if (!open) return;
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
            {(() => {
              const raw = (node as any)?.style?.backgroundColor as string | undefined;
              const solidValue = raw && raw.trim().length ? raw : '#ffffff';
              return (
                <ColorPicker
                  value={solidValue}
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
              );
            })()}
          </div>
        )}

        {mode === 'gradient' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Color 1</Label>
                <ColorPicker
                  value={c1}
                  onChange={handleC1Change}
                  className="flex flex-col gap-2"
                >
                  <div className="grid grid-rows-[120px_1rem] gap-2">
                    <ColorPickerSelection />
                    <ColorPickerHue />
                  </div>
                </ColorPicker>
              </div>
              <div className="space-y-1">
                <Label>Color 2</Label>
                <ColorPicker
                  value={c2}
                  onChange={handleC2Change}
                  className="flex flex-col gap-2"
                >
                  <div className="grid grid-rows-[120px_1rem] gap-2">
                    <ColorPickerSelection />
                    <ColorPickerHue />
                  </div>
                </ColorPicker>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="angle">Angle (deg)</Label>
              <NumericDragInput
                id="angle"
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
            <Label htmlFor="custom-bg">CSS background</Label>
            <input
              id="custom-bg"
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

        <div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => {
              const sectionId = BuilderState.selection?.sectionId;
              if (!sectionId) return;
              const el = document.getElementById(`section-content-${sectionId}`)?.parentElement;
              let gradient: string | undefined;
              if (el) {
                const cs = window.getComputedStyle(el);
                const bgImage = cs.backgroundImage;
                const bg = cs.background;
                gradient = bgImage && bgImage !== 'none' ? bgImage : undefined;
                if (!gradient && bg && /gradient\(/i.test(bg)) gradient = bg;
              }
              if (!gradient) return;
              setMode('custom');
              setCustom(gradient);
              applyCustom(gradient);
            }}
          >
            Use Section Background
          </Button>
        </div>
      </div>
    );
  }, []);
  const renderContent = () => {
    if (!selectedNode) {
      return (
        <div className="px-6 py-4">
          <SheetHeader>
            <SheetTitle>Element Inspector</SheetTitle>
            <SheetDescription>
              Select an element to edit its properties
            </SheetDescription>
          </SheetHeader>
        </div>
      );
    }

    const getElementTypeName = (type: string) => {
      switch (type) {
        case "text":
          return "Text Element";
        case "button":
          return "Button Element";
        case "image":
          return "Image Element";
        case "container":
          return "Container Element";
        case "eventList":
          return "Event List Element";
        case "map":
          return "Map Element";
        case "paypal":
          return "PayPal Element";
        default:
          return "Unknown Element";
      }
    };

    return (
      <>
        <div className="px-6 py-4 border-b">
          <SheetHeader>
            <SheetTitle>{getElementTypeName(selectedNode.type)}</SheetTitle>
            <SheetDescription>
              Edit properties for this {selectedNode.type} element
            </SheetDescription>
          </SheetHeader>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto h-[calc(100vh-120px)]">
          <div className="rounded-lg border p-3 bg-muted/30">
            <div className="text-xs font-mono text-muted-foreground">ID: {selectedNode.id}</div>
            <div className="text-xs font-mono text-muted-foreground">Type: {selectedNode.type}</div>
          </div>

          <Separator />

          {/* Unified Background editor: Solid, Gradient, Custom CSS */}
          <div className="space-y-2">
            <Label>Background</Label>
            <Popover
              open={bgOpen}
              onOpenChange={(open) => {
                if (open) {
                  bgPrevRef.current = selectedNode ? { ...selectedNode } : null;
                } else {
                  const sectionId = BuilderState.selection?.sectionId;
                  const nodeId = BuilderState.selection?.nodeId;
                  if (!skipBgCommitRef.current) {
                    if (sectionId && nodeId && bgPrevRef.current && selectedNode) {
                      BuilderState.pushNode(sectionId, nodeId, bgPrevRef.current, { ...selectedNode });
                    }
                  }
                  skipBgCommitRef.current = false;
                  bgPrevRef.current = null;
                }
                setBgOpen(open);
              }}
            >
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start gap-2 h-10">
                  <div
                    className="h-6 w-6 rounded border border-gray-300"
                    style={{ background: (selectedNode as any)?.style?.background || (selectedNode as any)?.style?.backgroundColor || 'transparent' }}
                  />
                  <span className="text-sm truncate">{(selectedNode as any)?.style?.background || (selectedNode as any)?.style?.backgroundColor || 'transparent'}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[360px] p-3 space-y-3" align="start">
                {selectedNode && (
                  <BackgroundEditor node={selectedNode} open={bgOpen} onUpdateNode={onUpdateNode} />
                )}
              </PopoverContent>
            </Popover>
          </div>

          {/* Global corner radius control for all element types */}
          <div className="space-y-2">
            <Label htmlFor="corner-radius">Corner Radius (px)</Label>
            <NumericDragInput
              id="corner-radius"
              min={0}
              max={64}
              step={1}
              value={Number((selectedNode as any)?.style?.borderRadius ?? 0)}
              onChange={(val) =>
                onUpdateNode((n) => ({
                  ...n,
                  style: { ...(n as any).style, borderRadius: val },
                }))
              }
            />
          </div>

          <PositionControls node={selectedNode} onUpdateNode={onUpdateNode} gridSize={gridSize} />
          <LayoutSizeControls node={selectedNode} onUpdateNode={onUpdateNode} gridSize={gridSize} />

          {/* Custom CSS for any element */}
          <div className="space-y-2">
            <Label htmlFor="custom-css">Custom CSS</Label>
            <textarea
              id="custom-css"
              className="w-full min-h-24 border rounded p-2 font-mono text-xs"
              placeholder={"Use &: to target this element. Example: \n&:hover { opacity: 0.9; }"}
              defaultValue={String(((selectedNode as any)?.style?.customCss ?? '') as string)}
              onChange={(e) =>
                onUpdateNode((n) => ({
                  ...n,
                  style: { ...(n as any).style, customCss: e.target.value || undefined },
                }))
              }
            />
            <p className="text-[10px] text-muted-foreground">Tip: The ampersand (&) will be replaced with a selector scoped to this element only.</p>
            {Boolean(((selectedNode as any)?.style?.className || '').includes('hover:')) && (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const cls = String(((selectedNode as any)?.style?.className || '') as string);
                    const tokens = cls.split(/\s+/).filter(Boolean);
                    const rest: string[] = [];
                    const rules: string[] = [];

                    const pushRule = (rule: string) => { if (rule) rules.push(rule); };

                    tokens.forEach((t) => {
                      if (!t.startsWith('hover:')) { rest.push(t); return; }
                      // hover:opacity-XX
                      const mOpacity = t.match(/^hover:opacity-(\d{1,3})$/);
                      if (mOpacity) {
                        const n = Math.max(0, Math.min(100, parseInt(mOpacity[1], 10)));
                        pushRule(`&:hover { opacity: ${n / 100}; }`);
                        return;
                      }
                      // hover:bg-white/NN or hover:bg-black/NN
                      const mBg = t.match(/^hover:bg-(white|black)(?:\/(\d{1,3}))?$/);
                      if (mBg) {
                        const color = mBg[1] === 'white' ? '255,255,255' : '0,0,0';
                        const alpha = mBg[2] ? Math.max(0, Math.min(100, parseInt(mBg[2], 10))) / 100 : 1;
                        pushRule(`&:hover { background: rgba(${color}, ${alpha}); }`);
                        return;
                      }
                      // Unrecognized hover utility: keep it
                      rest.push(t);
                    });

                    const merged = rules.join('\n');
                    onUpdateNode((n) => {
                      const prevCss = String(((n as any)?.style?.customCss || '') as string);
                      const nextCss = [prevCss.trim(), merged.trim()].filter(Boolean).join('\n');
                      return {
                        ...n,
                        style: {
                          ...(n as any).style,
                          customCss: nextCss || undefined,
                          className: rest.join(' ') || undefined,
                        },
                      } as Node;
                    });
                  }}
                >
                  Import hover utilities into Custom CSS
                </Button>
              </div>
            )}
          </div>

          {selectedNode.type === "text" && (
            <TextInspector
              node={selectedNode as TextNode}
              onUpdate={onUpdateNode}
              fontManager={fontManager}
              gridSize={gridSize}
            />
          )}

          {selectedNode.type === "button" && <ButtonInspector node={selectedNode} onUpdate={onUpdateNode} />}

          {selectedNode.type === "image" && <ImageInspector node={selectedNode} onUpdate={onUpdateNode} />}

          {selectedNode.type === "container" && <ContainerInspector node={selectedNode} onUpdate={onUpdateNode} />}

          {selectedNode.type === "eventList" && <EventListInspector node={selectedNode} onUpdate={onUpdateNode} />}

          {/* Map settings */}
          {selectedNode.type === "map" && (
            <>
              <Separator />
              <div className="space-y-2">
                <Label htmlFor="map-location">Location or Address</Label>
                <input
                  id="map-location"
                  type="text"
                  className="w-full border rounded p-2"
                  placeholder="e.g. 1600 Amphitheatre Pkwy, Mountain View, CA or 'Statue of Liberty'"
                  onBlur={(e) => {
                    const value = e.target.value.trim();
                    if (!value) return;
                    const toEmbed = (place: string) => `https://www.google.com/maps?q=${encodeURIComponent(place)}&output=embed`;
                    onUpdateNode((n) => ({
                      ...n,
                      props: {
                        ...(n as any).props,
                        // Let MapSection convert place → embed URL, also preserve direct embed if provided
                        embedUrl: /^https?:\/\//i.test(value) ? value : toEmbed(value),
                        place: value,
                      },
                    }));
                  }}
                  defaultValue={(selectedNode as any)?.props?.place || ""}
                />
                <p className="text-xs text-muted-foreground">Paste a full Google Maps embed URL or enter a place/address to auto-generate. Tip: The "Get Directions" button links to Google Maps with this destination.</p>
              </div>
            </>
          )}

          <Separator />

          <div className="pt-4 pb-6 space-y-2">
            <div className="flex justify-between space-x-2">
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => onRequestDeleteNode?.()}
              >
                Delete Element
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Close Inspector
              </Button>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" className="w-[400px] sm:w-[500px] p-0" onInteractOutside={(e) => e.preventDefault()}>
        {renderContent()}
      </SheetContent>
    </Sheet>
  );
};

export default ElementInspector;
