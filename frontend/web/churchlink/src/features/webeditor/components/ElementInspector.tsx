import React from "react";
import { Node, TextNode } from "@/shared/types/pageV2";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/shared/components/ui/sheet";
import { Separator } from "@/shared/components/ui/separator";
import { Label } from "@/shared/components/ui/label";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select";
import { Button } from "@/shared/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/shared/components/ui/toggle-group";
import { AlignLeft, AlignCenter, AlignRight, Bold, Italic, Underline } from "lucide-react";
import FontPicker from "./FontPicker";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/components/ui/popover";
import { ColorPicker, ColorPickerAlpha, ColorPickerHue, ColorPickerSelection, ColorPickerOutput } from "@/shared/components/ui/shadcn-io/color-picker";

interface ElementInspectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedNode: Node | null;
  onUpdateNode: (updater: (node: Node) => Node) => void;
  fontManager?: any; // Font manager from useFontManager hook
}

const TextInspector: React.FC<{ node: TextNode; onUpdate: (updater: (node: Node) => Node) => void; fontManager?: any }> = ({ node, onUpdate, fontManager }) => {
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
          <Input
            id="underline-thickness"
            type="number"
            min={1}
            max={10}
            step={0.5}
            value={(node.style as any)?.underlineThickness || 1}
            onChange={(e) =>
              onUpdate((n) =>
                n.type === "text"
                  ? ({
                      ...n,
                      style: {
                        ...(n.style || {}),
                        underlineThickness: Number(e.target.value),
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
                }
              }}
              {...fontManager}
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
          <Input
            id="font-size"
            type="number"
            min={0.5}
            max={10}
            step={0.125}
            value={(node.style as any)?.fontSize || 1}
            onChange={(e) =>
              onUpdate((n) =>
                n.type === "text"
                  ? ({
                      ...n,
                      style: {
                        ...(n.style || {}),
                        fontSize: Number(e.target.value),
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
          <Input
            id="font-weight"
            type="number"
            min={100}
            max={900}
            step={100}
            value={(node.style as any)?.fontWeight || 400}
            onChange={(e) =>
              onUpdate((n) =>
                n.type === "text"
                  ? ({
                      ...n,
                      style: {
                        ...(n.style || {}),
                        fontWeight: Number(e.target.value),
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

      <div className="space-y-2">
        <Label>Padding</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Top/Bottom</div>
            <Input
              type="number"
              min={0}
              max={20}
              step={1}
              value={(node.style as any)?.paddingY || 0}
              onChange={(e) =>
                onUpdate((n) =>
                  n.type === "text"
                    ? ({
                        ...n,
                        style: {
                          ...(n.style || {}),
                          paddingY: Number(e.target.value),
                        },
                      } as Node)
                    : n
                )
              }
              placeholder="0"
            />
          </div>
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Left/Right</div>
            <Input
              type="number"
              min={0}
              max={20}
              step={1}
              value={(node.style as any)?.paddingX || 0}
              onChange={(e) =>
                onUpdate((n) =>
                  n.type === "text"
                    ? ({
                        ...n,
                        style: {
                          ...(n.style || {}),
                          paddingX: Number(e.target.value),
                        },
                      } as Node)
                    : n
                )
              }
              placeholder="0"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Padding in rem units (1 = 0.25rem, 4 = 1rem)
        </p>
      </div>

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
          <Input
            id="container-px"
            type="number"
            min={0}
            max={12}
            step={2}
            value={node.props?.paddingX || 4}
            onChange={(e) =>
              onUpdate((n) =>
                n.type === "container"
                  ? ({ ...n, props: { ...(n.props || {}), paddingX: Number(e.target.value) } } as Node)
                  : n
              )
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="container-py">Padding Y</Label>
          <Input
            id="container-py"
            type="number"
            min={0}
            max={12}
            step={2}
            value={node.props?.paddingY || 6}
            onChange={(e) =>
              onUpdate((n) =>
                n.type === "container"
                  ? ({ ...n, props: { ...(n.props || {}), paddingY: Number(e.target.value) } } as Node)
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

const ElementInspector: React.FC<ElementInspectorProps> = ({
  open,
  onOpenChange,
  selectedNode,
  onUpdateNode,
  fontManager,
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
