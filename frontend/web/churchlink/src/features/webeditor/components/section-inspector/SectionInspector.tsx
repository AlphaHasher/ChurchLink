import React from "react";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Separator } from "@/shared/components/ui/separator";
import { Button } from "@/shared/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { NumericDragInput } from "@/shared/components/NumericDragInput";
import { SectionV2, PageV2 } from "@/shared/types/pageV2";
import ElementTree from "../ElementTree";
import FontPicker from "../FontPicker";
import { SectionBackgroundEditor } from "./SectionBackgroundEditor";
import { BuilderState } from "@/features/webeditor/state/BuilderState";

interface SectionInspectorProps {
  section: SectionV2;
  sections: SectionV2[];
  setSections: React.Dispatch<React.SetStateAction<SectionV2[]>>;
  page: PageV2 | null;
  fontManager: any;
  setHighlightNodeId: (id: string | null) => void;
  onRequestDeleteSection?: (id: string) => void;
}

export const SectionInspector: React.FC<SectionInspectorProps> = ({
  section,
  sections: _sections,
  setSections,
  page,
  fontManager,
  setHighlightNodeId,
  onRequestDeleteSection,
}) => {
  const [secBgOpen, setSecBgOpen] = React.useState(false);

  const aspectNum = Math.max(1, Math.round(section.builderGrid?.aspect?.num ?? 16));
  const aspectDen = Math.max(1, Math.round(section.builderGrid?.aspect?.den ?? 9));
  const gridCols = section.builderGrid?.cols ?? 64;
  const estimatedRows = Math.round((gridCols * aspectDen) / aspectNum);

  const handleSectionFontSelect = React.useCallback((fontFamily: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === section.id
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
  }, [section.id, setSections]);

  return (
    <>
      <div className="space-y-3">
        <label className="text-sm font-medium">Section Font</label>
        <p className="text-xs text-muted-foreground">This font will apply to all elements in this section</p>
        <FontPicker
          page={{
            ...page,
            styleTokens: {
              defaultFontFamily: section.styleTokens?.fontFamily,
            },
          } as PageV2}
          setPage={(updater) => {
            if (typeof updater === 'function') {
              const updated = updater({ styleTokens: { defaultFontFamily: section.styleTokens?.fontFamily } } as any);
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
            const tokenName = section && (section.styleTokens as any)?.name;
            return typeof tokenName === "string" ? tokenName : "";
          })()}
          onChange={(e) => {
            const value = e.target.value;
            setSections((prev) =>
              prev.map((s) => {
                if (s.id !== section.id) return s;
                const nextTokens = { ...(s.styleTokens || {}) } as Record<string, unknown>;
                nextTokens.name = value;
                return { ...s, styleTokens: nextTokens } as SectionV2;
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
              <SectionBackgroundEditor
                section={section}
                open={secBgOpen}
                onUpdate={setSections}
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Section aspect ratio controls (replaces heightPercent) */}
        <div>
          <label className="text-sm mb-2 block">Section Aspect Ratio</label>
          <div className="space-y-2">
            <input
              type="range"
              min={1}
              max={32}
              step={1}
              value={aspectDen}
              onChange={(e) => {
                const den = Math.max(1, Math.min(32, Math.round(Number(e.target.value))));
                const num = Math.max(1, Math.min(32, Math.round(section.builderGrid?.aspect?.num ?? 16)));
                BuilderState.startAdjustingGrid(section.id);
                setSections((prev) =>
                  prev.map((s) =>
                    s.id === section.id
                      ? {
                          ...s,
                          builderGrid: {
                            cols: s.builderGrid?.cols ?? 64,
                            aspect: { num, den },
                            showGrid: s.builderGrid?.showGrid ?? true,
                          },
                        }
                      : s
                  )
                );
              }}
              onMouseUp={() => BuilderState.stopAdjustingGrid(section.id)}
              onTouchEnd={() => BuilderState.stopAdjustingGrid(section.id)}
              className="w-full"
            />
            <div className="grid grid-cols-3 items-center gap-2">
              <div className="flex items-center gap-2">
                <Label className="text-xs">W</Label>
                <NumericDragInput
                  min={1}
                  max={32}
                  step={1}
                  value={aspectNum}
                  transformValue={(val) => Math.round(val)}
                  onFocus={() => {
                    BuilderState.startAdjustingGrid(section.id);
                  }}
                  onMouseDown={() => {
                    BuilderState.startAdjustingGrid(section.id);
                  }}
                  onChange={(val) => {
                    const nextNum = Math.max(1, Math.min(32, Math.round(val)));
                    const den = Math.max(1, Math.min(32, Math.round(section.builderGrid?.aspect?.den ?? 9)));
                    setSections((prev) =>
                      prev.map((s) =>
                        s.id === section.id
                          ? {
                              ...s,
                              builderGrid: {
                                cols: s.builderGrid?.cols ?? 64,
                                aspect: { num: nextNum, den },
                                showGrid: s.builderGrid?.showGrid ?? true,
                              },
                            }
                          : s
                      )
                    );
                  }}
                  onBlur={() => {
                    BuilderState.stopAdjustingGrid(section.id);
                  }}
                  onMouseUp={() => {
                    BuilderState.stopAdjustingGrid(section.id);
                  }}
                  onTouchStart={() => {
                    BuilderState.startAdjustingGrid(section.id);
                  }}
                  onTouchEnd={() => {
                    BuilderState.stopAdjustingGrid(section.id);
                  }}
                  className="w-full"
                />
              </div>
              <div className="text-center text-xs text-muted-foreground">:</div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">H</Label>
                <NumericDragInput
                  min={1}
                  max={32}
                  step={1}
                  value={aspectDen}
                  transformValue={(val) => Math.round(val)}
                  onFocus={() => {
                    BuilderState.startAdjustingGrid(section.id);
                  }}
                  onMouseDown={() => {
                    BuilderState.startAdjustingGrid(section.id);
                  }}
                  onChange={(val) => {
                    const nextDen = Math.max(1, Math.min(32, Math.round(val)));
                    const num = Math.max(1, Math.min(32, Math.round(section.builderGrid?.aspect?.num ?? 16)));
                    setSections((prev) =>
                      prev.map((s) =>
                        s.id === section.id
                          ? {
                              ...s,
                              builderGrid: {
                                cols: s.builderGrid?.cols ?? 64,
                                aspect: { num, den: nextDen },
                                showGrid: s.builderGrid?.showGrid ?? true,
                              },
                            }
                          : s
                      )
                    );
                  }}
                  onBlur={() => {
                    BuilderState.stopAdjustingGrid(section.id);
                  }}
                  onMouseUp={() => {
                    BuilderState.stopAdjustingGrid(section.id);
                  }}
                  onTouchStart={() => {
                    BuilderState.startAdjustingGrid(section.id);
                  }}
                  onTouchEnd={() => {
                    BuilderState.stopAdjustingGrid(section.id);
                  }}
                  className="w-full"
                />
              </div>
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Aspect ratio: {aspectNum}:{aspectDen} (rows: {estimatedRows})
            </div>
          </div>
        </div>

        {/* Virtual Grid controls */}
        <div>
          <label className="text-sm mb-2 block">Virtual Grid Settings (Builder Only)</label>
          <div className="space-y-3">
            <div>
              <input
                type="checkbox"
                checked={section.builderGrid?.showGrid ?? true}
                onChange={(e) => setSections((prev) =>
                  prev.map((s) =>
                    s.id === section.id
                      ? { 
                          ...s, 
                          builderGrid: { 
                            cols: s.builderGrid?.cols ?? 64,
                            aspect: s.builderGrid?.aspect ?? { num: 16, den: 9 },
                            showGrid: e.target.checked
                          } 
                        }
                      : s
                  )
                )}
              />
              <span className="ml-2 text-sm">Show Grid Overlay</span>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Grid Columns</div>
              <NumericDragInput
                min={16}
                max={128}
                step={4}
                value={section.builderGrid?.cols ?? 64}
                onFocus={() => {
                  BuilderState.startAdjustingGrid(section.id);
                }}
                onMouseDown={() => {
                  BuilderState.startAdjustingGrid(section.id);
                }}
                onChange={(val) => {
                  setSections((prev) =>
                    prev.map((s) =>
                      s.id === section.id
                        ? { 
                            ...s, 
                            builderGrid: { 
                              cols: val,
                              aspect: s.builderGrid?.aspect ?? { num: 16, den: 9 },
                              showGrid: s.builderGrid?.showGrid ?? true
                            } 
                          }
                        : s
                    )
                  );
                }}
                onBlur={() => {
                  BuilderState.stopAdjustingGrid(section.id);
                }}
                onMouseUp={() => {
                  BuilderState.stopAdjustingGrid(section.id);
                }}
                onTouchStart={() => {
                  BuilderState.startAdjustingGrid(section.id);
                }}
                onTouchEnd={() => {
                  BuilderState.stopAdjustingGrid(section.id);
                }}
                className="w-full"
              />
              <div className="text-xs text-muted-foreground mt-1">Number of columns in virtual grid (16-128)</div>
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
                  section.children?.[0]?.type === 'container'
                    ? ((section.children?.[0] as any)?.props?.paddingX ?? 4)
                    : 4
                }
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setHighlightNodeId(
                    (section.children?.[0] as any)?.id || null
                  );
                  setSections((prev) =>
                    prev.map((s) => {
                      if (s.id !== section.id) return s;
                      const first = s.children?.[0] as any;
                      if (!first || first.type !== 'container') return s;
                      return {
                        ...s,
                        children: [
                          { ...first, props: { ...(first.props || {}), paddingX: val } },
                          ...(s.children?.slice(1) || []),
                        ],
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
                  section.children?.[0]?.type === 'container'
                    ? ((section.children?.[0] as any)?.props?.paddingY ?? 6)
                    : 6
                }
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setHighlightNodeId(
                    (section.children?.[0] as any)?.id || null
                  );
                  setSections((prev) =>
                    prev.map((s) => {
                      if (s.id !== section.id) return s;
                      const first = s.children?.[0] as any;
                      if (!first || first.type !== 'container') return s;
                      return {
                        ...s,
                        children: [
                          { ...first, props: { ...(first.props || {}), paddingY: val } },
                          ...(s.children?.slice(1) || []),
                        ],
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
            nodes={section.children ?? []}
            onHover={setHighlightNodeId}
            onLeave={() => setHighlightNodeId(null)}
          />
        </div>
      </div>
      <div className="flex justify-end space-x-2 pt-4">
        <Button 
          variant="destructive" 
          size="sm"
          onClick={() => onRequestDeleteSection?.(section.id)}
        >
          Delete Section
        </Button>
      </div>
    </>
  );
};

