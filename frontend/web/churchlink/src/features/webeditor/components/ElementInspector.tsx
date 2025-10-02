import React from "react";
import { Node, TextNode } from "@/shared/types/pageV2";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/shared/components/ui/sheet";
import { Separator } from "@/shared/components/ui/separator";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { NumericDragInput } from "@/shared/components/NumericDragInput";
import { Switch } from "@/shared/components/ui/switch";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/shared/components/ui/toggle-group";
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline } from "lucide-react";
import FontPicker from "./FontPicker";
import { getFontByFamily, getFontById } from "@/shared/constants/googleFonts";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { ColorPicker, ColorPickerAlpha, ColorPickerHue, ColorPickerSelection, ColorPickerOutput } from "@/shared/components/ui/shadcn-io/color-picker";
import { BuilderState } from "@/features/webeditor/state/BuilderState";

interface ElementInspectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedNode: Node | null;
  onUpdateNode: (updater: (node: Node) => Node) => void;
  fontManager?: any; // Font manager from useFontManager hook
  gridSize?: number; // px per grid unit for converting wu/hu ⇄ px/rem
}

// Layout size controls with numeric inputs + units, real-time updates and drag-to-adjust
const LayoutSizeControls: React.FC<{
  node: Node;
  onUpdateNode: (updater: (node: Node) => Node) => void;
  gridSize?: number;
}> = ({ node, onUpdateNode, gridSize }) => {
  const grid = gridSize ?? 16;
  const wu = node.layout?.units?.wu ?? 12;
  const hu = node.layout?.units?.hu ?? 8;

  const [widthUnit, setWidthUnit] = React.useState<'units' | 'px' | 'rem'>('px');
  const [heightUnit, setHeightUnit] = React.useState<'units' | 'px' | 'rem'>('px');
  const [widthVal, setWidthVal] = React.useState<number>(wu * grid);
  const [heightVal, setHeightVal] = React.useState<number>(hu * grid);

  React.useEffect(() => {
    const pxW = wu * grid;
    const pxH = hu * grid;
    setWidthVal(widthUnit === 'units' ? wu : widthUnit === 'px' ? Math.round(pxW) : Number((pxW / 16).toFixed(2)));
    setHeightVal(heightUnit === 'units' ? hu : heightUnit === 'px' ? Math.round(pxH) : Number((pxH / 16).toFixed(2)));
  }, [wu, hu, grid, widthUnit, heightUnit]);

  const commitWidth = (val: number) => {
    const px = widthUnit === 'units' ? val * grid : widthUnit === 'px' ? val : val * 16;
    const nextWu = Math.max(1, Math.round(px / grid));
    onUpdateNode((n) => ({
      ...n,
      layout: {
        ...n.layout,
        units: {
          xu: n.layout?.units?.xu ?? 0,
          yu: n.layout?.units?.yu ?? 0,
          wu: nextWu,
          hu: n.layout?.units?.hu ?? 8,
        },
      },
    } as Node));
  };

  const commitHeight = (val: number) => {
    const px = heightUnit === 'units' ? val * grid : heightUnit === 'px' ? val : val * 16;
    const nextHu = Math.max(1, Math.round(px / grid));
    onUpdateNode((n) => ({
      ...n,
      layout: {
        ...n.layout,
        units: {
          xu: n.layout?.units?.xu ?? 0,
          yu: n.layout?.units?.yu ?? 0,
          wu: n.layout?.units?.wu ?? 12,
          hu: nextHu,
        },
      },
    } as Node));
  };

  const getStep = (unit: 'units' | 'px' | 'rem') => (unit === 'rem' ? 0.25 : 1);

  // Drag-to-adjust now handled by shared NumericDragInput

  // drag handled by NumericDragInput now

  return (
    <div className="rounded-lg border p-3 bg-muted/40">
      <div className="text-sm font-semibold mb-2">Layout Size</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Width</Label>
          <div className="flex items-center gap-2">
            <NumericDragInput
              min={1}
              step={getStep(widthUnit)}
              value={Number.isFinite(widthVal) ? widthVal : 0}
              onChange={(val) => {
                setWidthVal(val);
                commitWidth(val);
              }}
            />
            <Select value={widthUnit} onValueChange={(v) => setWidthUnit(v as any)}>
              <SelectTrigger className="w-[84px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="units">units</SelectItem>
                <SelectItem value="px">px</SelectItem>
                <SelectItem value="rem">rem</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Height</Label>
          <div className="flex items-center gap-2">
            <NumericDragInput
              min={1}
              step={getStep(heightUnit)}
              value={Number.isFinite(heightVal) ? heightVal : 0}
              onChange={(val) => {
                setHeightVal(val);
                commitHeight(val);
              }}
            />
            <Select value={heightUnit} onValueChange={(v) => setHeightUnit(v as any)}>
              <SelectTrigger className="w-[84px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="units">units</SelectItem>
                <SelectItem value="px">px</SelectItem>
                <SelectItem value="rem">rem</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-1">Grid size: {grid}px per unit</div>
    </div>
  );
};

