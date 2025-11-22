import React from 'react';

// import { Button } from '@/shared/components/ui/button';
import { NumericDragInput } from '@/shared/components/NumericDragInput';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Button } from '@/shared/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover';
import { ColorPicker, ColorPickerAlpha, ColorPickerHue, ColorPickerOutput, ColorPickerSelection } from '@/shared/components/ui/shadcn-io/color-picker';
import { Node } from '@/shared/types/pageV2';
import { BuilderState } from '@/features/webeditor/state/BuilderState';
import { roundToTwoOrFiveThousandths } from '@/shared/utils/rounding';

type ButtonInspectorProps = {
  node: Node;
  onUpdate: (updater: (node: Node) => Node) => void;
  activeLocale?: string;
  defaultLocale?: string;
};

function resolveLocalized(node: Node, key: string, activeLocale?: string, defaultLocale?: string): any {
  const i18n = (node as any).i18n as Record<string, Record<string, any>> | undefined;
  const locale = activeLocale || defaultLocale;
  if (locale && i18n && i18n[locale] && i18n[locale].hasOwnProperty(key)) return i18n[locale][key];
  return (node as any).props?.[key];
}

export const ButtonInspector: React.FC<ButtonInspectorProps> = ({ node, onUpdate, activeLocale, defaultLocale }) => {
  const prevRef = React.useRef<Node | null>(null);
  const fontSize = typeof (node.style as any)?.fontSize === 'number' ? (node.style as any).fontSize : 1;
  const [colorOpen, setColorOpen] = React.useState(false);
  const [hexInput, setHexInput] = React.useState<string>((node.style as any)?.color || '#ffffff');

  React.useEffect(() => {
    const currentColor = (node.style as any)?.color || '#ffffff';
    setHexInput(currentColor);
  }, [(node.style as any)?.color]);

  const commitChanges = React.useCallback(() => {
    const sectionId = BuilderState.selection?.sectionId;
    const nodeId = BuilderState.selection?.nodeId;
    if (sectionId && nodeId && prevRef.current) {
      BuilderState.pushNode(sectionId, nodeId, prevRef.current, { ...node });
      prevRef.current = null;
    }
  }, [node]);
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="button-label">Button Label</Label>
        <Input
          id="button-label"
          value={resolveLocalized(node, 'label', activeLocale, defaultLocale) || ''}
          onChange={(e) => {
            const value = e.target.value;
            onUpdate((n) => {
              if (n.type !== 'button') return n;
              const useLocale = activeLocale && defaultLocale && activeLocale !== defaultLocale ? activeLocale : null;
              if (useLocale) {
                const prevI18n = ((n as any).i18n || {}) as Record<string, Record<string, any>>;
                const prevFor = prevI18n[useLocale] || {};
                return { ...(n as any), i18n: { ...prevI18n, [useLocale]: { ...prevFor, label: value } } } as Node;
              }
              return ({ ...n, props: { ...(n.props || {}), label: value } } as Node);
            });
          }}
          onFocus={() => { prevRef.current = { ...node }; }}
          onBlur={() => commitChanges()}
          placeholder="Click me"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="button-href">Link URL</Label>
        <Input
          id="button-href"
          value={node.props?.href || ''}
          onChange={(e) =>
            onUpdate((n) =>
              n.type === 'button'
                ? ({ ...n, props: { ...(n.props || {}), href: e.target.value } } as Node)
                : n
            )
          }
          onFocus={() => { prevRef.current = { ...node }; }}
          onBlur={() => commitChanges()}
          placeholder="https://example.com"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="button-font-size">Font Size (grid units)</Label>
        <NumericDragInput
          id="button-font-size"
          min={0.5}
          max={6}
          step={0.125}
          transformValue={roundToTwoOrFiveThousandths}
          value={roundToTwoOrFiveThousandths(fontSize)}
          onChange={(val) =>
            onUpdate((n) =>
              n.type === 'button'
                ? ({
                    ...n,
                    style: {
                      ...(n.style || {}),
                      fontSize: roundToTwoOrFiveThousandths(val),
                    },
                  } as Node)
                : n
            )
          }
          placeholder="1"
          onFocus={() => { prevRef.current = { ...node }; }}
          onBlur={() => commitChanges()}
          onChangeEnd={commitChanges}
        />
      </div>

      <div className="space-y-2">
        <Label>Text Color</Label>
        <Popover
          open={colorOpen}
          onOpenChange={(open) => {
            if (open) {
              prevRef.current = { ...node };
            } else {
              commitChanges();
            }
            setColorOpen(open);
          }}
        >
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start gap-2 h-10">
              <div
                className="h-6 w-6 rounded border border-gray-300"
                style={{ backgroundColor: (node.style as any)?.color || '#ffffff' }}
              />
              <span className="text-sm truncate">{(node.style as any)?.color || '#ffffff'}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <ColorPicker
              value={(node.style as any)?.color || '#ffffff'}
              onChange={(c) => {
                const css = typeof c === 'string' ? c : (typeof (c as any)?.string === 'function' ? (c as any).string() : String(c));
                if ((node.style as any)?.color === css) return;
                onUpdate((n) =>
                  n.type === 'button'
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
                <ColorPickerAlpha 
                  style={{
                    background: 'linear-gradient(to right, transparent, currentColor)',
                    boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.1)',
                  }}
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Label htmlFor="btn-hex-input" className="text-xs whitespace-nowrap">Hex:</Label>
                <Input
                  id="btn-hex-input"
                  type="text"
                  value={hexInput}
                  onChange={(e) => {
                    const val = e.target.value;
                    setHexInput(val);
                    // Only apply if valid hex format
                    if (/^#([0-9A-Fa-f]{3}){1,2}$/.test(val) || /^#([0-9A-Fa-f]{8})$/.test(val)) {
                      onUpdate((n) =>
                        n.type === 'button'
                          ? ({
                              ...n,
                              style: {
                                ...(n.style || {}),
                                color: val,
                              },
                            } as Node)
                          : n
                      );
                    }
                  }}
                  className="h-8 text-xs font-mono"
                  placeholder="#ffffff"
                />
              </div>
              <div className="flex items-center gap-2">
                <ColorPickerOutput />
              </div>
            </ColorPicker>
          </PopoverContent>
        </Popover>
      </div>

      {/* Background is now handled by the global Background control above. */}
    </div>
  );
};


