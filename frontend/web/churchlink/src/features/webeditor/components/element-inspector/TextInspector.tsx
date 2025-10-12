import React from 'react';

import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline } from 'lucide-react';

import { getFontByFamily, getFontById } from '@/shared/constants/googleFonts';
import { NumericDragInput } from '@/shared/components/NumericDragInput';
import { Button } from '@/shared/components/ui/button';
import {
  ColorPicker,
  ColorPickerAlpha,
  ColorPickerHue,
  ColorPickerOutput,
  ColorPickerSelection,
} from '@/shared/components/ui/shadcn-io/color-picker';
import { Label } from '@/shared/components/ui/label';
import { Input } from '@/shared/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { Separator } from '@/shared/components/ui/separator';
import { Textarea } from '@/shared/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group';
import { Node, TextNode } from '@/shared/types/pageV2';
import { BuilderState } from '@/features/webeditor/state/BuilderState';

import FontPicker from '../FontPicker';
import { PaddingControls } from './PaddingControls';

type TextInspectorProps = {
  node: TextNode;
  onUpdate: (updater: (node: Node) => Node) => void;
  fontManager?: any;
  gridSize?: number;
};

export const TextInspector: React.FC<TextInspectorProps> = ({ node, onUpdate, fontManager, gridSize }) => {
  const [customFontActive, setCustomFontActive] = React.useState<boolean>(false);
  const [localHtml, setLocalHtml] = React.useState(node.props?.html || node.props?.text || '');
  const prevRef = React.useRef<Node | null>(null);
  const [colorOpen, setColorOpen] = React.useState(false);

  React.useEffect(() => {
    const fam = (node.style as any)?.fontFamily as string | undefined;
    const match = getFontByFamily(fontManager?.fontOptions ?? [], fam || undefined);
    setCustomFontActive(match ? false : Boolean(fam));
  }, [node.style, fontManager?.fontOptions]);

  React.useEffect(() => {
    setLocalHtml(node.props?.html || node.props?.text || '');
  }, [node.props?.html, node.props?.text]);

  const handleHtmlChange = (value: string) => {
    setLocalHtml(value);
  };

  const handleHtmlBlur = () => {
    const before = { ...node };
    onUpdate((n) =>
      n.type === 'text'
        ? ({ ...n, props: { ...(n.props || {}), html: localHtml } } as Node)
        : n
    );
    const sectionId = BuilderState.selection?.sectionId;
    const nodeId = BuilderState.selection?.nodeId;
    if (sectionId && nodeId) {
      BuilderState.pushNode(sectionId, nodeId, before, { ...node, props: { ...(node.props || {}), html: localHtml } });
    }
  };

  const handleAlignChange = (align: string) => {
    const before = { ...node };
    onUpdate((n) =>
      n.type === 'text'
        ? ({ ...n, props: { ...(n.props || {}), align } } as Node)
        : n
    );
    const sectionId = BuilderState.selection?.sectionId;
    const nodeId = BuilderState.selection?.nodeId;
    if (sectionId && nodeId) {
      BuilderState.pushNode(sectionId, nodeId, before, { ...node, props: { ...(node.props || {}), align } });
    }
  };

  const textStyles = (node.style as any)?.textStyles || [];

  const handleStyleToggle = (values: string[]) => {
    const before = { ...node };
    onUpdate((n) =>
      n.type === 'text'
        ? ({
            ...n,
            style: {
              ...(n.style || {}),
              textStyles: values,
            },
          } as Node)
        : n
    );
    const sectionId = BuilderState.selection?.sectionId;
    const nodeId = BuilderState.selection?.nodeId;
    if (sectionId && nodeId) {
      BuilderState.pushNode(sectionId, nodeId, before, { ...node, style: { ...(node.style || {}), textStyles: values } });
    }
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
                    n.type === 'text'
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
              selectedFontId={
                customFontActive
                  ? 'custom'
                  : getFontByFamily(fontManager?.fontOptions ?? [], (node.style as any)?.fontFamily || undefined)?.id ?? 'system'
              }
              fontButtonLabel={
                (customFontActive && (node.style as any)?.fontFamily) ||
                getFontByFamily(fontManager?.fontOptions ?? [], (node.style as any)?.fontFamily || undefined)?.label ||
                  'System Default'
              }
              fontButtonDescription={
                (customFontActive && 'Custom CSS family') ||
                getFontByFamily(fontManager?.fontOptions ?? [], (node.style as any)?.fontFamily || undefined)?.fontFamily ||
                  'Browser default stack'
              }
              customFontActive={customFontActive}
              handleSelectFont={(fontId: string) => {
                if (!fontId || fontId === 'system') {
                  setCustomFontActive(false);
                  onUpdate((n) =>
                    n.type === 'text'
                      ? ({ ...n, style: { ...(n.style || {}), fontFamily: undefined } } as Node)
                      : n
                  );
                  return;
                }
                if (fontId === 'custom') {
                  setCustomFontActive(true);
                  return;
                }
                const meta = getFontById(fontManager?.fontOptions ?? [], fontId);
                if (meta) {
                  const linkId = `google-font-link-${meta.id}`;
                  if (!document.getElementById(linkId)) {
                    const link = document.createElement('link');
                    link.id = linkId;
                    link.rel = 'stylesheet';
                    link.href = meta.cssUrl;
                    document.head.appendChild(link);
                  }
                  setCustomFontActive(false);
                  onUpdate((n) =>
                    n.type === 'text'
                      ? ({ ...n, style: { ...(n.style || {}), fontFamily: meta.fontFamily } } as Node)
                      : n
                  );
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
        <Popover
          open={colorOpen}
          onOpenChange={(open) => {
            if (open) {
              prevRef.current = { ...node };
            } else {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (sectionId && nodeId && prevRef.current) {
                BuilderState.pushNode(sectionId, nodeId, prevRef.current, { ...node });
                prevRef.current = null;
              }
            }
            setColorOpen(open);
          }}
        >
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start gap-2 h-10">
                <div
                  className="h-6 w-6 rounded border border-gray-300"
                  style={{ backgroundColor: (node.style as any)?.color || '#000000' }}
                />
                <span className="text-sm truncate">{(node.style as any)?.color || '#000000'}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="start">
              <ColorPicker
                value={(node.style as any)?.color || '#000000'}
                onChange={(c) => {
                  const css = typeof c === 'string' ? c : (typeof (c as any)?.string === 'function' ? (c as any).string() : String(c));
                  if ((node.style as any)?.color === css) return;
                  onUpdate((n) =>
                    n.type === 'text'
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
                n.type === 'text'
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
            onFocus={() => { prevRef.current = { ...node }; }}
            onChangeEnd={() => {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (sectionId && nodeId && prevRef.current) {
                BuilderState.pushNode(sectionId, nodeId, prevRef.current, { ...node });
                prevRef.current = null;
              }
            }}
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
                n.type === 'text'
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
            onFocus={() => { prevRef.current = { ...node }; }}
            onChangeEnd={() => {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (sectionId && nodeId && prevRef.current) {
                BuilderState.pushNode(sectionId, nodeId, prevRef.current, { ...node });
                prevRef.current = null;
              }
            }}
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
                n.type === 'text'
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
            onFocus={() => { prevRef.current = { ...node }; }}
            onChangeEnd={() => {
              const sectionId = BuilderState.selection?.sectionId;
              const nodeId = BuilderState.selection?.nodeId;
              if (sectionId && nodeId && prevRef.current) {
                BuilderState.pushNode(sectionId, nodeId, prevRef.current, { ...node });
                prevRef.current = null;
              }
            }}
          />
          <p className="text-xs text-muted-foreground">Default is 1px. Increase for thicker underlines.</p>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="text-align">Text Alignment</Label>
        <ToggleGroup
          type="single"
          value={node.props?.align || 'left'}
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
            value={(node.style as any)?.width || 'auto'}
            onChange={(e) =>
              onUpdate((n) =>
                n.type === 'text'
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
                n.type === 'text'
                  ? ({
                      ...n,
                      style: {
                        ...(n.style || {}),
                        width: 'auto',
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
          {node.props?.variant === 'h1' && (
            <h1 className={`${node.props?.align === 'center' ? 'text-center' : node.props?.align === 'right' ? 'text-right' : ''}`}>
              {localHtml || 'Heading 1 Preview'}
            </h1>
          )}
          {node.props?.variant === 'h2' && (
            <h2 className={`${node.props?.align === 'center' ? 'text-center' : node.props?.align === 'right' ? 'text-right' : ''}`}>
              {localHtml || 'Heading 2 Preview'}
            </h2>
          )}
          {node.props?.variant === 'h3' && (
            <h3 className={`${node.props?.align === 'center' ? 'text-center' : node.props?.align === 'right' ? 'text-right' : ''}`}>
              {localHtml || 'Heading 3 Preview'}
            </h3>
          )}
          {(!node.props?.variant || node.props?.variant === 'p') && (
            <p className={`${node.props?.align === 'center' ? 'text-center' : node.props?.align === 'right' ? 'text-right' : ''}`}>
              {localHtml || 'Paragraph Preview'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};