const PositionControls: React.FC<{
  node: Node;
  onUpdateNode: (updater: (node: Node) => Node) => void;
  gridSize?: number;
}> = ({ node, onUpdateNode, gridSize }) => {
  const grid = gridSize ?? 16;
  const xu = node.layout?.units?.xu ?? 0;
  const yu = node.layout?.units?.yu ?? 0;

  const [xUnit, setXUnit] = React.useState<'units' | 'px' | 'rem'>('px');
  const [yUnit, setYUnit] = React.useState<'units' | 'px' | 'rem'>('px');
  const [xVal, setXVal] = React.useState<number>(xu * grid);
  const [yVal, setYVal] = React.useState<number>(yu * grid);

  React.useEffect(() => {
    const pxX = xu * grid;
    const pxY = yu * grid;
    setXVal(xUnit === 'units' ? xu : xUnit === 'px' ? Math.round(pxX) : Number((pxX / 16).toFixed(2)));
    setYVal(yUnit === 'units' ? yu : yUnit === 'px' ? Math.round(pxY) : Number((pxY / 16).toFixed(2)));
  }, [xu, yu, grid, xUnit, yUnit]);

  const commitX = (val: number) => {
    const px = xUnit === 'units' ? val * grid : xUnit === 'px' ? val : val * 16;
    const nextXu = Math.max(0, Math.round(px / grid));
    onUpdateNode((n) => ({
      ...n,
      layout: {
        ...n.layout,
        units: {
          xu: nextXu,
          yu: n.layout?.units?.yu ?? 0,
          wu: n.layout?.units?.wu ?? 12,
          hu: n.layout?.units?.hu ?? 8,
        },
      },
    } as Node));
  };
  const commitY = (val: number) => {
    const px = yUnit === 'units' ? val * grid : yUnit === 'px' ? val : val * 16;
    const nextYu = Math.max(0, Math.round(px / grid));
    onUpdateNode((n) => ({
      ...n,
      layout: {
        ...n.layout,
        units: {
          xu: n.layout?.units?.xu ?? 0,
          yu: nextYu,
          wu: n.layout?.units?.wu ?? 12,
          hu: n.layout?.units?.hu ?? 8,
        },
      },
    } as Node));
  };

  // numeric drag now handled by shared NumericDragInput
  // numeric drag now handled by shared NumericDragInput

  // drag handled by NumericDragInput now

  return (
    <div className="rounded-lg border p-3 bg-muted/40">
      <div className="text-sm font-semibold mb-2">Position</div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>X</Label>
          <div className="flex items-center gap-2">
            <NumericDragInput
              min={0}
              step={xUnit === 'rem' ? 0.25 : 1}
              value={Number.isFinite(xVal) ? xVal : 0}
              onChange={(val) => {
                setXVal(val);
                commitX(val);
              }}
            />
            <Select value={xUnit} onValueChange={(v) => setXUnit(v as any)}>
              <SelectTrigger className="w-[84px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="units">units</SelectItem>
                <SelectItem value="px">px</SelectItem>
                <SelectItem value="rem">rem</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Y</Label>
          <div className="flex items-center gap-2">
            <NumericDragInput
              min={0}
              step={yUnit === 'rem' ? 0.25 : 1}
              value={Number.isFinite(yVal) ? yVal : 0}
              onChange={(val) => {
                setYVal(val);
                commitY(val);
              }}
            />
            <Select value={yUnit} onValueChange={(v) => setYUnit(v as any)}>
              <SelectTrigger className="w-[84px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="units">units</SelectItem>
                <SelectItem value="px">px</SelectItem>
                <SelectItem value="rem">rem</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      <div className="text-xs text-muted-foreground mt-1">Grid size: {grid}px per unit</div>
    </div>
  );
};

const TextInspector: React.FC<{ node: TextNode; onUpdate: (updater: (node: Node) => Node) => void; fontManager?: any; gridSize?: number }> = ({ node, onUpdate, fontManager, gridSize }) => {
  const [customFontActive, setCustomFontActive] = React.useState<boolean>(false);

  React.useEffect(() => {
    const fam = (node.style as any)?.fontFamily as string | undefined;
    const match = getFontByFamily(fontManager?.fontOptions ?? [], fam || undefined);
    setCustomFontActive(match ? false : Boolean(fam));
  }, [node.style, fontManager?.fontOptions]);
  const [localHtml, setLocalHtml] = React.useState(node.props?.html || node.props?.text || "");

  React.useEffect(() => {
    setLocalHtml(node.props?.html || node.props?.text || "");
  }, [node.props?.html, node.props?.text]);

  const handleHtmlChange = (value: string) => {
    setLocalHtml(value);
  };

  const handleHtmlBlur = () => {
    onUpdate((n) =>
      n.type === "text"
        ? ({ ...n, props: { ...(n.props || {}), html: localHtml } } as Node)
        : n
    );
  };

  const handleAlignChange = (align: string) => {
    onUpdate((n) =>
      n.type === "text"
        ? ({ ...n, props: { ...(n.props || {}), align } } as Node)
        : n
    );
  };

  // Get current text styles
  const textStyles = (node.style as any)?.textStyles || [];

  const handleStyleToggle = (values: string[]) => {
    onUpdate((n) =>
      n.type === "text"
        ? ({
            ...n,
            style: {
              ...(n.style || {}),
              textStyles: values,
            },
          } as Node)
        : n
    );
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="text-content">Text Content</Label>
        <Textarea
          id="text-content"
          value={localHtml}
          onChange={(e) => handleHtmlChange(e.target.value)}
          onBlur={handleHtmlBlur}
          placeholder="Enter your text here..."
          className="min-h-[120px] font-mono text-sm"
        />
        <p className="text-xs text-muted-foreground">
          Supports HTML tags like &lt;strong&gt;, &lt;em&gt;, &lt;a&gt;, etc.
        </p>
      </div>

      <Separator />

      {fontManager && (
        <>
          <div className="space-y-2">
            <Label>Font Family</Label>
            <FontPicker
              page={{
                styleTokens: {
                  defaultFontFamily: (node.style as any)?.fontFamily,
                },
              } as any}
              setPage={(updater) => {
                if (typeof updater === 'function') {
                  const updated = updater({ styleTokens: { defaultFontFamily: (node.style as any)?.fontFamily } } as any);
                  const fontFamily = updated?.styleTokens?.defaultFontFamily || '';
                  onUpdate((n) =>
                    n.type === "text"
                      ? ({
                          ...n,
                          style: {
                            ...(n.style || {}),
                            fontFamily: fontFamily || undefined,
                          },
                        } as Node)
                      : n
                  );
                  setCustomFontActive(fontFamily ? !getFontByFamily(fontManager?.fontOptions ?? [], fontFamily) : false);
                }
              }}
              {...fontManager}
              selectedFontId={(customFontActive ? 'custom' : (getFontByFamily(fontManager?.fontOptions ?? [], (node.style as any)?.fontFamily || undefined)?.id ?? 'system'))}
              fontButtonLabel={(customFontActive && (node.style as any)?.fontFamily) || (getFontByFamily(fontManager?.fontOptions ?? [], (node.style as any)?.fontFamily || undefined)?.label || 'System Default')}
              fontButtonDescription={(customFontActive && 'Custom CSS family') || (getFontByFamily(fontManager?.fontOptions ?? [], (node.style as any)?.fontFamily || undefined)?.fontFamily || 'Browser default stack')}
              customFontActive={customFontActive}
              handleSelectFont={(fontId: string) => {
                // System default clears element font
                if (!fontId || fontId === 'system') {
                  setCustomFontActive(false);
                  onUpdate((n) => n.type === 'text' ? ({ ...n, style: { ...(n.style || {}), fontFamily: undefined } } as Node) : n);
                  return;
                }
                if (fontId === 'custom') {
                  setCustomFontActive(true);
                  return;
                }
                const meta = getFontById(fontManager?.fontOptions ?? [], fontId);
                if (meta) {
                  // Ensure font CSS is loaded by injecting a <link> once
                  const linkId = `google-font-link-${meta.id}`;
                  if (!document.getElementById(linkId)) {
                    const link = document.createElement('link');
                    link.id = linkId;
                    link.rel = 'stylesheet';
                    link.href = meta.cssUrl;
                    document.head.appendChild(link);
                  }
                  setCustomFontActive(false);
                  onUpdate((n) => n.type === 'text' ? ({ ...n, style: { ...(n.style || {}), fontFamily: meta.fontFamily } } as Node) : n);
                }
              }}
            />
          </div>
          <Separator />
        </>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Text Color</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-10"
              >
                <div
                  className="h-6 w-6 rounded border border-gray-300"
                  style={{ backgroundColor: (node.style as any)?.color || "#000000" }}
                />
                <span className="text-sm truncate">{(node.style as any)?.color || "#000000"}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <ColorPicker
                value={(node.style as any)?.color || "#000000"}
                onChange={(c) => {
                  const css = typeof c === 'string' ? c : (typeof (c as any)?.string === 'function' ? (c as any).string() : String(c));
                  const currentColor = (node.style as any)?.color;
                  // Only update if color actually changed
                  if (currentColor === css) return;
                  onUpdate((n) =>
                    n.type === "text"
                      ? ({
                          ...n,
                          style: {
                            ...(n.style || {}),
                            color: css,
                          },
                        } as Node)
                      : n
                  );
                }}
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
            </PopoverContent>
          </Popover>
        </div>

        <div className="space-y-2">
          <Label>Background Color</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-start gap-2 h-10"
              >
                <div
                  className="h-6 w-6 rounded border border-gray-300"
                  style={{ backgroundColor: (node.style as any)?.backgroundColor || "transparent" }}
                />
                <span className="text-sm truncate">{(node.style as any)?.backgroundColor || "transparent"}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <ColorPicker
                value={(node.style as any)?.backgroundColor || "#ffffff"}
                onChange={(c) => {
                  const css = typeof c === 'string' ? c : (typeof (c as any)?.string === 'function' ? (c as any).string() : String(c));
                  const currentBg = (node.style as any)?.backgroundColor;
                  // Only update if color actually changed
                  if (currentBg === css) return;
                  onUpdate((n) =>
                    n.type === "text"
                      ? ({
                          ...n,
                          style: {
                            ...(n.style || {}),
                            backgroundColor: css,
                          },
                        } as Node)
                      : n
                  );
                }}
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
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="font-size">Font Size (rem)</Label>
          <NumericDragInput
            id="font-size"
            min={0.5}
            max={10}
            step={0.125}
            value={(node.style as any)?.fontSize ?? 1}
            onChange={(val) =>
              onUpdate((n) =>
                n.type === "text"
                  ? ({
                      ...n,
                      style: {
                        ...(n.style || {}),
                        fontSize: val,
                      },
                    } as Node)
                  : n
              )
            }
            placeholder="1"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="font-weight">Font Weight</Label>
          <NumericDragInput
            id="font-weight"
            min={100}
            max={900}
            step={100}
            value={(node.style as any)?.fontWeight ?? 400}
            onChange={(val) =>
              onUpdate((n) =>
                n.type === "text"
                  ? ({
                      ...n,
                      style: {
                        ...(n.style || {}),
                        fontWeight: val,
                      },
                    } as Node)
                  : n
              )
            }
            placeholder="400"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Text Styles</Label>
        <ToggleGroup 
          type="multiple" 
          value={textStyles}
          onValueChange={handleStyleToggle}
          className="justify-start"
        >
          <ToggleGroupItem value="bold" aria-label="Bold">
            <Bold className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="italic" aria-label="Italic">
            <Italic className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="underline" aria-label="Underline">
            <Underline className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {textStyles.includes('underline') && (
        <div className="space-y-2">
          <Label htmlFor="underline-thickness">Underline Thickness (px)</Label>
          <NumericDragInput
            id="underline-thickness"
            min={1}
            max={10}
            step={0.5}
            value={(node.style as any)?.underlineThickness ?? 1}
            onChange={(val) =>
              onUpdate((n) =>
                n.type === "text"
                  ? ({
                      ...n,
                      style: {
                        ...(n.style || {}),
                        underlineThickness: val,
                      },
                    } as Node)
                  : n
              )
            }
            placeholder="1"
          />
          <p className="text-xs text-muted-foreground">
            Default is 1px. Increase for thicker underlines.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="text-align">Text Alignment</Label>
        <ToggleGroup 
          type="single" 
          value={node.props?.align || "left"} 
          onValueChange={(value) => value && handleAlignChange(value)}
          className="justify-start"
        >
          <ToggleGroupItem value="left" aria-label="Align left">
            <AlignLeft className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="center" aria-label="Align center">
            <AlignCenter className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="right" aria-label="Align right">
            <AlignRight className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Separator />

      <div className="space-y-2">
        <Label htmlFor="element-width">Width (auto or %)</Label>
        <div className="flex gap-2">
          <Input
            id="element-width"
            type="text"
            value={(node.style as any)?.width || "auto"}
            onChange={(e) =>
              onUpdate((n) =>
                n.type === "text"
                  ? ({
                      ...n,
                      style: {
                        ...(n.style || {}),
                        width: e.target.value,
                      },
                    } as Node)
                  : n
              )
            }
            placeholder="auto"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onUpdate((n) =>
                n.type === "text"
                  ? ({
                      ...n,
                      style: {
                        ...(n.style || {}),
                        width: "auto",
                      },
                    } as Node)
                  : n
              )
            }
          >
            Auto
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Use "auto" for content width, or specify like "50%", "300px"
        </p>
      </div>

      <Separator />

      <PaddingControls node={node} onUpdate={onUpdate} gridSize={gridSize} />

      <Separator />

      <div className="space-y-2">
        <Label>Typography Preview</Label>
        <div className="border rounded-md p-4 bg-muted/30">
          {node.props?.variant === "h1" && (
            <h1 className={`${node.props?.align === 'center' ? 'text-center' : node.props?.align === 'right' ? 'text-right' : ''}`}>
              {localHtml || "Heading 1 Preview"}
            </h1>
          )}
          {node.props?.variant === "h2" && (
            <h2 className={`${node.props?.align === 'center' ? 'text-center' : node.props?.align === 'right' ? 'text-right' : ''}`}>
              {localHtml || "Heading 2 Preview"}
            </h2>
          )}
          {node.props?.variant === "h3" && (
            <h3 className={`${node.props?.align === 'center' ? 'text-center' : node.props?.align === 'right' ? 'text-right' : ''}`}>
              {localHtml || "Heading 3 Preview"}
            </h3>
          )}
          {(!node.props?.variant || node.props?.variant === "p") && (
            <p className={`${node.props?.align === 'center' ? 'text-center' : node.props?.align === 'right' ? 'text-right' : ''}`}>
              {localHtml || "Paragraph Preview"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

const ButtonInspector: React.FC<{ node: Node; onUpdate: (updater: (node: Node) => Node) => void }> = ({ node, onUpdate }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="button-label">Button Label</Label>
        <Input
          id="button-label"
          value={node.props?.label || ""}
          onChange={(e) =>
            onUpdate((n) =>
              n.type === "button"
                ? ({ ...n, props: { ...(n.props || {}), label: e.target.value } } as Node)
                : n
            )
          }
          placeholder="Click me"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="button-href">Link URL</Label>
        <Input
          id="button-href"
          value={node.props?.href || ""}
          onChange={(e) =>
            onUpdate((n) =>
              n.type === "button"
                ? ({ ...n, props: { ...(n.props || {}), href: e.target.value } } as Node)
                : n
            )
          }
          placeholder="https://example.com"
        />
      </div>

      <Separator />

      <div className="space-y-2">
        <Label>Button Preview</Label>
        <div className="border rounded-md p-4 bg-muted/30">
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            {node.props?.label || "Button"}
          </button>
        </div>
      </div>
    </div>
  );
};

const ContainerInspector: React.FC<{ node: Node; onUpdate: (updater: (node: Node) => Node) => void }> = ({ node, onUpdate }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="container-maxwidth">Max Width</Label>
        <Select 
          value={node.props?.maxWidth || "xl"} 
          onValueChange={(value) =>
            onUpdate((n) =>
              n.type === "container"
                ? ({ ...n, props: { ...(n.props || {}), maxWidth: value } } as Node)
                : n
            )
          }
        >
          <SelectTrigger id="container-maxwidth">
            <SelectValue placeholder="Select max width" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sm">Small (640px)</SelectItem>
            <SelectItem value="md">Medium (768px)</SelectItem>
            <SelectItem value="lg">Large (1024px)</SelectItem>
            <SelectItem value="xl">Extra Large (1280px)</SelectItem>
            <SelectItem value="2xl">2XL (1536px)</SelectItem>
            <SelectItem value="full">Full Width</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="container-px">Padding X</Label>
          <NumericDragInput
            id="container-px"
            min={0}
            max={12}
            step={2}
            value={node.props?.paddingX ?? 4}
            onChange={(val) =>
              onUpdate((n) =>
                n.type === "container"
                  ? ({ ...n, props: { ...(n.props || {}), paddingX: val } } as Node)
                  : n
              )
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="container-py">Padding Y</Label>
          <NumericDragInput
            id="container-py"
            min={0}
            max={12}
            step={2}
            value={node.props?.paddingY ?? 6}
            onChange={(val) =>
              onUpdate((n) =>
                n.type === "container"
                  ? ({ ...n, props: { ...(n.props || {}), paddingY: val } } as Node)
                  : n
              )
            }
          />
        </div>
      </div>
    </div>
  );
};

const EventListInspector: React.FC<{ node: Node; onUpdate: (updater: (node: Node) => Node) => void }> = ({ node, onUpdate }) => {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="event-title">Event List Title</Label>
        <Input
          id="event-title"
          value={node.props?.title || ""}
          onChange={(e) =>
            onUpdate((n) =>
              n.type === "eventList"
                ? ({ ...n, props: { ...(n.props || {}), title: e.target.value } } as Node)
                : n
            )
          }
          placeholder="Upcoming Events"
        />
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="event-show-filters"
          checked={node.props?.showFilters !== false}
          onChange={(e) =>
            onUpdate((n) =>
              n.type === "eventList"
                ? ({ ...n, props: { ...(n.props || {}), showFilters: e.target.checked } } as Node)
                : n
            )
          }
        />
        <Label htmlFor="event-show-filters">Show Filters</Label>
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="event-show-title"
          checked={node.props?.showTitle !== false}
          onChange={(e) =>
            onUpdate((n) =>
              n.type === "eventList"
                ? ({ ...n, props: { ...(n.props || {}), showTitle: e.target.checked } } as Node)
                : n
            )
          }
        />
        <Label htmlFor="event-show-title">Show Title</Label>
      </div>
    </div>
  );
};

const usePaddingOverlay = (sectionId: string | null, nodeId: string) => {
  React.useEffect(() => {
    if (!sectionId) return;
    return () => {
      BuilderState.hidePaddingOverlay(sectionId, nodeId);
    };
  }, [sectionId, nodeId]);
};

const PaddingControls: React.FC<{ node: Node; onUpdate: (updater: (node: Node) => Node) => void; gridSize?: number }> = ({ node, onUpdate }) => {
  const sectionId = BuilderState.selection?.sectionId ?? null;
  usePaddingOverlay(sectionId, node.id);

  const padding = React.useMemo(() => {
    const style = { ...(node.style || {}) } as any;
    const y = style.paddingY ?? 0;
    const x = style.paddingX ?? y;
    return {
      top: style.paddingTop ?? y,
      right: style.paddingRight ?? x,
      bottom: style.paddingBottom ?? y,
      left: style.paddingLeft ?? x,
    };
  }, [node.style]);

  const [split, setSplit] = React.useState(() => {
    const { top, right, bottom, left } = padding;
    return !(top === bottom && right === left && top === right);
  });

  React.useEffect(() => {
    if (!sectionId) return;
    BuilderState.showPaddingOverlay(sectionId, node.id, [padding.top, padding.right, padding.bottom, padding.left]);
    return () => {
      BuilderState.hidePaddingOverlay(sectionId, node.id);
    };
  }, [sectionId, node.id, padding.top, padding.right, padding.bottom, padding.left]);

  const publishOverlay = React.useCallback((values: [number, number, number, number]) => {
    if (!sectionId) return;
    BuilderState.showPaddingOverlay(sectionId, node.id, values);
  }, [sectionId, node.id]);

  const updateStyle = React.useCallback((mutator: (current: any) => any) => {
    onUpdate((n) => {
      if (n.type !== "text") return n;
      const style = { ...(n.style || {}) } as any;
      const next = mutator(style);
      return { ...n, style: next } as Node;
    });
  }, [onUpdate]);

  const handleGlobal = React.useCallback((val: number) => {
    updateStyle((style) => {
      style.paddingY = val;
      style.paddingX = val;
      delete style.paddingTop;
      delete style.paddingRight;
      delete style.paddingBottom;
      delete style.paddingLeft;
      return style;
    });
    publishOverlay([val, val, val, val]);
  }, [updateStyle, publishOverlay]);

  const handleSplit = React.useCallback((side: "top" | "right" | "bottom" | "left", val: number) => {
    updateStyle((style) => {
      style[`padding${side[0].toUpperCase()}${side.slice(1)}`] = val;
      return style;
    });
    publishOverlay([
      side === "top" ? val : padding.top,
      side === "right" ? val : padding.right,
      side === "bottom" ? val : padding.bottom,
      side === "left" ? val : padding.left,
    ]);
  }, [updateStyle, publishOverlay, padding.top, padding.right, padding.bottom, padding.left]);

  const toggleSplit = React.useCallback((checked: boolean) => {
    setSplit(checked);
    if (checked) {
      updateStyle((style) => {
        const y = style.paddingY ?? 0;
        const x = style.paddingX ?? y;
        style.paddingTop = style.paddingTop ?? y;
        style.paddingBottom = style.paddingBottom ?? y;
        style.paddingLeft = style.paddingLeft ?? x;
        style.paddingRight = style.paddingRight ?? x;
        delete style.paddingY;
        delete style.paddingX;
        return style;
      });
      publishOverlay([padding.top, padding.right, padding.bottom, padding.left]);
    } else {
      const vertical = Math.max(padding.top, padding.bottom);
      const horizontal = Math.max(padding.left, padding.right);
      updateStyle((style) => {
        style.paddingY = vertical;
        style.paddingX = horizontal;
        delete style.paddingTop;
        delete style.paddingRight;
        delete style.paddingBottom;
        delete style.paddingLeft;
        return style;
      });
      publishOverlay([vertical, horizontal, vertical, horizontal]);
    }
  }, [updateStyle, publishOverlay, padding.top, padding.right, padding.bottom, padding.left]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm">Padding</Label>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Split sides</span>
          <Switch checked={split} onCheckedChange={toggleSplit} />
        </div>
      </div>
      {!split ? (
        <div className="space-y-2">
          <Label>All sides</Label>
          <NumericDragInput
            min={0}
            max={40}
            step={0.5}
            value={Math.max(padding.top, padding.right, padding.bottom, padding.left)}
            onChange={handleGlobal}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Top</div>
            <NumericDragInput min={0} max={40} step={0.5} value={padding.top} onChange={(val) => handleSplit("top", val)} />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Right</div>
            <NumericDragInput min={0} max={40} step={0.5} value={padding.right} onChange={(val) => handleSplit("right", val)} />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Bottom</div>
            <NumericDragInput min={0} max={40} step={0.5} value={padding.bottom} onChange={(val) => handleSplit("bottom", val)} />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Left</div>
            <NumericDragInput min={0} max={40} step={0.5} value={padding.left} onChange={(val) => handleSplit("left", val)} />
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Padding values are in Tailwind spacing units (1 = 0.25rem).</p>
    </div>
  );
};

const ElementInspector: React.FC<ElementInspectorProps> = ({
  open,
  onOpenChange,
  selectedNode,
  onUpdateNode,
  fontManager,
  gridSize,
}) => {
  if (!selectedNode) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
        <SheetContent side="right" className="w-[400px] sm:w-[500px] p-0" onInteractOutside={(e) => e.preventDefault()}>
          <div className="px-6 py-4">
            <SheetHeader>
              <SheetTitle>Element Inspector</SheetTitle>
              <SheetDescription>
                Select an element to edit its properties
              </SheetDescription>
            </SheetHeader>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  const getElementTypeName = (type: string) => {
    switch (type) {
      case "text": return "Text Element";
      case "button": return "Button Element";
      case "container": return "Container Element";
      case "eventList": return "Event List Element";
      default: return "Unknown Element";
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" className="w-[400px] sm:w-[500px] p-0" onInteractOutside={(e) => e.preventDefault()}>
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
            <div className="text-xs font-mono text-muted-foreground">
              ID: {selectedNode.id}
            </div>
            <div className="text-xs font-mono text-muted-foreground">
              Type: {selectedNode.type}
            </div>
          </div>

          <Separator />

          {/* Common layout controls for ALL elements */}
          <PositionControls node={selectedNode} onUpdateNode={onUpdateNode} gridSize={gridSize} />
          <LayoutSizeControls node={selectedNode} onUpdateNode={onUpdateNode} gridSize={gridSize} />

          {selectedNode.type === "text" && (
            <TextInspector node={selectedNode as TextNode} onUpdate={onUpdateNode} fontManager={fontManager} />
          )}

          {selectedNode.type === "button" && (
            <ButtonInspector node={selectedNode} onUpdate={onUpdateNode} />
          )}

          {selectedNode.type === "container" && (
            <ContainerInspector node={selectedNode} onUpdate={onUpdateNode} />
          )}

          {selectedNode.type === "eventList" && (
            <EventListInspector node={selectedNode} onUpdate={onUpdateNode} />
          )}

          <Separator />

          <div className="pt-4 pb-6">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => onOpenChange(false)}
            >
              Close Inspector
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ElementInspector;
